#!/usr/bin/env bun

import * as fs from 'node:fs'
import * as path from 'node:path'

export const FEATURE_KEYS_TO_CHECK = Object.freeze([
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
])

export interface FeatureMatrixOptions {
  featureKeys?: readonly string[]
  cargoTomlPath?: string
  techSpecPath?: string
  cargoContent?: string
  techSpecContent?: string
}

export interface FeatureMatrixResult {
  errors: string[]
  checkedFeatures: string[]
  cargoFeatures: Record<string, string[]>
  specFeatures: Record<string, string[]>
}

export function extractTomlSection(content: string, sectionName: string): string {
  const lines = content.split(/\r?\n/)
  const collected: string[] = []
  let found = false

  for (const line of lines) {
    const sectionMatch = line.match(/^\[([^\]]+)\]\s*$/)
    if (sectionMatch) {
      if (found) {
        break
      }
      found = sectionMatch[1] === sectionName
      continue
    }

    if (found) {
      collected.push(line)
    }
  }

  if (!found) {
    throw new Error(`Missing TOML section: [${sectionName}]`)
  }

  return collected.join('\n')
}

function parseTomlArray(rawArray?: string): string[] {
  if (!rawArray) {
    return []
  }

  const normalized = rawArray.trim().replace(/,$/u, '')
  if (!normalized) {
    return []
  }

  return [...normalized.matchAll(/"((?:[^"\\]|\\.)*)"/gu)].map((match) => match[1])
}

export function parseFeatureSection(featureSection: string): Record<string, string[]> {
  const features: Record<string, string[]> = {}
  const lines = featureSection.split(/\r?\n/)

  for (const line of lines) {
    const sanitized = line.replace(/#.*/, '').trim()
    if (!sanitized) {
      continue
    }

    const match = sanitized.match(/^([A-Za-z0-9_-]+)\s*=\s*(\[[^\]]*\])\s*$/u)
    if (!match) {
      throw new Error(`Unsupported feature entry: ${line}`)
    }

    const key = match[1]
    features[key] = parseTomlArray(match[2].slice(1, -1))
  }

  return features
}

function normalizeFeatureEntries(rawFeatures: Record<string, string[]>): Record<string, string[]> {
  return Object.entries(rawFeatures)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<Record<string, string[]>>((acc, [key, values]) => {
      const normalizedValues = values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.replace(/^dep:/u, ''))
        .sort()
      acc[key] = normalizedValues
      return acc
    }, {})
}

function readCargoFeatures(cargoToml: string): Record<string, string[]> {
  const featureSection = extractTomlSection(cargoToml, 'features')
  return parseFeatureSection(featureSection)
}

export function extractTechSpecCargoToml(techSpecContent: string): string {
  const sectionMatch = techSpecContent.match(/##\s*1\.\s*Cargo\.toml/i)
  if (!sectionMatch) {
    throw new Error('Missing section: ## 1. Cargo.toml')
  }

  const afterSection = techSpecContent.slice(sectionMatch.index)
  const fenceMatch = afterSection.match(/```toml\s*([\s\S]*?)```/i)
  if (!fenceMatch) {
    throw new Error('Missing Cargo.toml TOML code block in technical spec')
  }

  return fenceMatch[1]
}

function readTechSpecFeatures(techSpecContent: string): Record<string, string[]> {
  const featureToml = extractTechSpecCargoToml(techSpecContent)
  const featureSection = extractTomlSection(featureToml, 'features')
  return parseFeatureSection(featureSection)
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

export function checkFeatureMatrix(
  root = path.resolve(__dirname, '..'),
  options: FeatureMatrixOptions = {},
): FeatureMatrixResult {
  const {
    featureKeys = FEATURE_KEYS_TO_CHECK,
    cargoTomlPath = path.join(root, 'Cargo.toml'),
    techSpecPath = path.join(root, 'docs/03-technical-spec.md'),
    cargoContent = fs.readFileSync(cargoTomlPath, 'utf8'),
    techSpecContent = fs.readFileSync(techSpecPath, 'utf8'),
  } = options

  const cargoFeatures = normalizeFeatureEntries(readCargoFeatures(cargoContent))
  const specFeatures = normalizeFeatureEntries(readTechSpecFeatures(techSpecContent))

  const checkedFeatures = new Set([...Object.keys(cargoFeatures), ...Object.keys(specFeatures)])
  const errors: string[] = []

  for (const key of featureKeys) {
    checkedFeatures.delete(key)
  }

  for (const key of featureKeys) {
    const cargoValue = cargoFeatures[key]
    const specValue = specFeatures[key]
    if (!cargoValue) {
      errors.push(`Cargo.toml missing feature: ${key}`)
      continue
    }
    if (!specValue) {
      errors.push(`docs/03-technical-spec.md missing feature: ${key}`)
      continue
    }
    if (!arraysEqual(cargoValue, [...specValue].sort())) {
      errors.push(
        `Feature mismatch for ${key}: cargo=${cargoValue.join(',')} spec=${specValue.join(',')}`,
      )
    }
  }

  for (const extra of [...checkedFeatures].sort()) {
    errors.push(`Feature set drift: extra feature ${extra} found only on one side`)
  }

  return {
    errors,
    checkedFeatures: [...new Set([...Object.keys(cargoFeatures), ...Object.keys(specFeatures)])].sort(),
    cargoFeatures,
    specFeatures,
  }
}

export function main(): number {
  const result = checkFeatureMatrix()

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`)
    }
    return 1
  }

  process.stdout.write(`feature matrix ok features=${result.checkedFeatures.length}\n`)
  return 0
}

if (require.main === module) {
  process.exitCode = main()
}
