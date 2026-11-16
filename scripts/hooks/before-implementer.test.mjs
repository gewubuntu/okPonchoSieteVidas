// L-077: the implementer is launched only from a plan whose rules' cases were worked through by hand.
import { describe, expect, it } from 'vitest';
import { HEADING, planFile, planPath, workedCasesProblem, workedLines } from './before-implementer.mjs';

const launch = (prompt, subagent_type = 'implementer', tool_name = 'Agent') => ({ tool_name, tool_input: { subagent_type, prompt } });
const files = (text) => () => text;
const WORKED = `# Plan\n\n${HEADING}\n\n- Feet at 468 (32 above 500): the look-up starts.\n- Feet at 469 (31 above): it stays the band.\n\n## Tests\n- test 1 at 468\n`;

describe('L-077 the plan path a launch names', () => {
  it('finds a relative and an absolute .plans path, bare or quoted', () => {
    expect(planPath('Build the plan at .plans/GDD-UI-04-a.md now')).toBe('.plans/GDD-UI-04-a.md');
    expect(planPath('Build /home/u/repo/.plans/GDD-UI-04-a.md.')).toBe('/home/u/repo/.plans/GDD-UI-04-a.md');
    expect(planPath('see `.plans/x.md`')).toBe('.plans/x.md');
  });

  it('finds every spelling the review found missed: ./, bold, brackets, a subfolder, a quote', () => {
    expect(planPath('Build ./.plans/X.md')).toBe('./.plans/X.md');
    expect(planPath('Build **.plans/x.md**')).toBe('.plans/x.md');
    expect(planPath('Build [.plans/x.md](link)')).toBe('.plans/x.md');
    expect(planPath('Build .plans/sub/x.md')).toBe('.plans/sub/x.md');
    expect(planPath('Build ".plans/x.md"')).toBe('.plans/x.md');
    expect(planPath('Build (.plans/x.md)')).toBe('.plans/x.md');
    expect(planPath('Build repo/.plans/x.md, then')).toBe('repo/.plans/x.md');
  });

  it('reads a relative path under the working directory and an absolute one as it is', () => {
    expect(planFile('.plans/x.md', '/repo')).toBe('/repo/.plans/x.md');
    expect(planFile('/abs/.plans/x.md', '/repo')).toBe('/abs/.plans/x.md');
    expect(planFile('.plans/x.md', undefined)).toBe('.plans/x.md');
  });

  it('finds none in a prompt without a plan', () => {
    expect(planPath('Fix the thing')).toBeNull();
    expect(planPath(undefined)).toBeNull();
    expect(planPath('notes/x.md')).toBeNull();
    expect(planPath('see .plans/x.mdx')).toBeNull();
  });
});

describe('L-077 the worked cases of a plan', () => {
  it('are the lines with digits under the heading, up to the next heading', () => {
    expect(workedLines(WORKED)).toEqual(['- Feet at 468 (32 above 500): the look-up starts.', '- Feet at 469 (31 above): it stays the band.']);
  });

  it('start at the heading with a note after it, but not at a longer word', () => {
    expect(workedLines(`${HEADING} (by the main session)\n- 1 passes\n- 2 fails\n`)).toEqual(['- 1 passes', '- 2 fails']);
    expect(workedLines(`${HEADING}hop\n- 1 passes\n`)).toBeNull();
  });

  it('end at a heading of the same level, not at a deeper one', () => {
    expect(workedLines(`${HEADING}\n### Rule A\n- 1 passes\n- 2 fails\n## Next\n- 3`)).toEqual(['- 1 passes', '- 2 fails']);
  });

  it('are null without the heading, and skip lines with no digit', () => {
    expect(workedLines('# Plan\n## Tests\n- 1')).toBeNull();
    expect(workedLines('# Plan\nThe Worked cases step: 1 and 2 later.\n- 3')).toBeNull();
    expect(workedLines(`${HEADING}\n- works\n- also works\n`)).toEqual([]);
  });
});

describe('L-077 launching the implementer', () => {
  it('is let through with a worked-cases section of two lines with numbers', () => {
    expect(workedCasesProblem(launch('Build the plan at .plans/a.md'), files(WORKED))).toBeNull();
  });

  it('is denied without the section', () => {
    expect(workedCasesProblem(launch('Build the plan at .plans/a.md'), files('# Plan\n## Tests\n- 1\n- 2'))).toMatch(/^L-077: .*no "## Worked cases"/);
  });

  it('is denied with fewer than two lines with numbers', () => {
    expect(workedCasesProblem(launch('Build .plans/a.md'), files(`${HEADING}\n- one case at 32 px\n- another without\n`))).toMatch(/^L-077: .*fewer than two/);
  });

  it('is denied when the plan it names cannot be read', () => {
    expect(workedCasesProblem(launch('Build .plans/a.md'), () => { throw new Error('missing'); }, '/repo')).toMatch(/^L-077: .*cannot be read from \/repo/);
  });

  it('reads a relative plan under the input\'s working directory', () => {
    const seen = [];
    workedCasesProblem({ ...launch('Build .plans/a.md'), cwd: '/work' }, (p) => (seen.push(p), WORKED));
    expect(seen).toEqual(['/work/.plans/a.md']);
  });

  it('checks only the implementer, through the Agent tool, with a plan named', () => {
    const bad = files('# Plan');
    expect(workedCasesProblem(launch('Build .plans/a.md', 'pr-reviewer'), bad)).toBeNull();
    expect(workedCasesProblem(launch('Build .plans/a.md', 'implementer', 'Bash'), bad)).toBeNull();
    expect(workedCasesProblem(launch('Build it from memory'), bad)).toBeNull();
    expect(workedCasesProblem(null, bad)).toBeNull();
  });
});
