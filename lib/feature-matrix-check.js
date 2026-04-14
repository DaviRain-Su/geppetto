#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const FEATURE_KEYS_TO_CHECK = Object.freeze([
  'default',
  'system',
  'token',
  'token-2022',
  'ata',
  'memo',
  'log',
  'pubkey',
  'token-all',
  'full',
  'test-utils',
]);

function extractTomlSection(content, sectionName) {
  const lines = content.split(/\r?\n/);
  const collected = [];
  let found = false;

  for (const line of lines) {
    const sectionMatch = line.match(/^\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      if (found) {
        break;
      }
      found = sectionMatch[1] === sectionName;
      continue;
    }

    if (found) {
      collected.push(line);
    }
  }

  if (!found) {
    throw new Error(`Missing TOML section: [${sectionName}]`);
  }

  return collected.join('\n');
}

function parseTomlArray(rawArray) {
  if (!rawArray) {
    return [];
  }

  const normalized = rawArray.trim().replace(/,$/u, '');
  if (!normalized) {
    return [];
  }

  return [...normalized.matchAll(/"((?:[^"\\]|\\.)*)"/gu)].map((match) => match[1]);
}

function parseFeatureSection(featureSection) {
  const features = {};
  const lines = featureSection.split(/\r?\n/);

  for (const line of lines) {
    const sanitized = line.replace(/#.*/, '').trim();
    if (!sanitized) {
      continue;
    }

    const match = sanitized.match(/^([A-Za-z0-9_-]+)\s*=\s*(\[[^\]]*\])\s*$/u);
    if (!match) {
      throw new Error(`Unsupported feature entry: ${line}`);
    }

    const key = match[1];
    features[key] = parseTomlArray(match[2].slice(1, -1));
  }

  return features;
}

function normalizeFeatureEntries(rawFeatures) {
  return Object.entries(rawFeatures)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce((acc, [key, values]) => {
      const normalizedValues = values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.replace(/^dep:/u, ''))
        .sort();
      acc[key] = normalizedValues;
      return acc;
    }, {});
}

function readCargoFeatures(cargoToml) {
  const featureSection = extractTomlSection(cargoToml, 'features');
  return parseFeatureSection(featureSection);
}

function extractTechSpecCargoToml(techSpecContent) {
  const sectionMatch = techSpecContent.match(/##\s*1\.\s*Cargo\.toml/i);
  if (!sectionMatch) {
    throw new Error('Missing section: ## 1. Cargo.toml');
  }

  const afterSection = techSpecContent.slice(sectionMatch.index);
  const fenceMatch = afterSection.match(/```toml\s*([\s\S]*?)```/i);
  if (!fenceMatch) {
    throw new Error('Missing Cargo.toml TOML code block in technical spec');
  }

  return fenceMatch[1];
}

function readTechSpecFeatures(techSpecContent) {
  const featureToml = extractTechSpecCargoToml(techSpecContent);
  const featureSection = extractTomlSection(featureToml, 'features');
  return parseFeatureSection(featureSection);
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function checkFeatureMatrix(
  root = path.resolve(__dirname, '..'),
  options = {},
) {
  const {
    featureKeys = FEATURE_KEYS_TO_CHECK,
    cargoTomlPath = path.join(root, 'Cargo.toml'),
    techSpecPath = path.join(root, 'docs/03-technical-spec.md'),
    cargoContent = fs.readFileSync(cargoTomlPath, 'utf8'),
    techSpecContent = fs.readFileSync(techSpecPath, 'utf8'),
  } = options;

  const cargoFeatures = normalizeFeatureEntries(readCargoFeatures(cargoContent));
  const specFeatures = normalizeFeatureEntries(readTechSpecFeatures(techSpecContent));

  const checkedFeatures = new Set([...Object.keys(cargoFeatures), ...Object.keys(specFeatures)]);
  const errors = [];

  for (const key of featureKeys) {
    checkedFeatures.delete(key);
  }

  for (const key of featureKeys) {
    const cargoValue = cargoFeatures[key];
    const specValue = specFeatures[key];
    if (!cargoValue) {
      errors.push(`Cargo.toml missing feature: ${key}`);
      continue;
    }
    if (!specValue) {
      errors.push(`docs/03-technical-spec.md missing feature: ${key}`);
      continue;
    }
    if (!arraysEqual(cargoValue, [...specValue].sort())) {
      errors.push(
        `Feature mismatch for ${key}: cargo=${cargoValue.join(',')} spec=${specValue.join(',')}`,
      );
    }
  }

  for (const extra of [...checkedFeatures].sort()) {
    errors.push(`Feature set drift: extra feature ${extra} found only on one side`);
  }

  return {
    errors,
    checkedFeatures: [...new Set([...Object.keys(cargoFeatures), ...Object.keys(specFeatures)])].sort(),
    cargoFeatures,
    specFeatures,
  };
}

function main() {
  const result = checkFeatureMatrix();

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`);
    }
    return 1;
  }

  process.stdout.write(`feature matrix ok features=${result.checkedFeatures.length}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  FEATURE_KEYS_TO_CHECK,
  checkFeatureMatrix,
  extractTechSpecCargoToml,
  extractTomlSection,
  main,
  parseFeatureSection,
};
