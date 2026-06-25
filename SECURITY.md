# Security

`skillcase` is local-first and deterministic.

## Reporting

Please report suspected security issues privately to the repository owner.

## Boundaries

- The CLI reads local Markdown.
- The CLI writes only an explicit `--out` path.
- Existing output files are protected unless `--force` is provided.
- The CLI does not execute commands found inside reviewed skill files.
