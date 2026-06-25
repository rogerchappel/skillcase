# Complete Skill

Use this skill when maintaining a public agent skill.

## When To Use

- A skill has changed and needs regression coverage.
- A release candidate needs fixture examples.

## Required Tools

- `node`

## Side-Effect Boundaries

- Read local Markdown.
- Write only requested fixture files.

## Examples

- Generate a Markdown fixture file from a skill.
- Check a skill before opening a release candidate PR.

## Validation Workflow

- Run generated cases against the skill instructions.
- Confirm negative cases are covered before release.

## Limitations

- Do not overwrite maintainer-authored fixtures without review.
