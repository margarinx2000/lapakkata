/**
 * app.js — LapakKata UI controller.
 *
 * Service selection: tries the real Firebase AI Logic service first
 * (js/ai-service.js). If no Firebase config exists yet — or the SDK
 * cannot load — it falls back to the clearly-labeled local stub
 * (js/stub-service.js) so every flow can be exercised in demo mode.
 *
 * Everything user-owned (products, queue, library) lives in
 * localStorage. Nothing leaves the browser except AI calls.
 *
 * Photos: the picked file is downscaled ON THIS DEVICE to a JPEG data
 * URL (max 1024px) before it is stored, queued, or sent. That keeps
 * payloads small, keeps the offline queue inside localStorage limits,
 * and matches what on-device inference accepts (inline JPEG/PNG).
 */

import { JOB_TYPES, JOB_ROUTES, JOB_LABELS } from "./prompts.js";
import { createStubService } from "./stub-service.js";

const LS = {
  queue: "lapakkata.queue.v1",
  library: "lapakkata.library.v1",
  products: "lapakkata.products.v1",
};
const LIBRARY_CAP = 50;

const $ = (sel) => document.querySelector(sel);
const load = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

let service = null;
let describeError = (_t, e) => `Generation failed: ${e?.message || e}`;
/** Canonical photo: { dataUrl, mimeType } — downscaled, queue-safe. */
let photo = null;
let queue = load(LS.queue, []);
let library = load(LS.library, []);
let flushing = false;

/* ------------------------------ service ------------------------------ */

async function bootService() {
  try {
    const mod = await import("./ai-service.js");
    describeError = mod.describeError;
    service = await mod.createAiService();
  } catch (err) {
    console.warn("[LapakKata] Firebase service unavailable, using stub:", err);
    service = null;
  }
  if (!service) {
    service = createStubService();
    $("#stubBanner").hidden = false;
  }
  $("#serviceChip").textContent =
    service.kind === "firebase" ? "Live · Firebase AI Logic" : "Demo mode · local stub";
  $("#deviceChip").textContent =
    service.kind === "firebase"
      ? "Device AI: not checked yet — tap Enable"
      : "Device AI: demo stub";
}

/* ------------------------------ product ------------------------------ */

function readProduct() {
  return {
    name: $("#pName").value.trim(),
    category: $("#pCategory").value,
    price: $("#pPrice").value.trim(),
    details: $("#pDetails").value.trim(),
    tone: $("#pTone").value,
    language: $("#pLang").value,
  };
}

function fillProduct(p) {
  $("#pName").value = p.name || "";
  $("#pCategory").value = p.category || "Food & Drink";
  $("#pPrice").value = p.price || "";
  $("#pDetails").value = p.details || "";
  $("#pTone").value = p.tone || "Friendly";
  $("#pLang").value = p.language || "English";
}

function refreshProductSelect() {
  const products = load(LS.products, []);
  const sel = $("#productSelect");
  sel.innerHTML = '<option value="">Saved products…</option>';
  products.forEach((p, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = p.name || `Product ${i + 1}`;
    sel.appendChild(o);
  });
}

/* ------------------------------- photo ------------------------------- */

/** Downscale a picked photo on this device → queue-safe JPEG data URL. */
async function fileToDownscaledDataUrl(file, maxDim = 1024) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function setPhoto(next) {
  photo = next;
  const img = $("#photoPreview");
  const rm = $("#removePhotoBtn");
  if (photo) {
    img.src = photo.dataUrl;
    img.hidden = false;
    rm.hidden = false;
  } else {
    img.hidden = true;
    img.removeAttribute("src");
    rm.hidden = true;
    $("#pPhoto").value = "";
  }
}

/* --------------------------- connectivity ---------------------------- */

const effectiveOnline = () => navigator.onLine && !$("#simOffline").checked;

function refreshConnChip() {
  const on = effectiveOnline();
  const chip = $("#connChip");
  chip.textContent = on ? "Online" : "Offline";
  chip.dataset.state = on ? "online" : "offline";
}

/* ------------------------------ notices ------------------------------ */

function showNotice(msg) {
  const n = $("#formNotice");
  n.textContent = msg;
  n.hidden = false;
}
function clearNotice() {
  const n = $("#formNotice");
  n.hidden = true;
  n.textContent = "";
}

/* ------------------------------ badges ------------------------------- */

