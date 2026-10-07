import Image from "next/image";

// Shared between the real member-facing story page (app/(member)/news/[id])
// and the staff preview page (app/staff/stories/preview/[id]) — client
// request 2026-10-05: a "Preview" button that shows how a draft will
// actually look before publishing. Built as a shared component rather than
// a second copy specifically so the preview stays accurate automatically as
// this rendering evolves, instead of silently drifting from the real page.
export interface StoryArticleSection {
  type: "TEXT" | "IMAGE" | "IMAGE_GALLERY" | "QUOTE";
  text?: string | null;
  imageUrl?: string | null;
  galleryImageUrls?: string[] | null;
  quoteText?: string | null;
  quoteAttribution?: string | null;
  order?: number;
}

export interface StoryArticleData {
  title: string;
  heroImageUrl: string | null;
  categoryName: string;
  designerName?: string | null;
  sections: StoryArticleSection[];
}

function StorySectionBlock({ section }: { section: StoryArticleSection }) {
  switch (section.type) {
    case "TEXT":
      return section.text ? (
        <p className="whitespace-pre-line text-cashmere-text-muted">{section.text}</p>
      ) : null;
    case "IMAGE":
      // Natural proportions, not a cropped box (client email 2026-10-07:
      // "Article images should generally retain their original
      // proportions" — distinct from banners, which keep controlled
      // cropping). A fixed-height + object-cover box (what this used to be)
      // always crops something; width/height here are just placeholder
      // values satisfying next/image's required props — height: auto in the
      // className means the browser sizes the element from the real image's
      // own intrinsic aspect ratio once it loads, not from these numbers.
      return section.imageUrl ? (
        <Image
          src={section.imageUrl}
          alt=""
          width={1600}
          height={900}
          className="h-auto w-full rounded-2xl"
        />
      ) : null;
    case "IMAGE_GALLERY":
      return section.galleryImageUrls && section.galleryImageUrls.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {section.galleryImageUrls.map((url) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-xl">
              <Image src={url} alt="" fill className="object-cover" />
            </div>
          ))}
        </div>
      ) : null;
    case "QUOTE":
      return section.quoteText ? (
        <blockquote className="border-l-2 border-cashmere-accent pl-4">
          <p className="text-lg italic text-cashmere-text">&ldquo;{section.quoteText}&rdquo;</p>
          {section.quoteAttribution && (
            <footer className="mt-2 text-sm text-cashmere-text-muted">— {section.quoteAttribution}</footer>
          )}
        </blockquote>
      ) : null;
    default:
      return null;
  }
}

export function StoryArticle({ story }: { story: StoryArticleData }) {
  return (
    <article className="flex flex-col gap-6">
      {/* Natural proportions, same reasoning as the in-body IMAGE section
          above — this is the article's own main photo (client's requested
          layout, item 4: "Main image"), not a decorative banner, so it
          keeps its real shape rather than being cropped into a fixed box. */}
      {story.heroImageUrl && (
        <Image
          src={story.heroImageUrl}
          alt=""
          width={1600}
          height={900}
          className="h-auto w-full rounded-2xl"
          priority
        />
      )}

      <div className="rounded-2xl border border-cashmere-border bg-white p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-cashmere-accent-dark">
          {story.categoryName}
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-cashmere-text">{story.title}</h1>
        {story.designerName && <p className="mt-1 text-sm text-cashmere-text-muted">By {story.designerName}</p>}

        {story.sections.length > 0 && (
          <div className="mt-6 flex flex-col gap-6">
            {[...story.sections]
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((section, i) => (
                <StorySectionBlock key={i} section={section} />
              ))}
          </div>
        )}
      </div>
    </article>
  );
}
