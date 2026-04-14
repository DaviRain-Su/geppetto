/**
 * Client Alignment Test
 *
 * Verifies that TypeScript deserialization of Escrow account data
 * matches the Rust-side AccountSchema layout exactly.
 *
 * Run:
 *   cargo test --test generate_fixtures   # generate fixtures first
 *   npx tsx tests/client_alignment.ts     # then run this
 *
 * Prerequisites: Node.js 18+, tsx (or ts-node)
 */

import { readFileSync } from "fs";
import { join } from "path";

// ── Load fixtures ──

const fixtureDir = join(__dirname, "fixtures");
const accountData = readFileSync(join(fixtureDir, "escrow_account.bin"));
const layout = JSON.parse(
  readFileSync(join(fixtureDir, "escrow_layout.json"), "utf8")
);

// ── Deserialization helpers (mirroring Rust AccountSchema offsets) ──

function readU8(data: Buffer, offset: number): number {
  return data.readUInt8(offset);
}

function readU64LE(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

function readAddress(data: Buffer, offset: number): string {
  return data.subarray(offset, offset + 32).toString("hex");
}

// ── Tests ──

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

console.log("Client Alignment Test: Escrow Account\n");

// Total length
assert(
  accountData.length === layout.total_len,
  `total length: ${accountData.length} === ${layout.total_len}`
);

// Field-by-field verification
for (const field of layout.fields) {
  const { name, type: fieldType, offset, size, value } = field;

  switch (fieldType) {
    case "u8": {
      const actual = readU8(accountData, offset);
      assert(actual === value, `${name} (u8 @ ${offset}): ${actual} === ${value}`);
      break;
    }
    case "u64": {
      const actual = readU64LE(accountData, offset);
      assert(
        actual === BigInt(value),
        `${name} (u64 @ ${offset}): ${actual} === ${value}`
      );
      break;
    }
    case "Address": {
      const actual = readAddress(accountData, offset);
      assert(
        actual === value,
        `${name} (Address @ ${offset}): ${actual === value ? "match" : actual + " !== " + value}`
      );
      break;
    }
    default:
      console.error(`  ⚠️  Unknown type: ${fieldType} for field ${name}`);
  }
}

// ── Summary ──

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("\n💥 Layout mismatch detected! Rust and TypeScript are out of sync.");
  process.exit(1);
} else {
  console.log("\n🎉 All fields aligned. Rust AccountSchema ↔ TypeScript offsets match.");
}
