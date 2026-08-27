// The method-agnostic contract promised to the client: everything downstream of
// authentication (Member lookup, our own JWT issuance, RBAC) depends only on this
// interface — never on Shopify specifically. Today Shopify Customer Accounts is the
// only IdentityProvider. If Shopify adds Passkey support, or a Passkey-capable
// provider (Auth0/Cognito) is added for the future non-Shopify portals, it plugs in
// here without touching anything else. See PROJECT_TRACKER.md Section 3.

export interface ExternalIdentity {
  providerId: string; // e.g. 'shopify'
  externalId: string; // stable subject id from the provider (Shopify customer id)
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface PkceState {
  codeVerifier: string;
  state: string;
}

export interface IdentityProvider {
  readonly providerId: string;

  /** Build the URL to redirect the browser to, plus the PKCE material to persist (e.g. in a signed cookie) until the callback. */
  buildAuthorizationRequest(): Promise<{
    redirectUrl: string;
    pkce: PkceState;
  }>;

  /** Exchange the callback's authorization code for a verified external identity. */
  handleCallback(code: string, pkce: PkceState): Promise<ExternalIdentity>;
}
