# Deploying to poncho.forkfall.xyz

The game is deployed to the Hetzner server by `.github/workflows/deploy.yml` every time the `check` workflow passes
on `main` (GDD-TEC-08, ADR 0003). This page is the one-time setup. Commands run on the server as root unless noted.

## 1. DNS

At the DNS provider of `forkfall.xyz`, add an `A` record `poncho` pointing at the server's IPv4 address (and an `AAAA`
record for its IPv6 address, if it has one). Check with `dig +short poncho.forkfall.xyz`.

## 2. Firewall

Ports 22 (SSH), 80 and 443 must be open, in the Hetzner Cloud firewall if one is attached and in `ufw` if it is on:

```sh
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
```

## 3. A deploy user and the site folder

```sh
apt-get update && apt-get install -y rsync
adduser --disabled-password --gecos "" deploy
mkdir -p /var/www/poncho.forkfall.xyz/releases
chown -R deploy:deploy /var/www/poncho.forkfall.xyz
```

## 4. An SSH key for GitHub Actions

On your own machine (not the server), make a key used only for deploying:

```sh
ssh-keygen -t ed25519 -N "" -C "github-actions deploy poncho" -f poncho_deploy
```

Put the public half on the server:

```sh
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo 'ssh-ed25519 AAAA... github-actions deploy poncho' >> /home/deploy/.ssh/authorized_keys   # the line in poncho_deploy.pub
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
```

Check from your machine: `ssh -i poncho_deploy deploy@<server-ip> echo ok`.

## 5. Caddy

```sh
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
```

Copy `deploy/Caddyfile` from this repository to `/etc/caddy/Caddyfile` (or, if Caddy already serves other sites,
append its `poncho.forkfall.xyz { ... }` block), then `systemctl reload caddy`. Caddy gets the HTTPS certificate on
the first request once DNS points at the server.

Already running nginx instead? Point a `server` block for `poncho.forkfall.xyz` at
`/var/www/poncho.forkfall.xyz/current`, get a certificate with `certbot --nginx -d poncho.forkfall.xyz`, and set
`Cache-Control: public, max-age=31536000, immutable` on `/assets/` and `no-cache` on `index.html`.

## 6. GitHub secrets

In the repository: Settings, Environments, New environment `production` (optionally limit it to the `main` branch).
Add these environment secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | the server's IP address or host name |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | the whole private key file `poncho_deploy` |
| `DEPLOY_KNOWN_HOSTS` | the output of `ssh-keyscan -p <port> -t ed25519 <host>`, run from your machine with exactly the `DEPLOY_HOST` value and the SSH port (22 unless `DEPLOY_PORT` says otherwise); ssh matches the line by that name and port. Compare its key with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server |
| `DEPLOY_PORT` | optional, only if SSH is not on port 22 |

An environment variable `DEPLOY_PATH` changes the site folder from `/var/www/poncho.forkfall.xyz`. Then delete the
local `poncho_deploy` private key, or keep it somewhere safe.

## 7. First deploy

Actions, `deploy`, Run workflow on `main`. Every run deploys `main`'s newest commit, and only if its `check` run passed and it is not already live;
it builds, uploads, switches `current` and checks that `https://poncho.forkfall.xyz` serves the new `index.html`. From then on every green push to `main` deploys by itself. A run whose commit is already live builds nothing but still checks that the site serves it, so re-running a deploy whose smoke test failed tests the site again.
Until the secrets exist the workflow passes with a "Deploy skipped" notice.

Each release also holds a `.release-files` list of its own hashed files. The next deploy uses it to keep those files
beside its own for one release, so a tab opened before a deploy can still load a world's art; Caddy does not serve it.

## Rollback

```sh
cd /var/www/poncho.forkfall.xyz
ls releases                                   # newest last
ln -sfn releases/<older-release> current.tmp && mv -T current.tmp current
```

The next deploy from `main` replaces it again, so revert the bad commit on `main` too.
