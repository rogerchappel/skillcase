import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { checkSkill, generateCases, parseSections } from '../src/index.js';

function fixture(name) {
  return readFileSync(new URL(`./fixtures/${name}/SKILL.md`, import.meta.url), 'utf8');
}

test('generates cases from complete skill sections', () => {
  const generated = generateCases(fixture('complete'));
  assert.ok(generated.cases.length >= 5);
  assert.ok(generated.cases.some((item) => item.type === 'negative'));
  assert.ok(generated.cases.some((item) => item.type === 'validation'));
});

test('check fails incomplete skills with missing sections', () => {
  const report = checkSkill(fixture('incomplete'));
  assert.equal(report.status, 'fail');
  assert.ok(report.findings.some((finding) => finding.code === 'missing-examples'));
});

test('parses setext headings and derives every relevant list item', () => {
  const markdown = `Skill name
==========

Examples
--------
- first example

Validation workflow
-------------------
- run the tests

Side-effect boundaries
----------------------
- do not publish

Limitations
-----------
- unsupported input
`;
  const report = checkSkill(markdown);
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.cases.map(({ type, source }) => [type, source]), [
    ['happy', 'first example'],
    ['validation', 'run the tests'],
    ['negative', 'unsupported input'],
    ['boundary', 'do not publish']
  ]);
});

test('derives typed cases from plus and ordered list markers', () => {
  const markdown = `# List marker skill

## Examples
+ plus example
1. ordered example

## Validation workflow
2) run the ordered validation step

## Side-effect boundaries
+ keep the plus-marked boundary

## Limitations
3. reject the ordered limitation
`;
  const generated = generateCases(markdown);
  assert.deepEqual(generated.cases.map(({ type, source }) => [type, source]), [
    ['happy', 'plus example'],
    ['happy', 'ordered example'],
    ['validation', 'run the ordered validation step'],
    ['negative', 'reject the ordered limitation'],
    ['boundary', 'keep the plus-marked boundary']
  ]);

  const report = checkSkill(markdown);
  assert.equal(report.status, 'pass');
  assert.equal(report.findings.some((finding) => finding.code === 'missing-negative-case'), false);
  assert.deepEqual(report.cases, generated.cases);
});

test('combines repeated matching sections instead of replacing earlier content', () => {
  const sections = parseSections('## Examples\n- first\n\n## Examples\n- second');
  assert.match(sections.examples, /- first/);
  assert.match(sections.examples, /- second/);
  assert.deepEqual(generateCases('## Examples\n- first\n\n## Examples\n- second').cases.map((item) => item.source), ['first', 'second']);
});

test('keeps nested ATX and setext content in its semantic parent section', () => {
  const markdown = `# Nested section skill

## When to use
### Routine requests
- handle the routine request

## Examples
Detailed examples
-----------------
- nested happy path

## Validation workflow
### Automated checks
- run the nested check

## Side-effect boundaries
### Publishing
- require confirmation before publishing

## Limitations
### Unsupported inputs
- reject the nested unsupported input
`;

  const report = checkSkill(markdown);
  assert.equal(report.status, 'pass');
  assert.equal(report.findings.some(({ code }) => code === 'missing-negative-case'), false);
  assert.deepEqual(report.cases.map(({ type, source }) => [type, source]), [
    ['happy', 'handle the routine request'],
    ['happy', 'nested happy path'],
    ['validation', 'run the nested check'],
    ['negative', 'reject the nested unsupported input'],
    ['boundary', 'require confirmation before publishing']
  ]);
});

test('ends nested semantic membership at a same-or-higher-level heading', () => {
  const markdown = `# Boundary skill

## Examples
### Included details
- included example
## Notes
### Not examples
- excluded note

## Validation workflow
- validate
## Side-effect boundaries
- keep local
## Non goals
### Exclusions
- nested negative
# Appendix
- excluded appendix item
`;

  assert.deepEqual(generateCases(markdown).cases.map(({ type, source }) => [type, source]), [
    ['happy', 'included example'],
    ['validation', 'validate'],
    ['negative', 'nested negative'],
    ['boundary', 'keep local']
  ]);
});

test('combines repeated semantic parents with nested content and ignores fenced pseudo-headings', () => {
  const markdown = `## Examples
### First group
- first nested example

\`\`\`md
## Limitations
- fenced negative
\`\`\`

## Examples
### Second group
- second nested example

## Limitations
### Actual limitations
- actual nested negative
`;

  assert.deepEqual(generateCases(markdown).cases.map(({ type, source }) => [type, source]), [
    ['happy', 'first nested example'],
    ['happy', 'second nested example'],
    ['negative', 'actual nested negative']
  ]);
});

