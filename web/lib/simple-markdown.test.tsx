import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderSimpleMarkdown } from "./simple-markdown";

// Real bug (2026-10-08): staff had written properly structured content
// (## headings, **bold**, blank-line paragraphs) into CareGuide.body, but
// the page dumped the whole string into one <p>, showing the literal "##"/
// "**" characters with every line break collapsed into one dense paragraph.
// renderToStaticMarkup (not a new testing-library dependency) is enough to
// assert on the real rendered structure, since this returns plain React
// nodes rather than raw HTML strings.
function render(markdown: string): string {
  return renderToStaticMarkup(<>{renderSimpleMarkdown(markdown)}</>);
}

describe("renderSimpleMarkdown", () => {
  it("renders a ## line as an h3, not literal text", () => {
    const html = render("## Section Title\n\nSome body text.");
    expect(html).toContain("<h3");
    expect(html).toContain("Section Title");
    expect(html).not.toContain("##");
  });

  it("renders a ### line as an h4, not literal text", () => {
    const html = render("### Sub-heading\n\nSome body text.");
    expect(html).toContain("<h4");
    expect(html).toContain("Sub-heading");
    expect(html).not.toContain("###");
  });

  it("renders **bold** as <strong>, not literal asterisks", () => {
    const html = render("Plain text with **a bold phrase** inside it.");
    expect(html).toContain("<strong");
    expect(html).toContain("a bold phrase");
    expect(html).not.toContain("**");
  });

  it("renders blank-line-separated blocks as separate paragraphs, not one collapsed blob", () => {
    const html = render("First paragraph.\n\nSecond paragraph.\n\nThird paragraph.");
    const paragraphCount = html.split("<p").length - 1;
    expect(paragraphCount).toBe(3);
    expect(html).toContain("First paragraph.");
    expect(html).toContain("Second paragraph.");
    expect(html).toContain("Third paragraph.");
  });

  it("handles a realistic mixed document (headings, bold, multiple paragraphs) end to end", () => {
    const html = render(
      [
        "## Why It Happens",
        "",
        "**This is the short, important summary.** More detail follows in plain prose.",
        "",
        "A second plain paragraph with no special formatting.",
        "",
        "### A Smaller Point",
        "",
        "One more paragraph closing out the section.",
      ].join("\n"),
    );
    expect(html).toContain("<h3");
    expect(html).toContain("Why It Happens");
    expect(html).toContain("<h4");
    expect(html).toContain("A Smaller Point");
    expect(html).toContain("<strong");
    expect(html).toContain("This is the short, important summary.");
    expect(html).not.toMatch(/##|\*\*/);
  });
});
