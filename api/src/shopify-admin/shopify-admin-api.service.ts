import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ShopifyAdminAuthService } from './shopify-admin-auth.service';

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

// The generic Shopify Admin GraphQL caller every piece of real commerce code
// (products, Selling Plans, customer creation) should go through — handles
// getting a valid token (refreshing if needed, via
// ShopifyAdminAuthService.getValidAccessToken) and the actual request/error
// shape, so individual features (e.g. MailchimpService) only ever write the
// query/mutation itself, not this boilerplate. First real caller: the
// Mailchimp-subscriber customer-creation sync (2026-10-08).
@Injectable()
export class ShopifyAdminApiService {
  constructor(
    private readonly auth: ShopifyAdminAuthService,
    private readonly config: ConfigService,
  ) {}

  async graphql<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const accessToken = await this.auth.getValidAccessToken();
    const shop = this.config.getOrThrow<string>('SHOPIFY_SHOP_DOMAIN');

    const { data } = await axios.post<GraphQLResponse<T>>(
      `https://${shop}/admin/api/2025-01/graphql.json`,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
      },
    );

    if (data.errors?.length) {
      throw new Error(
        `Shopify GraphQL error: ${data.errors.map((e) => e.message).join('; ')}`,
      );
    }
    if (!data.data) {
      throw new Error('Shopify GraphQL response had no data and no errors');
    }
    return data.data;
  }

  // Returns the numeric Shopify customer id (the same form the login flow
  // stores — see ShopifyIdentityProvider's extractNumericId), creating a bare
  // customer if none exists. customerCreate sends no invite email, and there's
  // deliberately no emailMarketingConsent input: marketing stays in Mailchimp.
  // Used by the Mailchimp sync and by staff adding members by hand.
  async findOrCreateCustomer(person: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<{ customerId: string; created: boolean }> {
    const data = await this.graphql<{
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
          email: person.email,
          firstName: person.firstName,
          lastName: person.lastName,
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

    const lookup = await this.graphql<{
      customers: { nodes: { id: string; email: string | null }[] };
    }>(
      `query customerByEmail($query: String!) {
        customers(first: 5, query: $query) { nodes { id email } }
      }`,
      { query: `email:"${person.email.replace(/"/g, '')}"` },
    );
    const match = lookup.customers.nodes.find(
      (c) => c.email?.toLowerCase() === person.email.toLowerCase(),
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
