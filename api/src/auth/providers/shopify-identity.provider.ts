import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ExternalIdentity, IdentityProvider, PkceState } from '../interfaces/identity-provider.interface';
import { deriveCodeChallenge, generateCodeVerifier, generateState } from '../pkce.util';

interface OidcDiscoveryDocument {
  authorization_endpoint: string;
  token_endpoint: string;
}

// Implements login via Shopify's Customer Account API (OAuth 2.0 Authorization Code + PKCE).
// Reference: https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/authenticate-customers
//
// Notes for whoever wires this up against the real store:
// - This is a PUBLIC OAuth client (PKCE, no client secret) — Shopify does not issue one
//   for this flow, so there's nothing secret to store beyond the client ID.
// - The redirect URI must be HTTPS and must exactly match what's registered in the
//   Shopify app's [customer_authentication] config — localhost is not accepted, which
//   is why Milestone 2 needs a public staging URL (tunnel or deployed) to test this
//   end-to-end, not just `npm run start:dev`.
// - The exact GraphQL field names below (emailAddress.emailAddress, firstName, lastName)
//   are correct as of the current Customer Account API docs, but should be re-verified
//   via introspection against the client's actual store once real credentials exist —
//   API versions can shift field shapes between releases.
@Injectable()
export class ShopifyIdentityProvider implements IdentityProvider {
  readonly providerId = 'shopify';
  private readonly logger = new Logger(ShopifyIdentityProvider.name);
  private discoveryCache: OidcDiscoveryDocument | null = null;

  constructor(private readonly config: ConfigService) {}

  private get shopDomain(): string {
    // e.g. "your-store.myshopify.com" — no https:// prefix, per Shopify's docs.
    return this.config.getOrThrow<string>('SHOPIFY_SHOP_DOMAIN');
  }

  private get clientId(): string {
    return this.config.getOrThrow<string>('SHOPIFY_CLIENT_ID');
  }

  private get redirectUri(): string {
    return this.config.getOrThrow<string>('SHOPIFY_REDIRECT_URI');
  }

  private async discover(): Promise<OidcDiscoveryDocument> {
    if (this.discoveryCache) return this.discoveryCache;

    const url = `https://${this.shopDomain}/.well-known/openid-configuration`;
    try {
      const { data } = await axios.get<OidcDiscoveryDocument>(url);
      this.discoveryCache = data;
      return data;
    } catch (err) {
      this.logger.error(`Shopify OIDC discovery failed for ${url}`, err as Error);
      throw new BadGatewayException('Could not reach Shopify identity discovery endpoint');
    }
  }

  async buildAuthorizationRequest(): Promise<{ redirectUrl: string; pkce: PkceState }> {
    const { authorization_endpoint } = await this.discover();

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = deriveCodeChallenge(codeVerifier);
    const state = generateState();

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: 'openid email customer-account-api:full',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      redirectUrl: `${authorization_endpoint}?${params.toString()}`,
      pkce: { codeVerifier, state },
    };
  }

  async handleCallback(code: string, pkce: PkceState): Promise<ExternalIdentity> {
    const { token_endpoint } = await this.discover();

    const tokenResponse = await axios
      .post(
        token_endpoint,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          code,
          code_verifier: pkce.codeVerifier,
          redirect_uri: this.redirectUri,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      .catch((err) => {
        this.logger.error('Shopify token exchange failed', err as Error);
        throw new BadGatewayException('Shopify token exchange failed');
      });

    const accessToken: string = tokenResponse.data.access_token;

    // Discover the Customer Account GraphQL endpoint and fetch the identity.
    const { data: apiDiscovery } = await axios.get<{ graphql_api: string }>(
      `https://${this.shopDomain}/.well-known/customer-account-api`,
    );

    const query = /* GraphQL */ `
      query CurrentCustomer {
        customer {
          id
          firstName
          lastName
          emailAddress {
            emailAddress
          }
        }
      }
    `;

    const { data: gqlResponse } = await axios
      .post(
        apiDiscovery.graphql_api,
        { query },
        { headers: { Authorization: accessToken, 'Content-Type': 'application/json' } },
      )
      .catch((err) => {
        this.logger.error('Shopify customer identity query failed', err as Error);
        throw new BadGatewayException('Could not fetch customer identity from Shopify');
      });

    const customer = gqlResponse?.data?.customer;
    if (!customer) {
      throw new BadGatewayException('Shopify did not return a customer identity');
    }

    return {
      providerId: this.providerId,
      externalId: customer.id,
      email: customer.emailAddress.emailAddress,
      firstName: customer.firstName ?? undefined,
      lastName: customer.lastName ?? undefined,
    };
  }
}
