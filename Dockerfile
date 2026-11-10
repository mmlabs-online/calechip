# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv  (the anon key is public by design and ships in the bundle — .env.example)
#
# CaleChip is a static SPA (React + Vite, `BrowserRouter`). The build stage produces `dist/`; the
# runner is nginx on port 3000 with an SPA fallback. There is no Node process at runtime.
#
# EVERY `VITE_*` VALUE IS BAKED INTO THE BUNDLE AT BUILD TIME. The server that pulls this image
# cannot change them — a different Supabase project means a different image. They are public by
# design (see `.env.example`); SUPABASE_SERVICE_ROLE_KEY must never be passed here.
#
# Build:  docker build --secret id=env,src=.env.local -t calechip:v1.0 .

ARG NODE_VERSION=22

# --- deps: the full dependency tree, devDependencies included (the build needs them) ------------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- build ---------------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
RUN corepack enable

# The `VITE_*` values come from a BuildKit secret — normally `.env.local` itself:
#
#     docker build --secret id=env,src=.env.local -t calechip:v1.0 .
#
# A secret is mounted for the one RUN below and is never written to a layer, so the file (and any
# non-VITE value in it) does not end up in the image. Only what the source actually reads as
# `import.meta.env.VITE_*` is inlined into the bundle — which is public by design.
#
# The ARGs remain for CI or one-off overrides. A variable defined in the secret file wins over the
# same --build-arg; a variable the file does not define is taken from the --build-arg.
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_DATA_SEAM=""
ARG VITE_REQUIRE_EMAIL_CONFIRMATION=""
# The build-time fallback for the sidebar version, e.g. sha-1a2b3c4 (build-image.yml). The release tag
# is NOT known here — it is set at container start, see CALECHIP_VERSION below.
ARG VITE_APP_VERSION=""

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# An unset VITE_SUPABASE_URL does not fail the Vite build — `src/lib/data/index.ts` silently falls
# back to the in-memory mock, which accepts writes and loses them. For an image that is pushed and
# deployed, that is a broken release that looks healthy, so refuse it unless the mock was asked for.
#
# `sed` strips CR so a file saved on Windows with CRLF does not put `\r` at the end of every value.
RUN --mount=type=secret,id=env,required=false \
    export VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY VITE_DATA_SEAM VITE_REQUIRE_EMAIL_CONFIRMATION VITE_APP_VERSION; \
    if [ -f /run/secrets/env ]; then \
      set -a; eval "$(sed 's/\r$//' /run/secrets/env)"; set +a; \
    fi; \
    if [ -z "$VITE_SUPABASE_URL" ] && [ "$VITE_DATA_SEAM" != "mock" ]; then \
      echo "VITE_SUPABASE_URL is empty: pass --secret id=env,src=.env.local (or --build-arg VITE_SUPABASE_URL=... and VITE_SUPABASE_ANON_KEY), or VITE_DATA_SEAM=mock for a fixture build." >&2; \
      exit 1; \
    fi; \
    pnpm run build

# --- runner: nginx, non-root, port 3000 ----------------------------------------------------------
FROM nginx:alpine AS runner

# nginx reads neither of these; they are set so the container matches the other services on the
# network. The port is fixed in docker/nginx.conf.
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Drop the stock entrypoint scripts (they rewrite /etc/nginx as root) and the default site, and
# give the unprivileged `nginx` user the paths it writes at runtime.
RUN rm -f /etc/nginx/conf.d/default.conf /docker-entrypoint.d/* \
 && mkdir -p /var/cache/nginx /tmp/nginx \
 && chown -R nginx:nginx /var/cache/nginx /tmp/nginx

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

USER nginx
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/healthz || exit 1

# THE RELEASE VERSION IS SET AT START, NOT AT BUILD. The image is built before its tag exists and is
# promoted to :vX.Y.Z by digest without rebuilding (CICD-04), so the tag can only reach the page at
# runtime. The deployment passes CALECHIP_VERSION (from release.env); this writes it to
# /tmp/nginx/version.json, which nginx serves as /version.json and the sidebar footer reads. Anything
# but [0-9A-Za-z.+-] is dropped, so the value can never break the JSON. Unset or dropped: the footer
# shows the build-time VITE_APP_VERSION instead.
CMD ["sh", "-c", "v=\"${CALECHIP_VERSION:-}\"; case \"$v\" in *[!0-9A-Za-z.+-]*) v='' ;; esac; printf '{\"version\":\"%s\"}\\n' \"$v\" > /tmp/nginx/version.json && exec nginx -g 'daemon off;'"]