test('ignores ATX and setext heading syntax inside fenced code', () => {
  const sections = parseSections('## Examples\n- real\n```md\n## Limitations\ninside\n------\n```\n## Limitations\n- actual');
  assert.match(sections.examples, /## Limitations/);
  assert.equal(sections.limitations, '- actual');
  assert.equal(generateCases('```md\n# fake\n```\n# Actual\n## Examples\n- real').name, 'Actual');
});

test('ignores list markers inside backtick and tilde fenced code', () => {
  const markdown = `# Fenced list skill

## Examples
- before backticks
\`\`\`md
- fenced dash
* fenced star
1. fenced ordered dot
\`\`\`
+ between fences
~~~~text
+ fenced plus
2) fenced ordered parenthesis
~~~~
3. after tildes

## Validation workflow
- run the tests

## Side-effect boundaries
- do not publish

## Limitations
- unsupported input
`;

  const sections = parseSections(markdown);
  assert.match(sections.examples, /- fenced dash/);
  assert.match(sections.examples, /2\) fenced ordered parenthesis/);

  const generated = generateCases(markdown);
  assert.deepEqual(generated.cases.filter(({ type }) => type === 'happy').map(({ source }) => source), [
    'before backticks',
    'between fences',
    'after tildes'
  ]);

  const report = checkSkill(markdown);
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.cases, generated.cases);
});

test('uses the first ATX heading at levels 1 through 6 as the generated name', () => {
  for (let level = 1; level <= 6; level += 1) {
    const hashes = '#'.repeat(level);
    assert.equal(generateCases(`${hashes} Nested Skill ${hashes}\n\n## Examples\n- real`).name, 'Nested Skill');
  }
});

test('retains setext and fenced-heading behavior when deriving the generated name', () => {
  assert.equal(generateCases('Nested Skill\n============\n\n## Examples\n- real').name, 'Nested Skill');
  assert.equal(generateCases('~~~md\n###### Fenced Skill\n~~~\n#### Nested Skill ####').name, 'Nested Skill');
});

test('CLI rejects unknown options with usage and exit code 2', () => {
  const result = spawnSync(process.execPath, ['bin/skillcase.js', 'check', '--bogus', 'test/fixtures/complete/SKILL.md'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown option: --bogus/);
  assert.match(result.stderr, /Usage:/);
});

test('CLI reports a concise path-specific error for a missing input', () => {
  const missing = join(tmpdir(), `skillcase-missing-${process.pid}.md`);
  const result = spawnSync(process.execPath, ['bin/skillcase.js', 'check', missing], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, `skillcase: unable to read input ${missing} (ENOENT)\n`);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test('CLI reports a concise path-specific error when output cannot be written', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillcase-'));
  const parentFile = join(dir, 'not-a-directory');
  const out = join(parentFile, 'cases.md');
  writeFileSync(parentFile, 'existing');
  const result = spawnSync(process.execPath, ['bin/skillcase.js', 'generate', '--out', out, 'test/fixtures/complete/SKILL.md'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });
  rmSync(dir, { recursive: true, force: true });

  assert.equal(result.status, 1);
  assert.match(result.stderr, new RegExp(`^skillcase: unable to write output ${escapeRegExp(out)} \\([A-Z]+\\)\\n$`));
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test('CLI refuses to overwrite generated output without force', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillcase-'));
  const out = join(dir, 'cases.md');
  writeFileSync(out, 'existing');
  const result = spawnSync(process.execPath, ['bin/skillcase.js', 'generate', '--out', out, 'test/fixtures/complete/SKILL.md'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to overwrite/);
});

test('CLI writes generated output with force', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillcase-'));
  const out = join(dir, 'cases.md');
  execFileSync(process.execPath, ['bin/skillcase.js', 'generate', '--force', '--out', out, 'test/fixtures/complete/SKILL.md'], {
    cwd: new URL('..', import.meta.url)
  });
  const body = readFileSync(out, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  assert.match(body, /Skill Cases/);
});

test('CLI uses a nested ATX heading in Markdown and JSON output names', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillcase-'));
  const input = join(dir, 'SKILL.md');
  writeFileSync(input, '### Nested Skill ###\n\n## Examples\n- example');

  const markdown = execFileSync(process.execPath, ['bin/skillcase.js', 'generate', input], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });
  const json = execFileSync(process.execPath, ['bin/skillcase.js', 'generate', '--json', input], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });
  rmSync(dir, { recursive: true, force: true });

  assert.match(markdown, /^# Skill Cases: Nested Skill$/m);
  assert.equal(JSON.parse(json).name, 'Nested Skill');
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
