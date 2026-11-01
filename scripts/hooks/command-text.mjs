// The text of a shell command that hooks answering `ask` search for a call (stale-main.mjs, before-merge.mjs). Line
// continuations are joined, and a here-document's body is dropped unless a shell named on its line reads it (`bash <<EOF`,
// `cat <<EOF | bash`), since a commit message's body is text. Quoted text stays as written: emptying it let quotes inside
// quotes hide real calls, and such a hook asks when unsure (docs/HARNESS.md, Adding a check; L-008).

const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;

/** The command with continuations joined and here-document bodies that no shell reads removed. */
export function commandText(command) {
  return String(command ?? '')
    .replace(/\\\r?\n/g, ' ')
    .replace(HEREDOC, (m, _q, _tag, rest, at, all) =>
      /\b(?:ba|z|da|k)?sh\b/.test(all.slice(all.lastIndexOf('\n', at) + 1, at) + rest) ? m : `<<${rest}`,
    );
}
