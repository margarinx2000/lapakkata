/**
 * stub-service.js — LOCAL DEMO STUB. Clearly separated on purpose.
 *
 * Implements the exact same interface as ai-service.js
 * ({ kind, probeDevice, generate }) so the whole UI — forms, routing
 * labels, badges, offline queue, library — can be exercised before a
 * Firebase project exists. Outputs are deterministic templates built
 * from the product fields; they are NOT AI output and are always
 * badged "STUB" in the UI.
 *
 * The moment js/firebase-config.js contains a real project config,
 * app.js selects ai-service.js instead and this file is never called.
 */

import { JOB_TYPES } from "./prompts.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function idLanguage(product) {
  return (product.language || "").toLowerCase().startsWith("bahasa");
}

function captionSet(p) {
  const name = p.name || "this product";
  const price = p.price ? ` — ${p.price}` : "";
  if (idLanguage(p)) {
    return [
      `${name}${price}. Dibuat dengan bahan pilihan dan rasa yang konsisten. Pesan hari ini, kirim hari ini juga!`,
      `Lagi cari ${p.category || "produk"} yang bisa diandalkan? ${name} jawabannya. Stok terbatas, jangan sampai kehabisan.`,
      `Cerita di balik ${name}: dibuat pelan-pelan, dijual dengan jujur. Sekali coba biasanya balik lagi.`,
    ];
  }
  return [
    `${name}${price}. Made with care, priced honestly. Order today — ships today.`,
    `Looking for ${p.category || "something"} that actually delivers? Meet ${name}. Small batch, big repeat orders.`,
    `The story behind ${name}: made slowly, sold honestly. One try is usually all it takes.`,
  ];
}

function hashtagsFor(p) {
  const base = (p.category || "product").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const tags = ["umkm", "jualanonline", "smallbusiness", "shoplocal", base || "product", "indonesia", "onlineshop", "promo"];
  return [...new Set(tags)];
}

function listingFor(p) {
  const name = p.name || "Product";
  const details = p.details || "Quality you can feel from the first use.";
  return {
    title: `${name} — ${p.category || "Original"} ${p.price ? `| ${p.price}` : ""}`.slice(0, 120),
    description: `${name} is made for everyday sellers and buyers who want quality without the markup.\n\n${details}\n\nOrder today and we pack it with care, ready to ship.`,
    bullets: [
      details.split(".")[0] + ".",
      p.price ? `Honest price: ${p.price}.` : "Honest, seller-friendly pricing.",
      "Packed safely for shipping.",
      "Fast response from the seller, every day.",
    ],
    keywords: [name.toLowerCase(), (p.category || "product").toLowerCase(), "original", "ready stock", "best seller"],
  };
}

export function createStubService() {
  return {
    kind: "stub",

    async probeDevice() {
      await sleep(400);
      return { state: "stub", availability: "stub" };
    },

    async generate(jobType, { product, draft } = {}) {
      await sleep(650 + Math.random() * 500);
      const p = product || {};
      let data;
      switch (jobType) {
        case JOB_TYPES.CAPTION_PACK:
          data = { captions: captionSet(p), hashtags: hashtagsFor(p) };
          break;
        case JOB_TYPES.LISTING_TEXT:
        case JOB_TYPES.LISTING_PHOTO:
          data = listingFor(p);
          break;
        case JOB_TYPES.CAMPAIGN_KIT:
          data = {
            listing: listingFor(p),
            captions: captionSet(p).slice(0, 2),
            hashtags: hashtagsFor(p),
            whatsapp:
              `Halo kak! ${p.name || "Produk kami"} lagi ready stock${p.price ? `, harga ${p.price}` : ""}. ` +
              `Stok terbatas minggu ini — balas pesan ini untuk order, kami kirim hari ini juga. Terima kasih!`,
            promoPost: `${p.name || "Our product"} — this week only, order direct and skip the queue. While stock lasts.`,
          };
          break;
        case JOB_TYPES.POLISH_PRIVATE:
          data = {
            polished: (draft || "").trim()
              ? `${(draft || "").trim()} (Polished locally by the demo stub — connect Firebase for real on-device rewriting.)`
              : "Your polished draft will appear here.",
            altVersion: "Short version: same facts, fewer words, clearer call to action.",
          };
          break;
        default:
          throw new Error(`Stub has no job: ${jobType}`);
      }
      return { data, source: "STUB", mode: "STUB" };
    },
  };
}
