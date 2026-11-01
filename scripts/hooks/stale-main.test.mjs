import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isPush, publishes, staleReason } from './stale-main.mjs';

describe('L-052 stale-main hook', () => {
  it('sees a push, also with git options or after cd', () => {
    expect(isPush('git push -u origin feature')).toBe(true);
    expect(isPush('git push')).toBe(true);
    expect(isPush('cd /repo && git push -u origin x')).toBe(true);
    expect(isPush('git -C /repo push origin x')).toBe(true);
    expect(isPush('node scripts/check.mjs && git commit -m x && git push')).toBe(true);
    expect(isPush('GIT_TERMINAL_PROMPT=0 git push -u origin x')).toBe(true);
    expect(isPush('git -C "/p q" push origin x')).toBe(true);
    expect(isPush('cd /repo && git push -u origin "$(git branch --show-current)"')).toBe(true);
    expect(isPush("echo don\\'t; git push origin HEAD; echo 'x y'")).toBe(true);
    expect(isPush('git -C /repo \\\n  push origin x')).toBe(true);
    expect(isPush('git -c core.sshCommand="ssh -i ~/.ssh/k" push origin x')).toBe(true);
    expect(isPush('git --git-dir="/a b" push')).toBe(true);
    expect(isPush("git --work-tree='/a b' push")).toBe(true);
    expect(isPush('GIT_TRACE= git push')).toBe(true);
    expect(isPush('GIT_SSH_COMMAND="ssh -i ~/.ssh/k" git push')).toBe(true);
    expect(isPush("cat <<'EOF' | bash>/tmp/log\ngit push origin x\nEOF")).toBe(true);
    expect(isPush("cat <<'EOF' |/bin/sh\ngit push origin x\nEOF")).toBe(true);
    expect(isPush("cat <<'EOF' |bash\ngit push origin x\nEOF")).toBe(true);
    expect(isPush("bash</dev/null <<'EOF'\ngit push origin x\nEOF")).toBe(true);
    expect(isPush("bash <<'EOF'\ngit push origin x\nEOF")).toBe(true);
    // When unsure it asks: a quoted `; git push` reads as a push (an extra question, never a missed one).
    expect(isPush('git commit -m "fix; git push later"')).toBe(true);
  });

  it('ignores a mention of a push and other git commands', () => {
    expect(isPush('echo git push')).toBe(false);
    expect(isPush('grep -n "git push" CLAUDE.md')).toBe(false);
    expect(isPush('git pushd')).toBe(false);
    expect(isPush('git fetch origin main')).toBe(false);
    expect(isPush(undefined)).toBe(false);
    expect(isPush("git commit -m \"$(cat <<'EOF'\nchore: hook\n\ngit push now asks first.\nEOF\n)\"")).toBe(false);
    expect(isPush("cat > notes.md <<'EOF'\ngit push later\nEOF")).toBe(false);
    expect(isPush("git add scripts/x.sh && git commit -m \"$(cat <<'EOF'\nfix\n\ngit push asks first\nEOF\n)\"")).toBe(false);
  });

  it('counts a new PR by the GitHub tool, under any server name, as publishing', () => {
    expect(publishes({ tool_name: 'mcp__github__create_pull_request' })).toBe(true);
    expect(publishes({ tool_name: 'mcp__plugin_engineering_github__create_pull_request' })).toBe(true);
    expect(publishes({ tool_name: 'mcp__github__update_pull_request' })).toBe(false);
    expect(publishes({ tool_name: 'Bash', tool_input: { command: 'git push' } })).toBe(true);
    expect(publishes({ tool_name: 'Bash', tool_input: { command: 'git status' } })).toBe(false);
    expect(publishes(null)).toBe(false);
  });

  it('asks only when origin/main has commits the branch lacks', () => {
    expect(staleReason(0)).toBeNull();
    expect(staleReason(Number.NaN)).toBeNull();
    expect(staleReason(3)).toMatch(/L-052: origin\/main has 3 commit/);
  });

  it('prints nothing, and fetches nothing, for a call that does not publish', () => {
    const out = spawnSync(process.execPath, [fileURLToPath(new URL('./stale-main.mjs', import.meta.url))], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }),
      encoding: 'utf8',
    });
    expect(out.status).toBe(0);
    expect(out.stdout).toBe('');
  });
});
