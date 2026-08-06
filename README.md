# skillcase

`skillcase` turns an agent `SKILL.md` into fixture-backed validation case templates. It helps maintainers create regression cases from usage guidance, examples, validation steps, side-effect boundaries, and limitations.

## Quickstart

```sh
npm install
npm run smoke
node bin/skillcase.js generate test/fixtures/complete/SKILL.md
node bin/skillcase.js generate --json --out tmp/cases.json test/fixtures/complete/SKILL.md
```

Install the CLI from npm after release:

```sh
npm install -g skillcase
skillcase check path/to/SKILL.md
```

## Commands

- `skillcase check <SKILL.md>` reports whether the skill has examples, validation workflow, side-effect boundaries, and at least one negative case.
- `skillcase generate <SKILL.md>` prints Markdown fixture templates.
- `skillcase generate --json <SKILL.md>` prints JSON fixture templates.
- `--out <path>` writes generated templates to disk.
- `--force` is required before overwriting an existing output file.

`check` accepts only `--json`. `generate` accepts `--json`, `--out <path>`, and
`--force`. Options may appear before or after the input path. Unknown options,
missing option values, extra input paths, and unsupported commands print usage
information and exit with status 2.

Section parsing recognizes ATX headings at levels 1–6 (including optional
closing hashes) and setext headings using `===` or `---` underlines. Repeated
headings are combined in source order so all list items contribute cases.
Heading-like text inside backtick or tilde fenced code blocks is treated as
code, not as a section boundary.

Generated Markdown and JSON use the first non-fenced ATX heading at any level
from 1–6, or the first non-fenced setext heading, as the skill name.

Case derivation recognizes unordered list markers (`-`, `*`, and `+`) and
ordered list markers containing one to nine digits followed by `.` or `)`.
List-looking lines inside backtick or tilde fenced code blocks are treated as
code and do not produce cases.

## Safety Notes

The CLI reads local Markdown and optionally writes a requested fixture file. It does not execute referenced tools, mutate installed skill directories, or call external services.

## Limitations

- Generated cases are skeletons; maintainers must fill expected outputs.
- Section parsing is conservative and works best with clear Markdown headings.
- The tool does not infer behavior from unstructured prose beyond list items.

## Verify

```sh
npm test
npm run check
npm run smoke
npm pack --dry-run
```

## Local Verification

```sh
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
```
