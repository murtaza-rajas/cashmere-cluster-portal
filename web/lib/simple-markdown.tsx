import { Fragment, type ReactNode } from "react";

// A tiny, dependency-free renderer for the handful of markdown constructs
// staff actually use in free-text content fields (CareGuide.body today) —
// not a general markdown library. Returns React nodes directly rather than
// HTML + dangerouslySetInnerHTML, so there's no sanitization burden: a
// malformed "**" or "##" just renders as plain text, never as markup.
// Built 2026-10-08 after a real client report — staff had written properly
// structured content (## headings, **bold**, blank-line paragraphs), but the
// page was dumping the whole string into one <p>, showing the literal "##"/
// "**" characters and collapsing every line break into one dense paragraph.
export function renderSimpleMarkdown(text: string): ReactNode {
  const blocks = text.trim().split(/\n\s*\n/);

  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={i} className="mt-2 font-serif text-base font-semibold text-cashmere-text">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={i} className="mt-3 font-serif text-lg font-semibold text-cashmere-text">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
    }
    return (
      <p key={i} className="leading-relaxed text-cashmere-text-muted">
        {renderInline(trimmed)}
      </p>
    );
  });
}

// Inline **bold** only — the one inline construct staff content has actually
// used. Splits on the marker pairs, odd-indexed pieces are the bolded text.
function renderInline(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-cashmere-text">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
