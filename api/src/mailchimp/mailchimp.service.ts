import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipTier } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
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

interface Subscriber {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface MailchimpSyncResult {
  totalSubscribers: number;
  shopifyCustomersCreated: number;
  membersCreated: number;
  membersMarkedSubscribed: number;
  membersMarkedUnsubscribed: number;
  failed: { email: string; reason: string }[];
}

export type MailchimpSyncStatus =
  | { state: 'idle' }
  | { state: 'running'; startedAt: string }
  | {
      state: 'finished';
      startedAt: string;
      finishedAt: string;
      result: MailchimpSyncResult;
    }
  | { state: 'failed'; startedAt: string; finishedAt: string; error: string };

const PAGE_SIZE = 1000;

// Mailchimp-subscriber sync (PROJECT_TRACKER.md Section 3b; extended
// 2026-10-09 per the client's rules):
//
// - Every `subscribed` contact gets a bare Shopify customer (customerCreate
//   sends no invite email and leaves marketing consent untouched) AND a CLC
//   Member at NEWSLETTER level, keyed on the same numeric Shopify customer id
//   the login flow stores — so their first login lands on this same row, no
//   duplicate.
// - Existing members are matched (by email, then Shopify id) and only get
//   newsletterSubscribed=true; their tier is never changed.
// - Anyone previously marked subscribed who is no longer `subscribed` in
//   Mailchimp (unsubscribed, cleaned, archived, deleted) gets
//   newsletterSubscribed=false. Nothing is deleted and no tier changes.
//
// Runs in the background: a first sync of a few hundred contacts takes far
// longer than the web proxy's 30s timeout. One run at a time; state is
// in-memory (single API instance) — the audit log is the durable record.
@Injectable()
export class MailchimpService {
  private readonly logger = new Logger(MailchimpService.name);
  private status: MailchimpSyncStatus = { state: 'idle' };

