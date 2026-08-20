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
  const { sections, orderedSections } = parseDocument(markdown);
  const name = firstHeading(markdown) || 'skill';
  const candidates = [
    ...itemsFrom(sections['when to use'] || sections.preamble, 'happy'),
    ...itemsFrom(sections.examples, 'happy'),
    ...itemsFrom(sections['validation workflow'], 'validation'),
    ...orderedSections
      .filter(({ key }) => key === 'limitations' || key === 'non goals')
      .flatMap(({ text }) => itemsFrom(text, 'negative')),
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
  return parseDocument(markdown).sections;
}

function parseDocument(markdown) {
  const sections = { preamble: [] };
  const orderedSections = [];
  let headings = [];
  let fence = null;
  const lines = markdown.split(/\r?\n/);

  const append = (line) => {
    const keys = headings.length ? headings.map(({ key }) => key) : ['preamble'];
    for (const key of new Set(keys)) sections[key].push(line);
    for (const heading of headings) heading.lines.push(line);
  };

  const enterHeading = (level, value) => {
    const key = normalize(value);
    while (headings.at(-1)?.level >= level) headings.pop();
    sections[key] ||= [];
    const heading = { level, key, lines: [] };
    headings.push(heading);
    orderedSections.push(heading);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMarker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence && line.match(new RegExp(`^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`))) {
      fence = null;
      append(line);
      continue;
    }
    if (!fence && fenceMarker) {
      const marker = fenceMarker[1];
      fence = { character: marker[0], length: marker.length };
      append(line);
      continue;
    }

    if (fence) {
      append(line);
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*?)(?:[ \t]+#+[ \t]*)?$/);
    if (heading) {
      enterHeading(heading[1].length, heading[2]);
      continue;
    }

    const nextLine = lines[index + 1];
    const setext = line.trim() && nextLine?.match(/^ {0,3}(=+|-+)[ \t]*$/);
    if (setext) {
      enterHeading(setext[1][0] === '=' ? 1 : 2, line.trim());
      index += 1;
      continue;
    }
    append(line);
  }
  return {
    sections: Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join('\n').trim()])),
    orderedSections: orderedSections.map(({ key, lines }) => ({ key, text: lines.join('\n').trim() }))
  };
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

    const atx = line.match(/^ {0,3}#{1,6}(?:[ \t]+|$)(.*?)(?:[ \t]+#+[ \t]*)?$/);
    if (atx) return atx[1].trim();
    if (line.trim() && lines[index + 1] && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[index + 1])) return line.trim();
  }
  return null;
}