function badgeFor(source) {
  switch (source) {
    case "ON_DEVICE": return { cls: "on-device", label: "⚡ ON-DEVICE · Gemini Nano" };
    case "IN_CLOUD": return { cls: "cloud", label: "☁ CLOUD · Gemini" };
    case "STUB": return { cls: "stub", label: "DEMO STUB — not AI output" };
    case "QUEUED": return { cls: "queued", label: "⏳ QUEUED — waiting for connection" };
    default: return { cls: "cloud", label: `SERVED · ${source}` };
  }
}

/* ----------------------------- rendering ----------------------------- */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function flashLabel(btn, doneText, backText) {
  btn.textContent = doneText;
  setTimeout(() => (btn.textContent = backText), 1500);
}

function copyBtn(text) {
  const b = el("button", "copy-btn", "Copy");
  b.type = "button";
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      flashLabel(b, "Copied ✓", "Copy");
    } catch { b.textContent = "Select & copy manually"; }
  });
  return b;
}

function sectionCard(title, bodyText) {
  const wrap = el("div", "result-section");
  const head = el("div", "result-section-head");
  head.append(el("h4", null, title), copyBtn(bodyText));
  wrap.append(head, el("p", "result-text", bodyText));
  return wrap;
}

function listingBlock(listing) {
  const frag = document.createDocumentFragment();
  frag.appendChild(sectionCard("Listing title", listing.title || ""));
  frag.appendChild(sectionCard("Description", listing.description || ""));
  if (Array.isArray(listing.bullets)) {
    frag.appendChild(sectionCard("Highlights", listing.bullets.map((b) => `• ${b}`).join("\n")));
  }
  if (Array.isArray(listing.keywords)) {
    frag.appendChild(sectionCard("Search keywords", listing.keywords.join(", ")));
  }
  return frag;
}

function hashtagsText(tags) {
  return tags.map((h) => `#${String(h).replace(/^#/, "")}`).join(" ");
}

function whatsappSection(text) {
  const card = sectionCard("WhatsApp broadcast", text);
  const wa = el("a", "wa-link", "Open in WhatsApp ↗");
  wa.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  wa.target = "_blank"; wa.rel = "noopener";
  card.appendChild(wa);
  return card;
}

function renderResultData(jobType, data) {
  const frag = document.createDocumentFragment();
  if (jobType === JOB_TYPES.CAPTION_PACK) {
    (data.captions || []).forEach((c, i) => frag.appendChild(sectionCard(`Caption ${i + 1}`, c)));
    if (data.hashtags) frag.appendChild(sectionCard("Hashtags", hashtagsText(data.hashtags)));
  } else if (jobType === JOB_TYPES.LISTING_TEXT || jobType === JOB_TYPES.LISTING_PHOTO) {
    frag.appendChild(listingBlock(data));
  } else if (jobType === JOB_TYPES.CAMPAIGN_KIT) {
    if (data.listing) frag.appendChild(listingBlock(data.listing));
    (data.captions || []).forEach((c, i) => frag.appendChild(sectionCard(`Caption ${i + 1}`, c)));
    if (data.hashtags) frag.appendChild(sectionCard("Hashtags", hashtagsText(data.hashtags)));
    if (data.whatsapp) frag.appendChild(whatsappSection(data.whatsapp));
    if (data.promoPost) frag.appendChild(sectionCard("Promo post", data.promoPost));
  } else if (jobType === JOB_TYPES.POLISH_PRIVATE) {
    frag.appendChild(sectionCard("Polished draft", data.polished || ""));
    if (data.altVersion) frag.appendChild(sectionCard("Shorter alternative", data.altVersion));
  }
  return frag;
}

