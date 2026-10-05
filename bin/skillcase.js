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

if (!command || args.includes('--help') || args.includes('-h')) {
  console.log(usage());
  process.exit(command ? 0 : 2);
}

if (!['check', 'generate'].includes(command)) {
  console.error(`Unknown command: ${command}\n\n${usage()}`);
  process.exit(2);
}

const allowedOptions = command === 'check' ? new Set(['--json']) : new Set(['--json', '--force', '--out']);
for (const option of allowedOptions) {
  const count = args.slice(1).filter((arg) => arg === option).length;
  if (count > 1) {
    console.error(`Option ${option} may only be provided once.\n\n${usage()}`);
    process.exit(2);
  }
}
const unknownOption = args.slice(1).find((arg) => arg.startsWith('-') && !allowedOptions.has(arg));
if (unknownOption) {
  console.error(`Unknown option: ${unknownOption}\n\n${usage()}`);
  process.exit(2);
}

const json = args.includes('--json');
const force = args.includes('--force');
const outIndex = args.indexOf('--out');
if (outIndex >= 0 && (!args[outIndex + 1] || args[outIndex + 1].startsWith('-'))) {
  console.error(`Option --out requires a path.\n\n${usage()}`);
  process.exit(2);
}
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
const inputs = args.filter((arg, index) => {
  if (index === 0) return false;
  if (['--json', '--force', '--out'].includes(arg)) return false;
  if (outIndex >= 0 && index === outIndex + 1) return false;
  return !arg.startsWith('-');
});
const input = inputs[0];

if (!input || inputs.length !== 1) {
  console.error(usage());
  process.exit(2);
}

const filePath = resolve(input);
let markdown;
try {
  markdown = readFileSync(filePath, 'utf8');
} catch (error) {
  exitWithFileError('read input', filePath, error);
}

if (command === 'check') {
  const report = checkSkill(markdown, { filePath });
  console.log(json ? JSON.stringify(report, null, 2) : formatChecklist(report));
  process.exitCode = report.status === 'fail' ? 1 : 0;
} else {
  const cases = generateCases(markdown, { filePath });
  const payload = json ? JSON.stringify(cases, null, 2) : renderMarkdownCases(cases);
  if (outPath) {
    const target = resolve(outPath);
    if (target === filePath) {
      console.error(`skillcase: output path matches input ${filePath}`);
      process.exit(1);
    }
    if (existsSync(target) && !force) {
      console.error(`Refusing to overwrite ${target}; pass --force to replace it.`);
      process.exit(1);
    }
    try {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, payload);
    } catch (error) {
      exitWithFileError('write output', target, error);
    }
  } else {
    console.log(payload);
  }
}

function exitWithFileError(action, path, error) {
  const detail = error && typeof error === 'object' && 'code' in error ? ` (${error.code})` : '';
  console.error(`skillcase: unable to ${action} ${path}${detail}`);
  process.exit(1);
}

function renderMarkdownCases(cases) {
  const lines = [`# Skill Cases: ${cases.name}`, ''];
  for (const item of cases.cases) {
    lines.push(`## ${item.id}: ${item.title}`, '', `- Type: ${item.type}`, `- Source: ${item.source}`, '- Expected: fill in expected behavior before using as a regression.', '');
  }
  return lines.join('\n');
}
