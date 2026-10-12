import { MembershipTier } from '@prisma/client';

// Tiers that unlock member-only content (stories, care guides). 6-Month has
// the same access as Annual (see web/lib/access.ts).
export const PAID_TIERS: MembershipTier[] = [
  MembershipTier.SIX_MONTH,
  MembershipTier.ANNUAL,
  MembershipTier.FOUNDING,
];

export function isPaidTier(tier: MembershipTier): boolean {
  return PAID_TIERS.includes(tier);
}

// Short plain-text teaser for locked content — strips the markdown staff
// write in (headings, bold) and cuts at a word boundary. Only ever returns
// the opening of the text, never the whole body.
export function plainExcerpt(text: string | null, maxLength = 180): string {
  if (!text) return '';
  const plain = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)) || cut}…`;
}

// Demo/preview accounts (scripts/create-member-preview-link.* — Shopify id
// "demo-<email>") are real rows so preview links work, but they aren't real
// members: excluded from every dashboard/report count, flagged in lists.
export const DEMO_ID_PREFIX = 'demo-';
export const REAL_MEMBERS_ONLY = {
  NOT: { shopifyCustomerId: { startsWith: DEMO_ID_PREFIX } },
} as const;

export function isDemoMember(member: { shopifyCustomerId: string }): boolean {
  return member.shopifyCustomerId.startsWith(DEMO_ID_PREFIX);
}