/** Plain-text rendering of a job result — copy-all and .txt export. */
function listingToText(l) {
  if (!l) return "";
  return [
    `Title: ${l.title || ""}`,
    `\n${l.description || ""}`,
    Array.isArray(l.bullets) ? `\nHighlights:\n${l.bullets.map((b) => `- ${b}`).join("\n")}` : "",
    Array.isArray(l.keywords) ? `\nKeywords: ${l.keywords.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function dataToText(jobType, data) {
  if (!data) return "";
  switch (jobType) {
    case JOB_TYPES.CAPTION_PACK:
      return [
        ...(data.captions || []).map((c, i) => `Caption ${i + 1}:\n${c}`),
        data.hashtags ? `Hashtags: ${hashtagsText(data.hashtags)}` : "",
      ].filter(Boolean).join("\n\n");
    case JOB_TYPES.LISTING_TEXT:
    case JOB_TYPES.LISTING_PHOTO:
      return listingToText(data);
    case JOB_TYPES.CAMPAIGN_KIT:
      return [
        listingToText(data.listing),
        ...(data.captions || []).map((c, i) => `Caption ${i + 1}:\n${c}`),
        data.hashtags ? `Hashtags: ${hashtagsText(data.hashtags)}` : "",
        data.whatsapp ? `WhatsApp broadcast:\n${data.whatsapp}` : "",
        data.promoPost ? `Promo post:\n${data.promoPost}` : "",
      ].filter(Boolean).join("\n\n");
    case JOB_TYPES.POLISH_PRIVATE:
      return [
        `Polished:\n${data.polished || ""}`,
        data.altVersion ? `Shorter alternative:\n${data.altVersion}` : "",
      ].filter(Boolean).join("\n\n");
    default:
      return "";
  }
}

function addResultCard({ jobType, source, data, error, info, queuedItem }) {
  const card = el("article", "result-card");
  const head = el("div", "result-head");
  head.append(el("h3", null, JOB_LABELS[jobType].title));
  if (data) head.append(copyBtn(dataToText(jobType, data)));
  // The badge states which engine served the result — so it appears
  // only when something actually served (or queued) the job, never on
  // an error/info card.
  if (queuedItem || source) {
    const badge = badgeFor(queuedItem ? "QUEUED" : source);
    head.append(el("span", `badge ${badge.cls}`, badge.label));
  }
  card.appendChild(head);

  if (queuedItem) {
    card.dataset.queueId = queuedItem.id;
    card.appendChild(el("p", "result-text",
      `Created while offline for “${queuedItem.product.name || "your product"}”. This job prefers the cloud, so it will run by itself when the connection returns.`));
    if (queuedItem.photoDropped) {
      card.appendChild(el("p", "result-text error-text",
        "Note: the attached photo was too large to keep in the on-device queue, so this job cannot run as-is. Re-attach the photo and run Listing from Photo again."));
    }
  } else if (error) {
    card.appendChild(el("p", `result-text ${info ? "info-text" : "error-text"}`, error));
  } else if (data) {
    card.appendChild(renderResultData(jobType, data));
  }
  card.appendChild(el("p", "result-time", new Date().toLocaleTimeString()));
  const stream = $("#results");
  stream.prepend(card);
  $("#resultsEmpty").hidden = true;
  return card;
}

function resolveQueuedCard(queueId) {
  document.querySelector(`[data-queue-id="${queueId}"]`)?.remove();
}

/* ------------------------------- queue ------------------------------- */

function persistQueue() {
  try {
    save(LS.queue, queue);
    return true;
  } catch {
    // localStorage quota: photos are the only heavy payload. Drop them
    // (flagged, and the seller is told) rather than losing the queue.
    let dropped = false;
    for (const item of queue) {
      if (item.photo) { item.photo = null; item.photoDropped = true; dropped = true; }
    }
    try { save(LS.queue, queue); } catch { /* queue lives in memory only */ }
    return !dropped;
  }
}

function enqueue(jobType, product, draft, photoObj) {
  const item = {
    id: uid("q"), jobType, product, draft,
    photo: photoObj || null, photoDropped: false, ts: Date.now(),
  };
  queue.push(item);
  persistQueue();
  renderQueue();
  addResultCard({ jobType, queuedItem: item });
  return item;
}

function renderQueue() {
  const panel = $("#queuePanel");
  panel.hidden = queue.length === 0;
  const list = $("#queueList");
  list.innerHTML = "";
  queue.forEach((item) => {
    const row = el("div", "queue-row");
    const cancel = el("button", "copy-btn", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => {
      queue = queue.filter((q) => q.id !== item.id);
      persistQueue();
      renderQueue();
      resolveQueuedCard(item.id);
    });
    row.append(
      el("span", null, `${JOB_LABELS[item.jobType].title} — ${item.product.name || "product"} · ${new Date(item.ts).toLocaleTimeString()}`),
      cancel
    );
    list.appendChild(row);
  });
}

async function flushQueue() {
  if (flushing || !effectiveOnline() || queue.length === 0) return;
  flushing = true;
  try {
    while (queue.length > 0 && effectiveOnline()) {
      const item = queue[0];
      await runJob(item.jobType, {
        product: item.product,
        draft: item.draft,
        photo: item.photo,
        photoDropped: item.photoDropped,
        fromQueue: true,
        queueId: item.id,
      });
      queue.shift();
      persistQueue();
      renderQueue();
    }
  } finally {
    flushing = false;
  }
}

/* ------------------------------ run jobs ----------------------------- */

function validateRun(jobType, product, draft) {
  if (jobType === JOB_TYPES.POLISH_PRIVATE) {
    if (!draft.trim()) {
      return "Paste your draft in the “Your own draft” box first — Private Polish rewrites words you already wrote, privately, on this device.";
    }
    return null;
  }
  if (!product.name) {
    $("#pName").focus();
    return "Give your product a name first — every copy job writes about it.";
  }
  if (jobType === JOB_TYPES.LISTING_PHOTO && !photo) {
    return "Listing from Photo needs a product photo. Add one in the form — or run Marketplace Listing, which works from your words alone.";
  }
  return null;
}

async function runJob(jobType, opts = {}) {
  const product = opts.product || readProduct();
  const draft = opts.draft ?? $("#draftText").value;
  const jobPhoto = opts.fromQueue ? (opts.photo || null) : photo;
  const route = JOB_ROUTES[jobType];

  if (!opts.fromQueue) {
    const problem = validateRun(jobType, product, draft);
    if (problem) { showNotice(problem); return; }
    clearNotice();
  }

  // A queued photo job whose photo did not survive localStorage quota.
  if (opts.fromQueue && jobType === JOB_TYPES.LISTING_PHOTO && opts.photoDropped) {
    addResultCard({
      jobType, info: true,
      error: "This queued job lost its photo (it was too large to keep on this device). Re-attach the photo and run Listing from Photo again — nothing was uploaded.",
    });
    resolveQueuedCard(opts.queueId);
    return;
  }

  if (!opts.fromQueue && route === "PREFER_IN_CLOUD" && !effectiveOnline()) {
    enqueue(jobType, product, draft, jobPhoto);
    return;
  }

  const btn = document.querySelector(`[data-run="${jobType}"]`);
  if (btn && !opts.fromQueue) { btn.disabled = true; btn.textContent = "Writing…"; }
  try {
    const { data, source } = await service.generate(jobType, {
      product,
      draft,
      image: jobPhoto,
    });
    addResultCard({ jobType, source, data });
    library.unshift({ id: uid("l"), jobType, source, data, product, ts: Date.now() });
    library = library.slice(0, LIBRARY_CAP);
    save(LS.library, library);
    renderLibrary();
  } catch (err) {
    console.error("[LapakKata]", err);
    if (!opts.fromQueue && route !== "ONLY_ON_DEVICE" && !effectiveOnline()) {
      // A device-first job that could not be served while offline:
      // hold it for the cloud rather than failing the seller.
      enqueue(jobType, product, draft, jobPhoto);
    } else {
      addResultCard({
        jobType,
        error: describeError(jobType, err),
        // Private Polish "failures" are the privacy boundary working —
        // present them as information, never as an error wall.
        info: jobType === JOB_TYPES.POLISH_PRIVATE,
      });
    }
  } finally {
    if (opts.fromQueue) resolveQueuedCard(opts.queueId);
    if (btn && !opts.fromQueue) { btn.disabled = false; btn.textContent = "Run"; }
  }
}

/* ------------------------------ library ------------------------------ */

function renderLibrary() {
  const list = $("#libraryList");
  list.innerHTML = "";
  $("#libraryEmpty").hidden = library.length > 0;
  library.slice(0, 20).forEach((item) => {
    const badge = badgeFor(item.source);
    const row = el("div", "library-row");

    const view = el("button", "copy-btn", "View");
    view.type = "button";
    view.addEventListener("click", () => {
      const card = addResultCard({ jobType: item.jobType, source: item.source, data: item.data });
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const del = el("button", "copy-btn", "Delete");
    del.type = "button";
    del.addEventListener("click", () => {
      library = library.filter((x) => x.id !== item.id);
      save(LS.library, library);
      renderLibrary();
    });

    row.append(
      el("span", "library-title", `${JOB_LABELS[item.jobType].title} — ${item.product.name || "product"}`),
      el("span", `badge ${badge.cls}`, badge.label),
      el("span", "library-date", new Date(item.ts).toLocaleString()),
      view,
      copyBtn(dataToText(item.jobType, item.data))
    );
    if (item.jobType === JOB_TYPES.CAMPAIGN_KIT && item.data?.whatsapp) {
      const wa = el("a", "wa-link library-wa", "WhatsApp ↗");
      wa.href = `https://wa.me/?text=${encodeURIComponent(item.data.whatsapp)}`;
      wa.target = "_blank"; wa.rel = "noopener";
      row.appendChild(wa);
    }
    row.appendChild(del);
    list.appendChild(row);
  });
}

