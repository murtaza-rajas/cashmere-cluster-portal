import { Gift, Tag, CalendarDays, Sparkles, Star, Crown, Award, Heart, Leaf, MapPinned, type LucideIcon } from "lucide-react";

// A fixed, small set rather than a free-text icon field or a full icon picker —
// keeps staff input predictable (a <select>, not a string they can typo) and
// keeps this list in exactly one place for both the staff admin form and the
// member-facing pages that render whatever icon staff chose.
export const BENEFIT_ICONS: Record<string, LucideIcon> = {
  star: Star,
  gift: Gift,
  tag: Tag,
  calendar: CalendarDays,
  sparkles: Sparkles,
  crown: Crown,
  award: Award,
  heart: Heart,
  leaf: Leaf,
  location: MapPinned,
};

export const DEFAULT_BENEFIT_ICON: LucideIcon = Sparkles;

export function resolveBenefitIcon(icon: string | null): LucideIcon {
  return (icon && BENEFIT_ICONS[icon]) || DEFAULT_BENEFIT_ICON;
}
