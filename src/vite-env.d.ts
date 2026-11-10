/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "mock" forces the mock seam even when a URL is set — src/lib/data/index.ts:390. */
  readonly VITE_DATA_SEAM?: "mock";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * SOLO, 2026-09-13. The avatar file names found in `public/images/` at build time, filtered and
 * ordered numerically — served by the `calechip-avatar-images` plugin in `vite.config.ts`.
 */
declare module "virtual:avatar-images" {
  const names: readonly string[];
  export default names;
}

/** The deployed version (newest git tag), injected at build time — `readAppVersion` in `vite.config.ts`. */
declare const __APP_VERSION__: string;
