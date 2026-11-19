# LapakKata — Selling words that work anywhere

An **on-device-first AI copywriting studio for Indonesian micro-sellers (UMKM)**,
built with **Firebase AI Logic hybrid inference**: short, structured jobs run on
**Gemini Nano in the browser** (free, private, offline), and capability-heavy
jobs escalate to **Gemini in the cloud** — chosen per job, and proven per result
by a badge that shows the SDK's real `inferenceSource`.

> *Lapak* = a market stall. *Kata* = words. LapakKata writes the words a stall needs.

Built for **#BuildHybridAI 2026** (Devpost × Firebase), Web/Chrome platform.

## The problem

Indonesia's tens of millions of micro-sellers sell through marketplaces and
social apps. Their bottleneck is rarely the product — it's the listing title,
the description, the caption, the promo message. Many work on intermittent,
expensive connections where cloud-only AI tools simply fail. LapakKata is
designed for that reality: the AI that can run locally does, and the cloud is
spent only where it earns its keep.

## What it does

Enter a product once (name, category, price, key details, tone, output
language — English or Bahasa Indonesia — and an optional photo), then run
one-tap copy jobs:

| Job | Routing | Why |
|---|---|---|
| **Caption Pack** — 3 captions + hashtags | `PREFER_ON_DEVICE` | Short, structured, frequent |
| **Marketplace Listing** — title, description, bullets, keywords | `PREFER_ON_DEVICE` | Single-turn structured text |
| **Listing from Photo** — full listing from a product photo | `PREFER_IN_CLOUD` | Photo understanding deserves the big model; device covers it offline |
| **Campaign Kit** — listing + captions + WhatsApp broadcast + promo post | `PREFER_IN_CLOUD` | Long, multi-part output |
| **Private Polish** — rewrite your own draft | `ONLY_ON_DEVICE` | Your draft **never leaves the device**; if no device model exists, nothing is uploaded |

Every result is structured JSON (the same schema is sent as the cloud
`responseSchema` and the on-device `responseConstraint`), rendered as
copy-ready sections with per-section copy buttons, a WhatsApp deep link for
broadcast copy, and a served-by badge: **ON-DEVICE** or **CLOUD**, read from
`response.inferenceSource` — ground truth, not a guess.

Also included: an offline queue (cloud-first jobs created offline run
automatically on reconnect), a local library (products and kits persist in
`localStorage` — no account, no server), .txt export, and a "Simulate
offline" toggle that makes the hybrid behavior easy to demonstrate.

## How Firebase AI Logic is used

- `firebase/ai`: `getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })`
  (Gemini Developer API; limited-use tokens satisfy App Check replay protection).
- Hybrid models via `getGenerativeModel(ai, { mode: InferenceMode.*, inCloudParams, onDeviceParams })`
  with the per-job routing table in `js/ai-service.js` (`JOB_ROUTES` in `js/prompts.js`).
- `model.initializeDeviceModel()` from a user gesture warms up Gemini Nano
  with download progress in the header chip.
- `model.generateContent()` for every job; multimodal inline-data parts for
  the photo job (JPEG/PNG, as on-device inference requires).
- **App Check** protects the project: reCAPTCHA Enterprise provider when a
  site key is configured; the debug provider for local development
  (tokens live only in a gitignored local file — never in this repo).

## Run it

No build step. Serve the folder statically and open it:

```bash
npx serve .        # or: python3 -m http.server 8080
# then open http://localhost:8080  (on-device AI needs Chrome on desktop, v139+)
```

Without a Firebase config, the app runs in **demo mode** on a clearly
labeled local stub (`js/stub-service.js`) so every flow can be exercised.

> **This repo is wired to the LapakKata Firebase project**
> (`lapakkata-eb94e`, AI Logic on the Gemini Developer API, App Check via
> reCAPTCHA Enterprise) — open the hosted page and it runs live. To use
> your own project instead, replace the one file below.

### Connect your Firebase project

1. Firebase Console → create a project → **AI Logic → Get started** →
   choose the **Gemini Developer API**. (This provisions AI Logic; config
   alone is not enough. CLI equivalent/check:
   `npx -y firebase-tools@latest init ailogic`.)
2. Register a **Web app** and paste its config into `js/firebase-config.js`
   (the one clearly-marked file).
3. App Check: for a hosted site, create a reCAPTCHA Enterprise key,
   register the app under **Security → App Check**, and put the site key
   in `APP_SETTINGS.recaptchaSiteKey`. For local development only, copy
   `js/firebase-config.local.example.js` to `js/firebase-config.local.js`
   and use a registered debug token there.
4. Optional hosting: `firebase deploy --only hosting` (config in
   `firebase.json`), or any static host.

**Judging note:** on browsers without Gemini Nano (anything but Chrome
desktop ≥139 with the Prompt API available), every job is served by the
cloud model and the badge honestly says CLOUD — that fallback *is* the
hybrid design working as intended.

## Project layout

```
index.html            UI shell (import map pins the Firebase SDK CDN)
styles.css            Product styling
js/
  firebase-config.js  ← the one file to fill in (config + settings)
  ai-service.js       Firebase AI Logic integration (real SDK call path)
  prompts.js          Job definitions: routing, JSON schemas, prompts
  stub-service.js     Local demo stub (same interface, clearly separate)
  app.js              UI controller: forms, queue, library, badges
firebase.json         Firebase Hosting config
```

## License

MIT — see [LICENSE](LICENSE).
