/**
 * firebase-config.js — THE one place Firebase settings live.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  STATUS: wired to the Firebase project `lapakkata-eb94e`             │
 * │  (Spark plan, AI Logic provisioned with the Gemini Developer API,    │
 * │  App Check registered with the reCAPTCHA Enterprise provider).       │
 * │  To re-point the app, replace the values below with the config from  │
 * │  your Firebase project: Firebase Console → Project settings →        │
 * │  "Your apps" → Web app → SDK setup and configuration.                │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * The Firebase web config is a client identifier, not a private secret —
 * but per the contest rules we still never commit *other* keys here.
 *
 * App Check debug tokens are SECRETS (Google's firebase-ai-logic-basics
 * skill: never hardcode or commit them). A debug token belongs ONLY in
 * `firebase-config.local.js` (gitignored). See
 * `firebase-config.local.example.js`.
 */

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDgJ57fu--fB6x2V0QQPSMNYY3dSG6gSqE",
  authDomain: "lapakkata-eb94e.firebaseapp.com",
  projectId: "lapakkata-eb94e",
  storageBucket: "lapakkata-eb94e.firebasestorage.app",
  messagingSenderId: "34384258412",
  appId: "1:34384258412:web:8f80bb2cad57f26a52bf49",
};

export const APP_SETTINGS = {
  /**
   * Cloud-hosted fallback model, used via inCloudParams for every hybrid
   * model instance. Current per Firebase's hybrid configuration docs
   * (default cloud fallback from JS SDK v13). Re-verify at integration
   * time against https://firebase.google.com/docs/ai-logic/models —
   * never use Gemini 1.x/2.x names (deprecated). Planned upgrade: source
   * this from Firebase Remote Config (parameter `cloud_model`) so the
   * model can be switched without a redeploy.
   */
  cloudModel: "gemini-3.5-flash-lite",

  /**
   * App Check for the hosted site (Plan A): reCAPTCHA Enterprise site
   * key. Site keys are public and safe to commit. Leave null to use the
   * debug-token flow instead (local development / Plan B).
   */
  recaptchaSiteKey: "6LfveCcuAAAAAKp2ltRiOUocTuDoGyH6O7M0HqTm",

  /**
   * App Check debug token (Plan B). DO NOT put a real token here.
   * Put it in firebase-config.local.js (gitignored) — see the example
   * file. null = auto-generate on localhost (token prints to console,
   * then register it under Firebase Console → App Check → Manage
   * debug tokens).
   */
  appCheckDebugToken: null,
};

/** True once a real Firebase project config has been pasted in. */
export function isFirebaseConfigured(cfg = FIREBASE_CONFIG) {
  return (
    typeof cfg.apiKey === "string" &&
    cfg.apiKey.length > 0 &&
    cfg.apiKey !== "REPLACE_ME" &&
    typeof cfg.projectId === "string" &&
    cfg.projectId !== "REPLACE_ME"
  );
}
