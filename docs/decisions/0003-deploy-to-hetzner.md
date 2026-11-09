# 0003 Deploy to the Hetzner server with rsync over SSH

- **Status:** Proposed. That the game is deployed by CI/CD to the user's Hetzner server at `poncho.forkfall.xyz` is
  Decided (user, 2026-11-09); how is the main session's proposal.
- **GDD:** GDD-TEC-08

## Context

The game is a static web build (`npm run build` writes `dist/`: one `index.html` and content-hashed files under
`assets/`, about 2 MB). The user has a Hetzner server and wants every change to reach `https://poncho.forkfall.xyz`
on its own.

## Decision

- `.github/workflows/deploy.yml` runs when the `check` workflow passes on a push to `main` (the gate, the build and the
  playtests), and by hand on `main`. It builds the commit the check passed, not a later one.
- It copies `dist/` with rsync over SSH into `releases/<UTC time>-<short sha>/` under `/var/www/poncho.forkfall.xyz`
  (the `DEPLOY_PATH` variable changes it), first hard-linking the previous release so only changed files travel. A
  `current` symlink is then replaced in one rename (`mv -T`), so no visitor sees half a release. The newest 5 releases
  are kept; a rollback points `current` back at an older one.
- Caddy serves `current` and gets the HTTPS certificate itself (`deploy/Caddyfile`). Hashed files are cached for a
  year, `index.html` is revalidated on every load.
- After the switch the workflow fetches the site and fails unless it serves the `index.html` just built.
- The SSH key is a deploy-only key for a user that can write only the site folder. The server's host key is pinned in
  a secret (`DEPLOY_KNOWN_HOSTS`), never trusted on first use. The secrets live in a GitHub `production` environment;
  without them the workflow skips with a notice, so `main` stays green before the server is set up.

## Alternatives

- **A Docker image (nginx plus `dist/`) pushed to a registry and pulled on the server:** more parts (a registry, a
  container runtime, a restart) for a folder of static files.
- **Pulling and building on the server:** puts Node and the whole toolchain on the server and builds code that CI did
  not check.
- **A static host (Cloudflare Pages, GitHub Pages):** not the user's server.

## Consequences

- The server needs only SSH, rsync and Caddy (or any web server pointed at `current`). Setup: `docs/deploy.md`.
- Offline play and installing as an app (GDD-TEC-03) are separate work; when a service worker comes, it must not be
  cached like the hashed files.
