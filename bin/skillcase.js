#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { checkSkill, formatChecklist, generateCases } from '../src/index.js';

function usage() {
  return `Usage:
  skillcase check [--json] <SKILL.md>
  skillcase generate [--json] [--force] [--out <path>] <SKILL.md>`;
}

const args = process.argv.slice(2);
const command = args[0];
const json = args.includes('--json');
const force = args.includes('--force');
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
const input = args.filter((arg, index) => {
  if (index === 0) return false;
  if (['--json', '--force', '--out'].includes(arg)) return false;
  if (outIndex >= 0 && index === outIndex + 1) return false;
  return !arg.startsWith('--');
})[0];

if (!command || args.includes('--help') || args.includes('-h')) {
  console.log(usage());
  process.exit(command ? 0 : 2);
}

if (!input || !['check', 'generate'].includes(command)) {
  console.error(usage());
  process.exit(2);
}

const filePath = resolve(input);
const markdown = readFileSync(filePath, 'utf8');

if (command === 'check') {
  const report = checkSkill(markdown, { filePath });
  console.log(json ? JSON.stringify(report, null, 2) : formatChecklist(report));
  process.exitCode = report.status === 'fail' ? 1 : 0;
} else {
  const cases = generateCases(markdown, { filePath });
  const payload = json ? JSON.stringify(cases, null, 2) : renderMarkdownCases(cases);
  if (outPath) {
    const target = resolve(outPath);
    if (existsSync(target) && !force) {
      console.error(`Refusing to overwrite ${target}; pass --force to replace it.`);
      process.exit(1);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, payload);
  } else {
    console.log(payload);
  }
}

function renderMarkdownCases(cases) {
  const lines = [`# Skill Cases: ${cases.name}`, ''];
  for (const item of cases.cases) {
    lines.push(`## ${item.id}: ${item.title}`, '', `- Type: ${item.type}`, `- Source: ${item.source}`, '- Expected: fill in expected behavior before using as a regression.', '');
  }
  return lines.join('\n');
}
