import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { checkSkill, generateCases } from '../src/index.js';

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
