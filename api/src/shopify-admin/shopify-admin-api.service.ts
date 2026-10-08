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
}
