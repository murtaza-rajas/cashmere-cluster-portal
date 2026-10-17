// Online-store links shown to members (newsletter homepage + Collections).
// Handles checked against cashmerehouse.com/collections.json on 2026-10-12.
// Accessories points at the scarf collection — the store's own "Cashmere
// Accessories" collection had a single product. There's no home/interior
// collection in the store yet, so Home has no link and shows "Coming soon".
export const STORE_URL = "https://www.cashmerehouse.com";

export interface StoreCollection {
  title: string;
  image: string;
  href: string | null;
}

export const STORE_COLLECTIONS: StoreCollection[] = [
  { title: "Women", image: "/images/collection-women.jpeg", href: `${STORE_URL}/collections/cashmere-for-women` },
  { title: "Men", image: "/images/collection-men.jpeg", href: `${STORE_URL}/collections/mens-cashmere-clothing` },
  { title: "Accessories", image: "/images/collection-accessories.jpeg", href: `${STORE_URL}/collections/cashmere-scarf` },
  { title: "Home", image: "/images/collection-home.jpeg", href: null },
];

export const SOCIAL_LINKS = {
  instagram: "https://instagram.com/cashmerehouseNO",
  facebook: "https://facebook.com/cashmerehouseno",
};

// Membership products in the store (handles checked via the Admin API on
// 2026-10-17). They show "page not found" until the products are published.
export const MEMBERSHIP_PRODUCT_URLS = {
  sixMonth: `${STORE_URL}/products/cashmere-lovers-club-6-month-membership`,
  annual: `${STORE_URL}/products/cashmere-lovers-club-annual-membership`,
  founding: `${STORE_URL}/products/cashmere-lovers-club`,
};
