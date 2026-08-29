import sanitize from 'sanitize-html';

/**
 * HTML from the admin rich text editor is stored verbatim and rendered with
 * `dangerouslySetInnerHTML` on the website, so it is sanitized on the way in.
 * Doing it here rather than at render time means a single trusted copy in the
 * database, and no dependency on the frontend remembering to clean it.
 */

/** What a case study section may contain: structure and emphasis, nothing else. */
const STORY_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'a', 'blockquote',
];

/** Blog articles additionally embed uploaded images and coloured spans. */
const ARTICLE_TAGS = [
  ...STORY_TAGS,
  'h1', 'h5', 'h6',
  'img', 'span', 'figure', 'figcaption', 'pre', 'code', 'hr',
];

/** Quill marks indent and alignment with `ql-*` classes, so class is preserved. */
const BASE_OPTIONS: sanitize.IOptions = {
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    // External links opened in a new tab must not hand over `window.opener`.
    a: sanitize.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
  // Drop the contents of stripped tags too, not just their markup.
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe'],
};

const STORY_OPTIONS: sanitize.IOptions = {
  ...BASE_OPTIONS,
  allowedTags: STORY_TAGS,
};

const ARTICLE_OPTIONS: sanitize.IOptions = {
  ...BASE_OPTIONS,
  allowedTags: ARTICLE_TAGS,
  allowedAttributes: {
    ...BASE_OPTIONS.allowedAttributes,
    img: ['src', 'alt', 'width', 'height'],
    span: ['class', 'style'],
    p: ['class', 'style'],
  },
  // Data URIs are allowed for images only, where they cannot execute.
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\(([\d\s.,%]+)\)$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\(([\d\s.,%]+)\)$/i],
      'text-align': [/^(left|right|center|justify)$/],
    },
  },
};

/** True when the markup carries no readable text and no image. */
function isBlank(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  return !html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

function clean(value: unknown, options: sanitize.IOptions): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const html = sanitize(value, options).trim();
  // An editor left empty still submits `<p><br></p>`; that must not render as a block.
  return isBlank(html) ? undefined : html;
}

/** Sanitizes a case study story section. Returns undefined when effectively empty. */
export function sanitizeStoryHtml(value: unknown): string | undefined {
  return clean(value, STORY_OPTIONS);
}

/** Sanitizes long-form article HTML, which may embed images and colour. */
export function sanitizeArticleHtml(value: unknown): string | undefined {
  return clean(value, ARTICLE_OPTIONS);
}

/**
 * Newsletter bodies are the article set minus what email clients punish. Data-URI
 * images are dropped because inlining them inflates the message and reliably trips
 * spam filters, and `class` is dropped because the shell inlines every style —
 * Gmail strips `<style>` blocks, so a class with no rule behind it is dead weight.
 */
const NEWSLETTER_OPTIONS: sanitize.IOptions = {
  ...ARTICLE_OPTIONS,
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    span: ['style'],
    p: ['style'],
  },
  allowedSchemesByTag: { img: ['http', 'https'] },
  // Dropping a disallowed scheme leaves the <img> behind with no src, which renders
  // as a broken-image icon in the inbox. Remove the whole element instead.
  exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs['src'],
};

/**
 * Rich-text editors — and anything pasted out of Word or Google Docs — write the gap
 * between words as `&nbsp;` rather than a space. A non-breaking space gives the mail
 * client no wrap opportunity, so a paragraph becomes one unbreakable "word" hundreds
 * of characters long, which cannot fit the 600px email table and overflows it on
 * every client. Runs collapse to a single ordinary space, which is what the author
 * meant in the first place.
 */
function collapseNonBreakingSpaces(html: string): string {
  return html.replace(/(&nbsp;|&#160;|\u00a0)+/gi, ' ');
}

/** Sanitizes newsletter body HTML composed in the admin. Returns undefined when effectively empty. */
export function sanitizeNewsletterHtml(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return clean(collapseNonBreakingSpaces(value), NEWSLETTER_OPTIONS);
}
