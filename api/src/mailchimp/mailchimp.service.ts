import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ShopifyAdminApiService } from '../shopify-admin/shopify-admin-api.service';

interface MailchimpMember {
  email_address: string;
  status: string;
  merge_fields?: { FNAME?: string; LNAME?: string };
}

interface MailchimpMembersResponse {
  members: MailchimpMember[];
  total_items: number;
}

export interface MailchimpSyncResult {
  totalSubscribers: number;
  created: number;
  alreadyExisted: number;
  failed: { email: string; reason: string }[];
}

const PAGE_SIZE = 1000;

// Newsletter login for Mailchimp-only subscribers (PROJECT_TRACKER.md Section
// 3b) — the one piece of that architecture left unbuilt once the Shopify
// Admin API OAuth work landed 2026-10-06. Real architecture, confirmed via
// Shopify's own docs: customerCreate does NOT send any invite/activation
// email by default (that's the separate customerSendAccountInviteEmail
// mutation, never called here) and leaves emailMarketingConsent untouched
// unless explicitly set — so this never touches a subscriber's real
// marketing-consent relationship, which stays entirely in Mailchimp. Once a
// bare Shopify customer record exists for them, the already-built
// passwordless Shopify Customer Account login just works, no new CLC-side
// login system needed.
//
// Deliberately a staff-triggered sync (POST /integrations/mailchimp-sync),
// not a live Mailchimp webhook — Mailchimp webhooks are a separate, real
// configuration step on the Mailchimp side (per-audience, needs a public
// callback URL registered there) that was never part of what was scoped;
// staff-triggered matches this app's existing pattern for anything that
// creates real external records (e.g. Newsletter Campaigns deliberately
// stops at "Ready to send", no auto-send) rather than something running
// unattended against production.
@Injectable()
export class MailchimpService {
  private readonly logger = new Logger(MailchimpService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly shopifyApi: ShopifyAdminApiService,
  ) {}

  private get apiKey(): string {
    return this.config.getOrThrow<string>('MAILCHIMP_API_KEY');
  }

  private get audienceId(): string {
    return this.config.getOrThrow<string>('MAILCHIMP_AUDIENCE_ID');
  }

  // The API key's own suffix (e.g. "...-us8") is the datacenter the account
  // lives on — Mailchimp's documented way to build the per-account API host,
  // not a separate credential.
  private get dataCenter(): string {
    const parts = this.apiKey.split('-');
    const dc = parts[parts.length - 1];
    if (parts.length < 2 || !dc) {
      throw new Error(
        'MAILCHIMP_API_KEY is missing its datacenter suffix (expected "...-usN")',
      );
    }
    return dc;
  }

  // Only `status: subscribed` — explicitly excludes unsubscribed/cleaned/
  // pending members, who have no real, current newsletter relationship to
  // honor with portal access. Paginates in case the audience exceeds 1000.
  async fetchSubscribedMembers(): Promise<
    { email: string; firstName?: string; lastName?: string }[]
  > {
    const results: { email: string; firstName?: string; lastName?: string }[] =
      [];
    let offset = 0;

    for (;;) {
      let data: MailchimpMembersResponse;
      try {
        ({ data } = await axios.get<MailchimpMembersResponse>(
          `https://${this.dataCenter}.api.mailchimp.com/3.0/lists/${this.audienceId}/members`,
          {
            headers: { Authorization: `Bearer ${this.apiKey}` },
            params: { status: 'subscribed', count: PAGE_SIZE, offset },
          },
        ));
      } catch (err) {
        this.logger.error(
          'Mailchimp fetchSubscribedMembers failed',
          err as Error,
        );
        throw new BadGatewayException(
          'Could not reach Mailchimp — check the API key and Audience ID in Integrations settings',
        );
      }

      for (const member of data.members) {
        results.push({
          email: member.email_address,
          firstName: member.merge_fields?.FNAME || undefined,
          lastName: member.merge_fields?.LNAME || undefined,
        });
      }

      offset += PAGE_SIZE;
      if (offset >= data.total_items) break;
    }

    return results;
  }

  // Creates a bare Shopify customer for every subscribed Mailchimp member who
  // doesn't already have one — "already have one" is discovered by
  // customerCreate's own duplicate-email rejection rather than a separate
  // lookup call first, since Shopify is the authority on that and a second
  // round-trip per subscriber would double the real API cost for no benefit.
  async syncSubscribersToShopify(): Promise<MailchimpSyncResult> {
    const members = await this.fetchSubscribedMembers();
    const result: MailchimpSyncResult = {
      totalSubscribers: members.length,
      created: 0,
      alreadyExisted: 0,
      failed: [],
    };

    for (const member of members) {
      try {
        const created = await this.createBareShopifyCustomer(member);
        if (created) {
          result.created += 1;
        } else {
          result.alreadyExisted += 1;
        }
      } catch (err) {
        this.logger.warn(
          `Mailchimp sync: failed to create Shopify customer for ${member.email}: ${(err as Error).message}`,
        );
        result.failed.push({
          email: member.email,
          reason: (err as Error).message,
        });
      }
    }

    return result;
  }

  // Returns true if a new customer was created, false if one already existed
  // for this email (not an error — the common, expected case for repeat
  // syncs). Deliberately no emailMarketingConsent/smsMarketingConsent input —
  // leaving both entirely unset keeps Shopify's own consent fields untouched,
  // so the subscriber's real marketing relationship stays in Mailchimp only.
  private async createBareShopifyCustomer(member: {
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<boolean> {
    const mutation = `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }
    `;

    const data = await this.shopifyApi.graphql<{
      customerCreate: {
        customer: { id: string } | null;
        userErrors: { field: string[]; message: string }[];
      };
    }>(mutation, {
      input: {
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
      },
    });

    const { customer, userErrors } = data.customerCreate;
    if (customer) {
      return true;
    }

    const isDuplicate = userErrors.some(
      (e) =>
        e.field.some((f) => f.toLowerCase().includes('email')) &&
        /taken|already|exist/i.test(e.message),
    );
    if (isDuplicate) {
      return false;
    }

    throw new Error(
      userErrors.map((e) => e.message).join('; ') ||
        'Unknown error creating customer',
    );
  }
}
