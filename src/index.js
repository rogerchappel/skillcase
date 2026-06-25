const REQUIRED_SIGNALS = [
  ['examples', 'Examples'],
  ['validation workflow', 'Validation workflow'],
  ['side-effect boundaries', 'Side-effect boundaries']
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
    ...itemsFrom(sections['side-effect boundaries'], 'boundary')
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
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (heading) {
      current = normalize(heading[1]);
      sections[current] = [];
      continue;
    }
    sections[current].push(line);
  }
  return Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join('\n').trim()]));
}

function itemsFrom(text = '', type) {
  return text
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+(.*)$/)?.[1]?.trim())
    .filter(Boolean)
    .map((source) => ({ type, source }));
}

function titleFor(candidate) {
  const compact = candidate.source.replace(/[`*_]/g, '').replace(/[.:;]+$/g, '');
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

function normalize(value) {
  return value.toLowerCase().replace(/[`*_]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function firstHeading(markdown) {
  return markdown.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
}
