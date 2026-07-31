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

test('combines repeated matching sections instead of replacing earlier content', () => {
  const sections = parseSections('## Examples\n- first\n\n## Examples\n- second');
  assert.match(sections.examples, /- first/);
  assert.match(sections.examples, /- second/);
  assert.deepEqual(generateCases('## Examples\n- first\n\n## Examples\n- second').cases.map((item) => item.source), ['first', 'second']);
});

test('ignores ATX and setext heading syntax inside fenced code', () => {
  const sections = parseSections('## Examples\n- real\n```md\n## Limitations\ninside\n------\n```\n## Limitations\n- actual');
  assert.match(sections.examples, /## Limitations/);
  assert.equal(sections.limitations, '- actual');
  assert.equal(generateCases('```md\n# fake\n```\n# Actual\n## Examples\n- real').name, 'Actual');
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
