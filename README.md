# skillcase

`skillcase` turns an agent `SKILL.md` into fixture-backed validation case templates. It helps maintainers create regression cases from usage guidance, examples, validation steps, side-effect boundaries, and limitations.

## Quickstart

```sh
npm install
npm run smoke
node bin/skillcase.js generate test/fixtures/complete/SKILL.md
node bin/skillcase.js generate --json --out tmp/cases.json test/fixtures/complete/SKILL.md
```

## Commands

- `skillcase check <SKILL.md>` reports whether the skill has examples, validation workflow, side-effect boundaries, and at least one negative case.
- `skillcase generate <SKILL.md>` prints Markdown fixture templates.
- `skillcase generate --json <SKILL.md>` prints JSON fixture templates.
- `--out <path>` writes generated templates to disk.
- `--force` is required before overwriting an existing output file.

## Safety Notes

The CLI reads local Markdown and optionally writes a requested fixture file. It does not execute referenced tools, mutate installed skill directories, or call external services.

## Limitations

- Generated cases are skeletons; maintainers must fill expected outputs.
- Section parsing is conservative and works best with clear Markdown headings.
- The tool does not infer behavior from unstructured prose beyond list items.
