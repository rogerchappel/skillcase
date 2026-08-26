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

test('combines Limitations and Non-goals as negative cases in source order', () => {
  const markdown = `# Combined negative sections

## Non-goals
### Deferred work
- do not provision accounts

## Limitations
- reject unsupported input

## Non goals
- do not publish releases
`;

  assert.deepEqual(generateCases(markdown).cases.map(({ type, source }) => [type, source]), [
    ['negative', 'do not provision accounts'],
    ['negative', 'reject unsupported input'],
    ['negative', 'do not publish releases']
  ]);
});

test('deduplicates matching negatives across Limitations and Non-goals without discarding either section', () => {
  const markdown = `## Limitations
- shared exclusion
- limitation only

Non-goals
---------
- shared exclusion
- non-goal only
`;

  assert.deepEqual(generateCases(markdown).cases.map(({ source }) => source), [
    'shared exclusion',
    'limitation only',
    'non-goal only'
  ]);
});

test('keeps nested ATX and setext content in its semantic parent section', () => {
  const markdown = `# Nested section skill

## When to use
### Routine requests
- handle the routine request

Examples
--------
### Detailed examples
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

test('uses the most specific recognized semantic section for nested list items', () => {
  const markdown = `# Nested semantic sections

## Examples
- top-level happy path

### Detailed example
- grouped happy path

### Limitations
- nested unsupported input

#### Rationale
- grouped negative detail

## Validation workflow
- top-level validation

### Side-effect boundaries
- nested publishing boundary
`;

  assert.deepEqual(generateCases(markdown).cases.map(({ type, source }) => [type, source]), [
    ['happy', 'top-level happy path'],
    ['happy', 'grouped happy path'],
    ['validation', 'top-level validation'],
    ['negative', 'nested unsupported input'],
    ['negative', 'grouped negative detail'],
    ['boundary', 'nested publishing boundary']
  ]);
});

test('does not inherit a conflicting type when Non goals contains Examples', () => {
  const markdown = `# Nested examples

## Non goals
- unsupported operation

### Examples
- supported alternative
`;

  assert.deepEqual(generateCases(markdown).cases.map(({ type, source }) => [type, source]), [
    ['happy', 'supported alternative'],
    ['negative', 'unsupported operation']
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

test('treats indented setext candidates as code instead of semantic sections', () => {
  for (const indent of ['    ', '\t']) {
    const markdown = `# Actual skill

${indent}Examples
--------
- pseudo example

## Examples
- real example

## Validation workflow
- run the tests

## Side-effect boundaries
- do not publish

## Limitations
- unsupported input
`;

    const report = checkSkill(markdown);
    assert.equal(report.status, 'pass');
    assert.deepEqual(report.cases.map(({ type, source }) => [type, source]), [
      ['happy', 'real example'],
      ['validation', 'run the tests'],
      ['negative', 'unsupported input'],
      ['boundary', 'do not publish']
    ]);
  }
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

test('ignores list-looking lines in indented Markdown code', () => {
  const markdown = `# Indented code skill

## Examples
    - four-space code
\t1. tab-indented code
- real dash item
9) real ordered item

## Validation workflow
- run the tests

## Side-effect boundaries
- do not publish

## Limitations
- unsupported input
`;

  assert.deepEqual(generateCases(markdown).cases.filter(({ type }) => type === 'happy').map(({ source }) => source), [
    'real dash item',
    'real ordered item'
  ]);
});

test('CLI excludes indented pseudo-cases while retaining real list items', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillcase-indented-'));
  const input = join(dir, 'SKILL.md');
  writeFileSync(input, `# CLI indented code skill

## Examples
    * four-space code
\t2) tab-indented code
+ real plus item
123456789. real ordered item

## Validation workflow
- run the tests

## Side-effect boundaries
- do not publish

## Limitations
- unsupported input
`);

  const output = execFileSync(process.execPath, ['bin/skillcase.js', 'generate', '--json', input], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });
  rmSync(dir, { recursive: true, force: true });

  assert.deepEqual(JSON.parse(output).cases.filter(({ type }) => type === 'happy').map(({ source }) => source), [
    'real plus item',
    'real ordered item'
  ]);
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

test('does not derive generated names from indented setext candidates', () => {
  for (const indent of ['    ', '\t']) {
    assert.equal(generateCases(`${indent}Pseudo skill\n============\n\n# Actual skill`).name, 'Actual skill');
  }
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

test('CLI refuses to overwrite its input even with force', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillcase-'));
  const input = join(dir, 'SKILL.md');
  const original = '# Collision Skill\n\n## Examples\n- preserved';
  writeFileSync(input, original);

  const result = spawnSync(process.execPath, ['bin/skillcase.js', 'generate', '--force', '--out', input, input], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, `skillcase: output path matches input ${input}\n`);
  assert.equal(readFileSync(input, 'utf8'), original);
  rmSync(dir, { recursive: true, force: true });
});

test('CLI refuses normalized spellings of its input as output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillcase-'));
  const input = join(dir, 'SKILL.md');
  const normalizedAlias = join(dir, 'nested', '..', 'SKILL.md');
  const original = '# Normalized Collision\n\n## Examples\n- preserved';
  writeFileSync(input, original);

  const result = spawnSync(process.execPath, ['bin/skillcase.js', 'generate', '--force', '--out', normalizedAlias, input], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, `skillcase: output path matches input ${input}\n`);
  assert.equal(readFileSync(input, 'utf8'), original);
  rmSync(dir, { recursive: true, force: true });
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

test('CLI JSON output includes Limitations and Non-goals negatives', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillcase-'));
  const input = join(dir, 'SKILL.md');
  writeFileSync(input, `# CLI negatives

## Limitations
- limitation case

## Non-goals
### Excluded workflows
- non-goal case
`);

  const output = execFileSync(process.execPath, ['bin/skillcase.js', 'generate', '--json', input], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });
  rmSync(dir, { recursive: true, force: true });

  assert.deepEqual(JSON.parse(output).cases.map(({ type, source }) => [type, source]), [
    ['negative', 'limitation case'],
    ['negative', 'non-goal case']
  ]);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
