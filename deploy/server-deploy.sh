#!/bin/sh
# The server's deploy script (GDD-TEC-08), installed as /opt/poncho/deploy.sh beside compose.yaml and Caddyfile.
# The deploy SSH key may run only this script (`command="/opt/poncho/deploy.sh",restrict` in authorized_keys), which
# reads the requested command from SSH_ORIGINAL_COMMAND (or its arguments when run by hand):
#   live          print the commit of the running game container (empty if none)
#   index         print the running game's index.html (the workflow's smoke test compares it)
#   deploy <sha>  pull the image of that commit (a registry token on stdin, optional), swap the game's container to
#                 it, put the previous one back if the new one does not start healthy, keep the newest images
set -eu
set -f # the command words are split below; never expand them as globs

IMAGE=ghcr.io/gewubuntu/okponchosietevidas
KEEP_IMAGES=5
REGISTRY=ghcr.io

cd "$(dirname "$0")"

usage() {
  echo "usage: live | index | deploy <40-hex commit sha>" >&2
  exit 2
}

# shellcheck disable=SC2086 # split into words on purpose; globbing is off
set -- ${SSH_ORIGINAL_COMMAND:-$*}

running() { docker compose ps -q web 2>/dev/null; }

case "${1:-}" in
  live)
    [ $# -eq 1 ] || usage
    id=$(running)
    [ -n "$id" ] || exit 0
    docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$id"
    ;;

  index)
    [ $# -eq 1 ] || usage
    docker compose exec -T web cat /srv/index.html
    ;;

  deploy)
    [ $# -eq 2 ] || usage
    sha=$2
    case "$sha" in
      *[!0-9a-f]*) usage ;;
    esac
    [ ${#sha} -eq 40 ] || usage

    # One deploy at a time, also against one started by hand.
    exec 9>.deploy.lock
    flock 9

    token=""
    [ -t 0 ] || token=$(cat)
    if [ -n "$token" ]; then
      # The login goes to a Docker config of this run's own, removed when it ends, never to the deploy user's own
      # ~/.docker, so a registry login that account holds for anything else is left alone.
      DOCKER_CONFIG=$(mktemp -d)
      export DOCKER_CONFIG
      trap 'rm -rf "$DOCKER_CONFIG"' EXIT
      printf '%s' "$token" | docker login "$REGISTRY" -u deploy --password-stdin >/dev/null
    fi
    if ! docker pull -q "$IMAGE:$sha"; then
      # A rollback by hand on the server can use an image that is still here.
      docker image inspect "$IMAGE:$sha" >/dev/null 2>&1 || { echo "no image $IMAGE:$sha" >&2; exit 1; }
      echo "pull failed; using the local image $IMAGE:$sha" >&2
    fi

    previous=$(sed -n 's/^PONCHO_TAG=//p' .env 2>/dev/null || true)
    printf 'PONCHO_TAG=%s\n' "$sha" > .env.tmp && mv .env.tmp .env
    if ! docker compose up -d --no-deps --wait --wait-timeout 60 web; then
      echo "the new container did not start healthy" >&2
      if [ -n "$previous" ]; then
        printf 'PONCHO_TAG=%s\n' "$previous" > .env.tmp && mv .env.tmp .env
        docker compose up -d --no-deps --wait --wait-timeout 60 web || true
        echo "put $previous back" >&2
      fi
      exit 1
    fi
    echo "live: $sha"

    # Keep the newest images for a rollback (`deploy <older sha>`); never the live one.
    docker image ls "$IMAGE" --format '{{.CreatedAt}}|{{.Tag}}' | sort -r | tail -n +$((KEEP_IMAGES + 1)) |
      cut -d'|' -f2 | while read -r tag; do
        [ "$tag" = "$sha" ] || docker image rm "$IMAGE:$tag" >/dev/null || true
      done
    ;;

  *)
    usage
    ;;
esac
