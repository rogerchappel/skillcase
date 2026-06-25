# skillcase

Use this skill when creating or reviewing regression coverage for an agent `SKILL.md`.

## Required Inputs

- A local `SKILL.md` path.
- An optional output path for generated fixture templates.

## Required Tools

- `node`
- `npm`

## Side-Effect Boundaries

- Read local Markdown files.
- Write only the explicit `--out` path when requested.
- Refuse to overwrite files unless `--force` is provided.
- Do not execute external tools described by the reviewed skill.

## Approval Requirements

- Ask before writing generated fixtures into a repository.
- Keep generation local and deterministic.

## Examples

- Run `node bin/skillcase.js check SKILL.md` before changing a skill.
- Run `node bin/skillcase.js generate --out test/fixtures/skill-cases.md SKILL.md` to bootstrap regression notes.

## Validation Workflow

- Run `npm test`.
- Run `npm run check`.
- Run `npm run smoke`.
- Run `npm run validate`.

## Limitations

- Do not treat generated cases as complete tests until expected behavior is filled in.
- Skills without list-based examples may need manual fixture authoring.
