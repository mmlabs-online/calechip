import { useEffect, useState } from "react";

// The version shown in the sidebar footer.
//
// THE RELEASE TAG IS ONLY KNOWN AT DEPLOY TIME, NOT AT BUILD TIME. `build-image.yml` builds the
// image when a commit is pushed, before any tag exists, and `release.yml` promotes that same image
// to `:vX.Y.Z` by digest without rebuilding (CICD-04). So the tag cannot be baked into the bundle.
// Instead the container writes `/version.json` at start from `CALECHIP_VERSION` (Dockerfile `CMD`),
// which the deployment sets from `release.env`, and the page reads it here.
//
// Until that answers — and under `pnpm dev` or `vite preview`, where there is no such file — the
// build-time `__APP_VERSION__` is shown (`readAppVersion` in `vite.config.ts`).
const VERSION_URL = "/version.json";
const VERSION_PATTERN = /^[0-9A-Za-z.+-]{1,64}$/;

export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const response = await fetch(VERSION_URL, { cache: "no-store" });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const version =
      typeof body === "object" && body !== null ? (body as { version?: unknown }).version : null;
    return typeof version === "string" && VERSION_PATTERN.test(version) ? version : null;
  } catch {
    // No file (the SPA fallback answers with index.html, which is not JSON), or no network.
    return null;
  }
}

export function useAppVersion(): string {
  const [version, setVersion] = useState<string>(__APP_VERSION__);
  useEffect(() => {
    let live = true;
    void fetchDeployedVersion().then((deployed) => {
      if (live && deployed) setVersion(deployed);
    });
    return () => {
      live = false;
    };
  }, []);
  return version;
}
