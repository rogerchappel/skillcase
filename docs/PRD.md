# PRD: skillcase

## Summary

`skillcase` bootstraps repeatable validation cases from agent skill documentation so maintainers can regression-test behavior before changing or sharing skills.

## Goals

- Derive case templates from examples, usage bullets, validation steps, side-effect boundaries, and limitations.
- Check for missing regression coverage signals.
- Generate Markdown and JSON outputs.
- Refuse accidental overwrites by default.

## Non-Goals

- No LLM-generated content.
- No execution of referenced tools.
- No mutation of installed skill directories by default.

## MVP Requirements

- Parse common `SKILL.md` Markdown sections.
- Provide `check` and `generate` commands.
- Emit text and JSON reports.
- Include fixtures for complete and incomplete skills.
- Include tests for generation, checklist findings, and overwrite protection.

## Success Criteria

- A maintainer can create a useful fixture skeleton from a skill in one command.
- The check mode catches missing examples, validation workflow, side-effect boundaries, or negative cases.
