# 0003 Deploy to the Hetzner server as a Docker image behind the project's own Caddy

- **Status:** Decided in outline: CI/CD to the user's Hetzner server at `poncho.forkfall.xyz` (user, 2026-11-09);
  a Docker image built by CI, pushed to `ghcr.io` and pulled by the server over SSH, behind its own Caddy and
  independent of any other project on the server (user, 2026-11-10). The details below are the main session's
  proposal.
- **GDD:** GDD-TEC-08

## Context

The game is a static web build (`npm run build` writes `dist/`: one `index.html` and content-hashed files under
`assets/`, about 2 MB). The user's Hetzner server runs Docker and hosts other projects; the first proposal (rsync into
release folders served by a Caddy on the host) found ports 80 and 443 held by another project's Caddy container. The
user wants a Docker deploy that runs on its own, with no changes to the other projects.

## Decision

- `.github/workflows/deploy.yml` runs when the `check` workflow passes on a push to `main` (the gate, the build and the
  playtests), and by hand. Every run deploys `main`'s newest commit, and only if its `check` passed: check runs can
  finish out of order or be re-run, and a waiting deploy can be replaced by a later one, so an older build must never
  replace a newer one and the newest must not be left out. A run whose commit is already live (the server's `live`
  answer) builds and pushes nothing, and only runs the smoke test below.
- It builds `dist/` and a Docker image of it (`Dockerfile`: `caddy:2-alpine` serving `/srv` on port 80 without TLS,
  `deploy/web.Caddyfile`), labelled and tagged with the commit, and pushes it to
  `ghcr.io/gewubuntu/okponchosietevidas`. The live image's own hashed files (listed in its `/srv/.release-files`) go
  into the new image beside the build's, since a tab opened before a deploy loads a world's art only when its first
  level starts.
- On the server, `/opt/poncho` holds a Compose project `poncho` (`deploy/compose.yaml`): `web`, the game's image, and
  `caddy`, an edge Caddy on ports 80 and 443 that fetches and renews the HTTPS certificate itself, compresses, and
  passes requests to `web` (`deploy/Caddyfile`). While `web` is swapped (about a second) the edge holds requests for
  up to 10 s instead of failing them. Hashed files are cached for a year, `index.html` is revalidated on every load.
- The workflow runs `deploy <sha>` over SSH, with its own short-lived `GITHUB_TOKEN` on stdin for the registry pull.
  `deploy/server-deploy.sh` (installed as `/opt/poncho/deploy.sh`) logs in (in a Docker config of its own, removed
  when it ends, so the deploy user's own logins are untouched), pulls, writes the tag to `.env`, swaps `web` and waits
  for its health check, puts the previous tag back if the new container does not start healthy, and keeps the newest
  5 images for a rollback (`deploy <older sha>`, by hand on the server too).
- The deploy SSH key may run only that script (`command=...,restrict` in `authorized_keys`), which accepts `live`,
  `index` and `deploy <40-hex sha>` and nothing else: the deploy user (on the server the existing account `forkfall`)
  is in the `docker` group, which is as strong as root. The server's host key is pinned in a secret (`DEPLOY_KNOWN_HOSTS`), never trusted on first use. The secrets
  live in a GitHub `production` environment; without them the workflow skips with a notice, so `main` stays green
  before the server is set up.
- After the swap the workflow fetches the site and fails unless it serves the `index.html` just built (when the commit
  was already live, the running container's `index.html`, from `index`).

## Alternatives

- **rsync over SSH into release folders, a `current` link, Caddy on the host** (the first proposal, PR #88): no
  registry or container runtime, but the server's ports 80 and 443 were held by another project's Caddy container.
- **Routing through the other project's Caddy** (an import folder in its Caddyfile): fewer containers, but the game
  would depend on another project's configuration; the user wants the two independent.
- **Building the image on the server:** puts the build on the server and builds code that CI did not check.
- **A static host (Cloudflare Pages, GitHub Pages):** not the user's server.

## Consequences

- The server needs Docker with Compose and an SSH login for the deploy user. Setup: `docs/deploy.md`.
- The project's Caddy owns ports 80 and 443 on the server; another project that wants them must sit behind it or
  move.
- A change to `deploy/compose.yaml` or `deploy/Caddyfile` is copied to the server by hand (`docs/deploy.md`); the
  deploy changes only the game's image.
- Offline play and installing as an app (GDD-TEC-03) are separate work; when a service worker comes, it must not be
  cached like the hashed files.
