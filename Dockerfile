# The game's image (GDD-TEC-08): the built `dist/` served by Caddy on port 80, without TLS. The project's edge Caddy
# (deploy/compose.yaml) holds 80 and 443 and passes requests to it. Build `dist/` first: `npm ci && npm run build`
# (CI does, and adds the live image's hashed files to it; docs/deploy.md).
FROM caddy:2-alpine

COPY deploy/web.Caddyfile /etc/caddy/Caddyfile
COPY dist/ /srv/

# The commit, read by deploy/server-deploy.sh (`live`) to tell which commit is live.
ARG REVISION=unknown
LABEL org.opencontainers.image.revision=$REVISION \
      org.opencontainers.image.source=https://github.com/gewubuntu/okPonchoSieteVidas

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --start-interval=1s \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
