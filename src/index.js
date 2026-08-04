const REQUIRED_SIGNALS = [
  ['examples', 'Examples'],
  ['validation workflow', 'Validation workflow'],
  ['side effect boundaries', 'Side-effect boundaries']
];

export function checkSkill(markdown, options = {}) {
  const sections = parseSections(markdown);
  const findings = [];

  for (const [key, label] of REQUIRED_SIGNALS) {
    if (!sections[key]) {
      findings.push({
        level: 'error',
        code: `missing-${key.replace(/\s+/g, '-')}`,
        message: `${label} section is required for fixture-backed skill maintenance.`
      });
    }
  }

  const cases = generateCases(markdown, options).cases;
  if (!cases.some((testCase) => testCase.type === 'negative')) {
    findings.push({
      level: 'warn',
      code: 'missing-negative-case',
      message: 'No negative or refusal case could be derived.'
    });
  }

  return {
    filePath: options.filePath || null,
    status: findings.some((finding) => finding.level === 'error') ? 'fail' : findings.length ? 'warn' : 'pass',
    cases,
    findings
  };
}

export function generateCases(markdown, options = {}) {
  const sections = parseSections(markdown);
  const name = firstHeading(markdown) || 'skill';
  const candidates = [
    ...itemsFrom(sections['when to use'] || sections.preamble, 'happy'),
    ...itemsFrom(sections.examples, 'happy'),
    ...itemsFrom(sections['validation workflow'], 'validation'),
    ...itemsFrom(sections.limitations || sections['non goals'], 'negative'),
    ...itemsFrom(sections['side effect boundaries'], 'boundary')
  ];

  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = `${candidate.type}:${candidate.source.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  return {
    name,
    filePath: options.filePath || null,
    cases: deduped.map((candidate, index) => ({
      id: `case-${String(index + 1).padStart(2, '0')}`,
      ...candidate,
      title: titleFor(candidate)
    }))
  };
}

export function formatChecklist(report) {
  const lines = [`skillcase ${report.status.toUpperCase()} ${report.filePath || ''}`.trim()];
  lines.push(`derived cases: ${report.cases.length}`);
  for (const finding of report.findings) {
    lines.push(`${finding.level.toUpperCase()} ${finding.code}: ${finding.message}`);
  }
  return lines.join('\n');
}

export function parseSections(markdown) {
  const sections = { preamble: [] };
  let current = 'preamble';
  let fence = null;
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMarker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence && line.match(new RegExp(`^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`))) {
      fence = null;
      sections[current].push(line);
      continue;
    }
    if (!fence && fenceMarker) {
      const marker = fenceMarker[1];
      fence = { character: marker[0], length: marker.length };
      sections[current].push(line);
      continue;
    }

    if (fence) {
      sections[current].push(line);
      continue;
    }

    const heading = line.match(/^ {0,3}#{1,6}(?:[ \t]+|$)(.*?)(?:[ \t]+#+[ \t]*)?$/);
    if (heading) {
      current = normalize(heading[1]);
      sections[current] ||= [];
      continue;
    }

    const nextLine = lines[index + 1];
    if (line.trim() && nextLine && /^ {0,3}(?:=+[ \t]*|-+[ \t]*)$/.test(nextLine)) {
      current = normalize(line.trim());
      sections[current] ||= [];
      index += 1;
      continue;
    }
    sections[current].push(line);
  }
  return Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join('\n').trim()]));
}

function itemsFrom(text = '', type) {
  const items = [];
  let fence = null;

  for (const line of text.split(/\r?\n/)) {
    if (fence && line.match(new RegExp(`^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`))) {
      fence = null;
      continue;
    }

    const fenceMarker = !fence && line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMarker) {
      fence = { character: fenceMarker[1][0], length: fenceMarker[1].length };
      continue;
    }
    if (fence) continue;

    const source = line.match(/^\s*(?:[-+*]|\d{1,9}[.)])\s+(.*)$/)?.[1]?.trim();
    if (source) items.push({ type, source });
  }

  return items;
}

function titleFor(candidate) {
  const compact = candidate.source.replace(/[`*_]/g, '').replace(/[.:;]+$/g, '');
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

function normalize(value) {
  return value.toLowerCase().replace(/[`*_]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function firstHeading(markdown) {
  let fence = null;
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence && line.match(new RegExp(`^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`))) {
      fence = null;
      continue;
    }
    const fenceMarker = !fence && line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMarker) {
      fence = { character: fenceMarker[1][0], length: fenceMarker[1].length };
      continue;
    }
    if (fence) continue;

    const atx = line.match(/^ {0,3}#(?:[ \t]+)(.*?)(?:[ \t]+#+[ \t]*)?$/);
    if (atx) return atx[1].trim();
    if (line.trim() && lines[index + 1] && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[index + 1])) return line.trim();
  }
  return null;
}
