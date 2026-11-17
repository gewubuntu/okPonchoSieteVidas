// GDD-TEC-08: the server's deploy script (deploy/server-deploy.sh), run against a fake `docker` that logs its calls.
// The deploy SSH key may run only this script, so it must refuse every command but its own.
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../deploy/server-deploy.sh', import.meta.url));
const IMAGE = 'ghcr.io/gewubuntu/okponchosietevidas';
const SHA = 'a'.repeat(40);
const OLD = 'b'.repeat(40);

// Answers by the first words of the call; FAKE_UP_FAIL makes `compose up` fail for that tag.
const FAKE_DOCKER = `#!/bin/sh
echo "$*" >> "$FAKE_LOG"
case "$*" in
  login*) cat > "$FAKE_DIR/../token"; printf '%s' "\${DOCKER_CONFIG:-}" > "$FAKE_DIR/../config-dir" ;;
  "compose ps -q web") printf '%s' "$FAKE_PS" ;;
  inspect*) echo "$FAKE_REV" ;;
  "pull"*) exit "\${FAKE_PULL_RC:-0}" ;;
  "image inspect"*) exit "\${FAKE_LOCAL_RC:-0}" ;;
  "compose up"*) grep -q "PONCHO_TAG=\${FAKE_UP_FAIL:-none}" .env && exit 1; exit 0 ;;
  "image ls"*) printf '%b' "$FAKE_IMAGES" ;;
esac
exit 0
`;

let dirs = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'poncho-deploy-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin', 'docker'), FAKE_DOCKER);
  chmodSync(join(dir, 'bin', 'docker'), 0o755);
  copyFileSync(SCRIPT, join(dir, 'deploy.sh'));
  return dir;
}

function run(dir, command, { input = '', env = {} } = {}) {
  const r = spawnSync('sh', [join(dir, 'deploy.sh')], {
    cwd: dir,
    input,
    encoding: 'utf8',
    env: {
      PATH: `${join(dir, 'bin')}:${process.env['PATH']}`,
      FAKE_LOG: join(dir, 'docker.log'),
      FAKE_DIR: join(dir, 'bin'),
      SSH_ORIGINAL_COMMAND: command,
      ...env,
    },
  });
  const log = existsSync(join(dir, 'docker.log')) ? readFileSync(join(dir, 'docker.log'), 'utf8').trim().split('\n') : [];
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, log };
}

describe('GDD-TEC-08 server deploy script', () => {
  it('refuses every command but live, index and deploy <sha>, before calling docker', () => {
    const dir = setup();
    // With globbing on, `deploy a*` would become `deploy <a file named like a sha>`.
    writeFileSync(join(dir, SHA), '');
    for (const cmd of [
      '',
      'id',
      'sh -c id',
      'live now',
      'index /etc/passwd',
      'deploy',
      `deploy ${SHA} extra`,
      'deploy abc',
      `deploy ${SHA.toUpperCase()}`,
      `deploy ${SHA.slice(1)};`,
      `deploy ${'a'.repeat(41)}`,
      'deploy $(id)',
      'deploy *',
      'deploy a*',
      'deploy ../../etc',
    ]) {
      const r = run(dir, cmd);
      expect(r.status, cmd).toBe(2);
      expect(r.log, cmd).toEqual([]);
    }
  });

  it('live prints the running container commit, or nothing', () => {
    const dir = setup();
    expect(run(dir, 'live', { env: { FAKE_PS: 'c0ffee', FAKE_REV: SHA } }).stdout.trim()).toBe(SHA);
    const none = run(dir, 'live', { env: { FAKE_PS: '' } });
    expect(none.status).toBe(0);
    expect(none.stdout).toBe('');
  });

  it('deploy logs in with the token from stdin, pulls, swaps web and keeps the newest 5 images', () => {
    const dir = setup();
    writeFileSync(join(dir, '.env'), `PONCHO_TAG=${OLD}\n`);
    const tags = ['1', '2', '3', '4', '5', '6', '7'].map((n) => n.repeat(40));
    // Newest first after sort: SHA, tags[6] ... tags[0]; the live SHA is the newest.
    const images = [`2026-11-10 10:00:00 +0000 UTC|${SHA}`, ...tags.map((t, i) => `2026-11-0${i + 1} 10:00:00 +0000 UTC|${t}`)].join('\\n');
    const r = run(dir, `deploy ${SHA}`, { input: 'tok', env: { FAKE_IMAGES: images } });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe(`PONCHO_TAG=${SHA}\n`);
    expect(r.log[0]).toBe('login ghcr.io -u deploy --password-stdin');
    expect(readFileSync(join(dir, 'token'), 'utf8')).toBe('tok');
    expect(r.log).toContain(`pull -q ${IMAGE}:${SHA}`);
    expect(r.log).toContain('compose up -d --no-deps --wait --wait-timeout 60 web');
    // The login goes to a Docker config of its own, removed after the run, so the deploy user's own registry logins
    // (its ~/.docker) are never touched.
    const configDir = readFileSync(join(dir, 'config-dir'), 'utf8');
    expect(configDir).not.toBe('');
    expect(configDir.startsWith(dir)).toBe(false);
    expect(existsSync(configDir)).toBe(false);
    expect(r.log.some((l) => l.startsWith('logout'))).toBe(false);
    const removed = r.log.filter((l) => l.startsWith('image rm')).map((l) => l.split(':').at(-1));
    expect(removed).toEqual([tags[2], tags[1], tags[0]]);
  });

  it('deploy without a token does not log in', () => {
    const dir = setup();
    const r = run(dir, `deploy ${SHA}`);
    expect(r.status, r.stderr).toBe(0);
    expect(r.log.some((l) => l.startsWith('login') || l.startsWith('logout'))).toBe(false);
  });

  it('puts the previous commit back when the new container does not start healthy', () => {
    const dir = setup();
    writeFileSync(join(dir, '.env'), `PONCHO_TAG=${OLD}\n`);
    const r = run(dir, `deploy ${SHA}`, { env: { FAKE_UP_FAIL: SHA } });
    expect(r.status).toBe(1);
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe(`PONCHO_TAG=${OLD}\n`);
    expect(r.log.filter((l) => l.startsWith('compose up'))).toHaveLength(2);
  });

  it('fails without touching the live commit when the image can be neither pulled nor found here', () => {
    const dir = setup();
    writeFileSync(join(dir, '.env'), `PONCHO_TAG=${OLD}\n`);
    const r = run(dir, `deploy ${SHA}`, { env: { FAKE_PULL_RC: '1', FAKE_LOCAL_RC: '1' } });
    expect(r.status).toBe(1);
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe(`PONCHO_TAG=${OLD}\n`);
    expect(r.log.some((l) => l.startsWith('compose up'))).toBe(false);
  });

  it('a rollback by hand uses a local image when the pull fails', () => {
    const dir = setup();
    const r = run(dir, `deploy ${SHA}`, { env: { FAKE_PULL_RC: '1', FAKE_LOCAL_RC: '0' } });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe(`PONCHO_TAG=${SHA}\n`);
  });
});