  constructor(
    private readonly config: ConfigService,
    private readonly shopifyApi: ShopifyAdminApiService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  getSyncStatus(): MailchimpSyncStatus {
    return this.status;
  }

  // Returns once the run has started; the work continues in the background.
  // Exposes the run's promise so tests can await completion deterministically.
  startSync(actorStaffUserId: string): {
    status: MailchimpSyncStatus;
    done: Promise<void>;
  } {
    if (this.status.state === 'running') {
      throw new ConflictException('A Mailchimp sync is already running');
    }
    const startedAt = new Date().toISOString();
    this.status = { state: 'running', startedAt };

    const done = this.syncSubscribers()
      .then(async (result) => {
        this.status = {
          state: 'finished',
          startedAt,
          finishedAt: new Date().toISOString(),
          result,
        };
        await this.auditLog.log({
          actorStaffUserId,
          action: 'mailchimp.synced',
          targetType: 'MailchimpSync',
          // Bulk action, no single target — fixed sentinel, same convention
          // as ShopifyAdminToken's singleton id.
          targetId: 'mailchimp-sync',
          metadata: { ...result, failed: result.failed.length },
        });
      })
      .catch((err: Error) => {
        this.logger.error('Mailchimp sync failed', err);
        this.status = {
          state: 'failed',
          startedAt,
          finishedAt: new Date().toISOString(),
          error: err.message,
        };
      });

    return { status: this.status, done };
  }

  private get apiKey(): string {
    return this.config.getOrThrow<string>('MAILCHIMP_API_KEY');
  }

  private get audienceId(): string {
    return this.config.getOrThrow<string>('MAILCHIMP_AUDIENCE_ID');
  }

  // The API key's own suffix (e.g. "...-us8") is the account's datacenter.
  private get dataCenter(): string {
    const match = /-([a-z]+\d+)$/.exec(this.apiKey);
    if (!match) {
      throw new BadGatewayException(
        'MAILCHIMP_API_KEY is not a valid Mailchimp key (expected "...-usN")',
      );
    }
    return match[1];
  }

  async fetchSubscribedMembers(): Promise<Subscriber[]> {
    const results: Subscriber[] = [];
    let offset = 0;

    for (;;) {
      let data: MailchimpMembersResponse;
      try {
        ({ data } = await axios.get<MailchimpMembersResponse>(
          `https://${this.dataCenter}.api.mailchimp.com/3.0/lists/${this.audienceId}/members`,
          {
            headers: { Authorization: `Bearer ${this.apiKey}` },
            params: {
              status: 'subscribed',
              count: PAGE_SIZE,
              offset,
              fields:
                'total_items,members.email_address,members.status,members.merge_fields',
            },
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
        // Belt and braces: the status filter is applied server-side, but a
        // non-subscribed contact must never be imported.
        if (member.status !== 'subscribed') continue;
        results.push({
          email: member.email_address.trim(),
          firstName: member.merge_fields?.FNAME?.trim() || undefined,
          lastName: member.merge_fields?.LNAME?.trim() || undefined,
        });
      }

      offset += PAGE_SIZE;
      if (offset >= data.total_items) break;
    }

    return results;
  }

  async syncSubscribers(): Promise<MailchimpSyncResult> {
    // Fetched before touching anything: if Mailchimp can't be read, the
    // unsubscribe pass below must not run against an empty list.
    const subscribers = await this.fetchSubscribedMembers();
    const result: MailchimpSyncResult = {
      totalSubscribers: subscribers.length,
      shopifyCustomersCreated: 0,
      membersCreated: 0,
      membersMarkedSubscribed: 0,
      membersMarkedUnsubscribed: 0,
      failed: [],
    };

    const subscribedEmails = new Set<string>();

    for (const sub of subscribers) {
      const emailKey = sub.email.toLowerCase();
      if (subscribedEmails.has(emailKey)) continue;
      subscribedEmails.add(emailKey);

      try {
        await this.syncOne(sub, result);
      } catch (err) {
        this.logger.warn(
          `Mailchimp sync: failed for ${sub.email}: ${(err as Error).message}`,
        );
        result.failed.push({
          email: sub.email,
          reason: (err as Error).message,
        });
      }
    }

    const stillMarked = await this.prisma.member.findMany({
      where: { newsletterSubscribed: true },
      select: { id: true, email: true },
    });
    for (const member of stillMarked) {
      if (subscribedEmails.has(member.email.toLowerCase())) continue;
      await this.prisma.member.update({
        where: { id: member.id },
        data: { newsletterSubscribed: false },
      });
      await this.auditLog.log({
        action: 'member.newsletter_unsubscribed',
        targetType: 'Member',
        targetId: member.id,
        targetMemberId: member.id,
        metadata: { source: 'mailchimp_sync' },
      });
      result.membersMarkedUnsubscribed += 1;
    }

    return result;
  }

  private async syncOne(sub: Subscriber, result: MailchimpSyncResult) {
    // Existing member with this email (logged in before, or synced before):
    // they already have a Shopify customer, so skip Shopify entirely and just
    // set the flag. Tier untouched.
    const byEmail = await this.prisma.member.findFirst({
      where: {
        email: { equals: sub.email, mode: 'insensitive' },
        NOT: { shopifyCustomerId: { startsWith: 'demo-' } },
      },
      select: { id: true, newsletterSubscribed: true },
    });
    if (byEmail) {
      await this.markSubscribed(byEmail, result);
      return;
    }

    const { customerId, created } = await this.ensureShopifyCustomer(sub);
    if (created) result.shopifyCustomersCreated += 1;

    const byShopifyId = await this.prisma.member.findUnique({
      where: { shopifyCustomerId: customerId },
      select: { id: true, newsletterSubscribed: true },
    });
    if (byShopifyId) {
      await this.markSubscribed(byShopifyId, result);
      return;
    }

    const member = await this.prisma.member.create({
      data: {
        shopifyCustomerId: customerId,
        email: sub.email,
        firstName: sub.firstName,
        lastName: sub.lastName,
        membershipTier: MembershipTier.NEWSLETTER,
        newsletterSubscribed: true,
      },
    });
    await this.auditLog.log({
      action: 'member.created',
      targetType: 'Member',
      targetId: member.id,
      targetMemberId: member.id,
      metadata: { source: 'mailchimp_sync' },
    });
    result.membersCreated += 1;
  }

  private async markSubscribed(
    member: { id: string; newsletterSubscribed: boolean | null },
    result: MailchimpSyncResult,
  ) {
    if (member.newsletterSubscribed === true) return;
    await this.prisma.member.update({
      where: { id: member.id },
      data: { newsletterSubscribed: true },
    });
    result.membersMarkedSubscribed += 1;
  }

  // Returns the numeric Shopify customer id (the same form the login flow
  // stores — see ShopifyIdentityProvider's extractNumericId), creating a bare
  // customer if none exists. Deliberately no emailMarketingConsent input:
  // the subscriber's marketing relationship stays in Mailchimp only.
  private async ensureShopifyCustomer(
    sub: Subscriber,
  ): Promise<{ customerId: string; created: boolean }> {
    const data = await this.shopifyApi.graphql<{
      customerCreate: {
        customer: { id: string } | null;
        userErrors: { field: string[] | null; message: string }[];
      };
    }>(
      `mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }`,
      {
        input: {
          email: sub.email,
          firstName: sub.firstName,
          lastName: sub.lastName,
        },
      },
    );

    const { customer, userErrors } = data.customerCreate;
    if (customer) {
      return { customerId: numericId(customer.id), created: true };
    }

    const isDuplicate = userErrors.some(
      (e) =>
        (e.field ?? []).some((f) => f.toLowerCase().includes('email')) &&
        /taken|already|exist/i.test(e.message),
    );
    if (!isDuplicate) {
      throw new Error(
        userErrors.map((e) => e.message).join('; ') ||
          'Unknown error creating customer',
      );
    }

    const lookup = await this.shopifyApi.graphql<{
      customers: { nodes: { id: string; email: string | null }[] };
    }>(
      `query customerByEmail($query: String!) {
        customers(first: 5, query: $query) { nodes { id email } }
      }`,
      { query: `email:"${sub.email.replace(/"/g, '')}"` },
    );
    const match = lookup.customers.nodes.find(
      (c) => c.email?.toLowerCase() === sub.email.toLowerCase(),
    );
    if (!match) {
      throw new Error(
        'Shopify reports this email is taken but no customer with it was found',
      );
    }
    return { customerId: numericId(match.id), created: false };
  }
}

function numericId(gid: string): string {
  const match = /\/(\d+)$/.exec(gid);
  return match ? match[1] : gid;
}
