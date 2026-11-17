# Deploying to poncho.forkfall.xyz

The game is deployed to the Hetzner server by `.github/workflows/deploy.yml` every time the `check` workflow passes
on `main` (GDD-TEC-08, ADR 0003): CI builds a Docker image, pushes it to `ghcr.io`, and over SSH has the server pull it
and swap the game's container. On the server the game is its own Compose project, `poncho`, in `/opt/poncho`: the
game's container `web` and an edge Caddy `caddy` on ports 80 and 443. It shares nothing with other projects on the
host. This page is the one-time setup. Commands run on the server as root (or with `sudo`) unless noted.

## 1. DNS

At the DNS provider of `forkfall.xyz`, add an `A` record `poncho` pointing at the server's IPv4 address and an `AAAA`
record for its IPv6 address. Check with `dig +short poncho.forkfall.xyz A` and `AAAA`.

## 2. Firewall and ports

Ports 22 (SSH), 80 and 443 (TCP, and UDP 443 for HTTP/3) must be open, in the Hetzner Cloud firewall if one is attached
and in `ufw` if it is on. Nothing else on the host may publish 80 or 443: `ss -ltn | grep -E ':(80|443) '` lists
nothing before the first start.

```sh
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
```

## 3. Docker

Docker Engine with the Compose plugin (`docker compose version`), from Docker's apt repository if missing.

## 4. The deploy user and the project folder

The deploy user is the account GitHub Actions logs in as. It needs to be in the `docker` group and nothing else. On the
server this is the existing account `forkfall` (in the `docker` group already); the commands below use it. A server
without such an account can make one: `adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy`, and
use `deploy` wherever `forkfall` is written here.

```sh
install -d -o forkfall -g forkfall -m 755 /opt/poncho
```

From a checkout of this repository, copy the server files (root-owned, so the deploy user cannot change them; it
writes only `.env` and its lock file):

```sh
install -o root -g root -m 644 deploy/compose.yaml deploy/Caddyfile /opt/poncho/
install -o root -g root -m 755 deploy/server-deploy.sh /opt/poncho/deploy.sh
```

Start the edge Caddy once; it fetches the HTTPS certificate on the first request (until the first deploy it answers
502):

```sh
cd /opt/poncho && sudo -u forkfall docker compose up -d caddy
```

## 5. An SSH key for GitHub Actions

On your own machine (not the server), make a key used only for deploying:

```sh
ssh-keygen -t ed25519 -N "" -C "github-actions deploy poncho" -f poncho_deploy
```

Put the public half on the server, limited to the deploy script. The deploy user is in the `docker` group, which is
as strong as root (and `forkfall` also has `sudo`), so this key must never get a shell. The restriction is on this
key's line only; the account's own login keys in the same file keep working as before:

```sh
install -d -m 700 -o forkfall -g forkfall /home/forkfall/.ssh
echo 'command="/opt/poncho/deploy.sh",restrict ssh-ed25519 AAAA... github-actions deploy poncho' >> /home/forkfall/.ssh/authorized_keys   # the line in poncho_deploy.pub
chown forkfall:forkfall /home/forkfall/.ssh/authorized_keys && chmod 600 /home/forkfall/.ssh/authorized_keys
```

Check from your machine: `ssh -i poncho_deploy forkfall@<server-ip> live` prints nothing (or the live commit), and
`ssh -i poncho_deploy forkfall@<server-ip> id` prints the usage and fails.

## 6. GitHub secrets

In the repository: Settings, Environments, New environment `production` (optionally limit it to the `main` branch).
Add these environment secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | the server's IP address or host name |
| `DEPLOY_USER` | the deploy user, `forkfall` |
| `DEPLOY_SSH_KEY` | the whole private key file `poncho_deploy` |
| `DEPLOY_KNOWN_HOSTS` | the output of `ssh-keyscan -p <port> -t ed25519 <host>`, run from your machine with exactly the `DEPLOY_HOST` value and the SSH port (22 unless `DEPLOY_PORT` says otherwise); ssh matches the line by that name and port. Compare its key with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server |
| `DEPLOY_PORT` | optional, only if SSH is not on port 22 |

No registry secret is needed: the workflow pushes with its own `GITHUB_TOKEN` and hands that token to the server on
stdin for the pull; it expires with the job. The deploy script logs the deploy user in to `ghcr.io` with it and out
again when it ends, so a login of that account's own to `ghcr.io` is removed by each deploy. Then delete the local `poncho_deploy` private key, or keep it somewhere
safe.

## 7. First deploy

Actions, `deploy`, Run workflow on `main`. Every run deploys `main`'s newest commit, and only if its `check` run passed
and it is not already live; it builds, pushes the image, has the server swap to it and checks that
`https://poncho.forkfall.xyz` serves the new `index.html`. From then on every green push to `main` deploys by itself.
A run whose commit is already live builds nothing but still checks that the site serves it, so re-running a deploy
whose smoke test failed tests the site again. Until the secrets exist the workflow passes with a "Deploy skipped"
notice.

The first push creates the package `okponchosietevidas` under the account's packages, private and linked to the
repository, so the workflow's token can pull it.

Each image also holds a `.release-files` list of its own hashed files. The next deploy copies those files into its
image beside its own, so a tab opened before a deploy can still load a world's art; the web server does not serve it.

## Rollback

The server keeps the newest 5 images:

```sh
docker image ls ghcr.io/gewubuntu/okponchosietevidas      # the tags are commits
sudo -u forkfall /opt/poncho/deploy.sh deploy <older commit sha>
```

The next deploy from `main` replaces it again, so revert the bad commit on `main` too.

## Changing the server files

A deploy changes only the game's image. After a change to `deploy/compose.yaml`, `deploy/Caddyfile` or
`deploy/server-deploy.sh`, copy it as in step 4, then:

```sh
cd /opt/poncho
sudo -u forkfall docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile   # Caddyfile
sudo -u forkfall docker compose up -d                                                    # compose.yaml
```

Logs: `docker compose logs -f caddy web` in `/opt/poncho`.
