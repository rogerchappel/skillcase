# Orchestration

## Inputs

- One local `SKILL.md` file.
- Optional output path.
- Optional overwrite approval via `--force`.

## Flow

1. Read the skill Markdown.
2. Parse normalized headings.
3. Derive candidate cases from list items in usage, examples, validation, limitations, and side-effect sections.
4. Check for missing coverage signals.
5. Print Markdown or JSON, or write the explicit output path.

## Side Effects

- Reads local Markdown.
- Writes stdout.
- Writes only the explicit output path when requested.
- Does not execute reviewed skill commands.
