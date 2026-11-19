/**
 * prompts.js — LapakKata's copy jobs: routing, output schemas, prompts.
 *
 * Every job returns structured JSON. The same schema object is sent to
 * the cloud model as `responseSchema` and to the on-device model as the
 * Prompt API `responseConstraint`, so both engines answer in the same
 * shape and the UI renders them identically.
 *
 * Routing rationale (see DESIGN.md §4):
 *  - short, frequent, structured text  -> PREFER_ON_DEVICE
 *  - photo understanding / long kits   -> PREFER_IN_CLOUD
 *  - the seller's private draft        -> ONLY_ON_DEVICE (never uploads)
 */

export const JOB_TYPES = {
  CAPTION_PACK: "caption-pack",
  LISTING_TEXT: "listing-text",
  LISTING_PHOTO: "listing-photo",
  CAMPAIGN_KIT: "campaign-kit",
  POLISH_PRIVATE: "polish-private",
};

/** InferenceMode names from firebase/ai — kept as strings so this file
 *  stays SDK-free; ai-service.js maps them to the real enum. */
export const JOB_ROUTES = {
  [JOB_TYPES.CAPTION_PACK]: "PREFER_ON_DEVICE",
  [JOB_TYPES.LISTING_TEXT]: "PREFER_ON_DEVICE",
  [JOB_TYPES.LISTING_PHOTO]: "PREFER_IN_CLOUD",
  [JOB_TYPES.CAMPAIGN_KIT]: "PREFER_IN_CLOUD",
  [JOB_TYPES.POLISH_PRIVATE]: "ONLY_ON_DEVICE",
};

export const JOB_LABELS = {
  [JOB_TYPES.CAPTION_PACK]: {
    title: "Caption Pack",
    blurb: "3 social captions + hashtags for this product.",
    routeNote: "Runs on-device first — fast, free, works offline.",
  },
  [JOB_TYPES.LISTING_TEXT]: {
    title: "Marketplace Listing",
    blurb: "Search-ready title, description, bullets and keywords.",
    routeNote: "Runs on-device first — structured text is Nano's home turf.",
  },
  [JOB_TYPES.LISTING_PHOTO]: {
    title: "Listing from Photo",
    blurb: "Full listing written from your product photo.",
    routeNote: "Cloud first — photo understanding deserves the big model. Falls back to the device offline.",
  },
  [JOB_TYPES.CAMPAIGN_KIT]: {
    title: "Campaign Kit",
    blurb: "Listing + captions + WhatsApp broadcast + promo post, in one go.",
    routeNote: "Cloud first — long, multi-part output. Falls back to the device offline.",
  },
  [JOB_TYPES.POLISH_PRIVATE]: {
    title: "Private Polish",
    blurb: "Rewrite your own draft. It never leaves this device.",
    routeNote: "On-device ONLY — if no device model is available, nothing is uploaded. Ever.",
  },
};

/* ------------------------------- schemas ------------------------------ */

const listingSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Marketplace listing title, max ~120 characters, keyword-rich, no ALL-CAPS spam." },
    description: { type: "string", description: "2-4 short paragraphs selling the product honestly." },
    bullets: { type: "array", items: { type: "string" }, description: "4-6 short benefit/spec bullets." },
    keywords: { type: "array", items: { type: "string" }, description: "6-10 search keywords buyers would type." },
  },
  required: ["title", "description", "bullets", "keywords"],
};

export const JOB_SCHEMAS = {
  [JOB_TYPES.CAPTION_PACK]: {
    type: "object",
    properties: {
      captions: {
        type: "array",
        items: { type: "string" },
        description: "Exactly 3 captions, each under 60 words, distinct angles (e.g. craving, story, offer).",
      },
      hashtags: { type: "array", items: { type: "string" }, description: "8-12 hashtags, no leading '#' needed." },
    },
    required: ["captions", "hashtags"],
  },
  [JOB_TYPES.LISTING_TEXT]: listingSchema,
  [JOB_TYPES.LISTING_PHOTO]: listingSchema,
  [JOB_TYPES.CAMPAIGN_KIT]: {
    type: "object",
    properties: {
      listing: listingSchema,
      captions: { type: "array", items: { type: "string" }, description: "2 social captions." },
      hashtags: { type: "array", items: { type: "string" } },
      whatsapp: { type: "string", description: "A WhatsApp broadcast message a seller can forward to customers, with a clear call to action." },
      promoPost: { type: "string", description: "One short promotional post with urgency but no fake claims." },
    },
    required: ["listing", "captions", "whatsapp", "promoPost"],
  },
  [JOB_TYPES.POLISH_PRIVATE]: {
    type: "object",
    properties: {
      polished: { type: "string", description: "The seller's draft, rewritten to be clear and persuasive, same facts, same language as the draft." },
      altVersion: { type: "string", description: "A shorter, punchier alternative version." },
    },
    required: ["polished", "altVersion"],
  },
};

/* --------------------------- prompt builders -------------------------- */

function productBrief(product) {
  const lines = [
    `Product name: ${product.name || "(unnamed)"}`,
    product.category ? `Category: ${product.category}` : null,
    product.price ? `Price: ${product.price}` : null,
    product.details ? `Key details from the seller: ${product.details}` : null,
    `Tone: ${product.tone || "Friendly"}`,
    `Write the copy in: ${product.language || "English"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

const ROLE =
  "You are an expert copywriter for Indonesian micro and small online sellers (UMKM) " +
  "selling on marketplaces and social media. Be concrete and honest: never invent " +
  "certifications, discounts, ingredients, or facts the seller did not provide. " +
  "Return ONLY a JSON object matching the requested schema — no markdown, no commentary.";

export function buildPrompt(jobType, product, extras = {}) {
  const brief = productBrief(product);
  switch (jobType) {
    case JOB_TYPES.CAPTION_PACK:
      return `${ROLE}\n\n${brief}\n\nTask: write a caption pack for social media posts about this product.`;
    case JOB_TYPES.LISTING_TEXT:
      return `${ROLE}\n\n${brief}\n\nTask: write a complete marketplace listing for this product.`;
    case JOB_TYPES.LISTING_PHOTO:
      return (
        `${ROLE}\n\n${brief}\n\nTask: look at the attached product photo and write a complete ` +
        `marketplace listing. Use visible details from the photo (form, packaging, color, setting) ` +
        `plus the seller's notes. If a detail is not visible and not in the notes, do not invent it.`
      );
    case JOB_TYPES.CAMPAIGN_KIT:
      return `${ROLE}\n\n${brief}\n\nTask: produce a complete campaign kit for this product: listing, captions, a WhatsApp broadcast message, and one promo post.`;
    case JOB_TYPES.POLISH_PRIVATE:
      return (
        `${ROLE}\n\nThe seller wrote this draft selling text. Rewrite it to be clear, warm and ` +
        `persuasive while keeping every fact and the same language as the draft.\n\nDraft:\n"""${extras.draft || ""}"""`
      );
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

/** Jobs that attach the product photo when one is provided. */
export function jobUsesPhoto(jobType) {
  return jobType === JOB_TYPES.LISTING_PHOTO;
}