function exportLibrary() {
  const text = library
    .map((item) => `# ${JOB_LABELS[item.jobType].title} — ${item.product.name || "product"} (${item.source})\n\n${dataToText(item.jobType, item.data)}`)
    .join("\n\n---\n\n");
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lapakkata-library.txt";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------- wiring ------------------------------ */

function buildJobCards() {
  const grid = $("#jobGrid");
  for (const jobType of Object.values(JOB_TYPES)) {
    const label = JOB_LABELS[jobType];
    const card = el("div", "job-card");
    card.append(
      el("h3", null, label.title),
      el("p", "job-blurb", label.blurb),
      el("p", "job-route", label.routeNote)
    );
    const btn = el("button", "run-btn", "Run");
    btn.type = "button";
    btn.dataset.run = jobType;
    btn.addEventListener("click", () => runJob(jobType));
    card.appendChild(btn);
    grid.appendChild(card);
  }
}

async function init() {
  buildJobCards();
  renderQueue();
  renderLibrary();
  refreshProductSelect();
  refreshConnChip();
  // Cards for jobs queued in a previous session get their placeholders back.
  for (const item of queue) addResultCard({ jobType: item.jobType, queuedItem: item });

  $("#enableDeviceBtn").addEventListener("click", async (e) => {
    const chip = $("#deviceChip");
    const btn = e.currentTarget;
    btn.disabled = true;
    chip.textContent = "Device AI: checking this browser…";
    const res = await service.probeDevice((v) => {
      chip.textContent = `Device AI: downloading the on-device model… ${Math.round(v * 100)}%`;
    });
    chip.textContent =
      res.state === "ready"
        ? "Device AI: ready · Gemini Nano in this browser"
        : res.state === "stub"
          ? "Device AI: demo stub"
          : "Device AI: not in this browser — the cloud serves every job. On-device AI lives in Chrome on desktop.";
    btn.disabled = false;
  });

  $("#pPhoto").addEventListener("change", async (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) { setPhoto(null); return; }
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      setPhoto({ dataUrl, mimeType: "image/jpeg" });
      clearNotice();
    } catch {
      setPhoto(null);
      showNotice("That photo could not be read. Please pick a JPEG or PNG image.");
    }
  });
  $("#removePhotoBtn").addEventListener("click", () => setPhoto(null));

  $("#saveProductBtn").addEventListener("click", (e) => {
    const p = readProduct();
    if (!p.name) { showNotice("Give your product a name before saving it."); $("#pName").focus(); return; }
    const products = load(LS.products, []);
    const idx = products.findIndex((x) => (x.name || "").toLowerCase() === p.name.toLowerCase());
    if (idx >= 0) products[idx] = p; else products.push(p);
    save(LS.products, products);
    refreshProductSelect();
    clearNotice();
    flashLabel(e.currentTarget, "Saved ✓", "Save product");
  });

  $("#productSelect").addEventListener("change", (e) => {
    const products = load(LS.products, []);
    const p = products[Number(e.target.value)];
    if (p) { fillProduct(p); clearNotice(); }
    e.target.value = "";
  });

  $("#simOffline").addEventListener("change", () => {
    refreshConnChip();
    flushQueue();
  });
  window.addEventListener("online", () => { refreshConnChip(); flushQueue(); });
  window.addEventListener("offline", refreshConnChip);

  $("#exportBtn").addEventListener("click", exportLibrary);
  $("#clearLibraryBtn").addEventListener("click", () => {
    library = [];
    save(LS.library, library);
    renderLibrary();
  });

  await bootService();
  flushQueue();
}

document.addEventListener("DOMContentLoaded", init);
