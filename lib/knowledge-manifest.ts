import fs from 'node:fs'
import path from 'node:path'

export interface KnowledgeTarget {
  relativePath: string
  ecosystem: string
  expectedVersion?: string
  sourcePath?: string
}

export const KNOWLEDGE_HEADER_TARGETS: ReadonlyArray<KnowledgeTarget> = Object.freeze([
  { relativePath: 'src/lib.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/error.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/schema.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/guard.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/dispatch.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/anti_patterns.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/client.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/idioms/mod.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/idioms/accounts.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/idioms/architecture.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/idioms/cpi.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/idioms/entrypoint.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/idioms/events.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/idioms/helpers.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/idioms/pda.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/testing/mod.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/testing/helpers.rs', ecosystem: 'pinocchio' },
  { relativePath: 'src/testing/mollusk.rs', ecosystem: 'mollusk-svm', expectedVersion: '0.12' },
  { relativePath: 'src/testing/litesvm.rs', ecosystem: 'litesvm', expectedVersion: '0.11' },
])

export function getKnowledgeManifestRoot(): string {
  return path.resolve(__dirname, '..')
}

export function getKnowledgeHeaderTargets(root: string = getKnowledgeManifestRoot()): Array<Required<KnowledgeTarget>> {
  return KNOWLEDGE_HEADER_TARGETS.map((target) => ({
    ...target,
    sourcePath: path.join(root, target.relativePath),
  })) as Array<Required<KnowledgeTarget>>
}

export function assertKnowledgeHeaderManifest(
  root: string = getKnowledgeManifestRoot(),
  manifest: Array<Required<KnowledgeTarget>> = getKnowledgeHeaderTargets(root),
): void {
  const seen = new Set<string>()

  for (const target of manifest) {
    if (path.isAbsolute(target.relativePath)) {
      throw new Error(`Knowledge target path must be relative: ${target.relativePath}`)
    }
    if (target.relativePath.includes('\\')) {
      throw new Error(`Knowledge target path must use POSIX separators: ${target.relativePath}`)
    }
    if (seen.has(target.relativePath)) {
      throw new Error(`Duplicate knowledge target path: ${target.relativePath}`)
    }
    if (!fs.existsSync(target.sourcePath)) {
      throw new Error(`Missing knowledge target file: ${target.relativePath}`)
    }
    seen.add(target.relativePath)
  }
}
