# Phase 5: Test Spec — Geppetto

> 状态：已验证
> 日期：2026-04-13
> 输入：Phase 3 技术规格 + Phase 4 任务拆解
> 原则：TDD——测试骨架先于实现代码编写

---

## 测试策略

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | `#[cfg(test)]` + `cargo test` | guard, schema, dispatch, idioms helpers, error |
| Doctest | `cargo test --doc` | 所有 doc comments 中的代码示例 |
| 集成测试 | `tests/` 目录 | 模块间交互（schema + guard 组合使用） |
| Fixture 测试 | `tests/fixtures/` + `tests/client_alignment.ts` | Rust ↔ TypeScript 布局对齐 |
| 示例程序测试 | `examples/escrow/tests/` + litesvm | escrow 端到端流程 |

---

## 1. guard.rs 测试

每个 guard 函数必须有 Happy Path / Boundary / Error 三类测试。

### 1.1 assert_signer

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assert_signer_happy() {
        // 构造 is_signer = true 的 mock AccountView
        // assert_signer(&account).unwrap();
    }

    #[test]
    fn test_assert_signer_error() {
        // 构造 is_signer = false 的 mock AccountView
        // assert_eq!(
        //     assert_signer(&account),
        //     Err(ProgramError::MissingRequiredSignature)
        // );
    }
}
```

### 1.2 assert_writable

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | is_writable = true | Ok(()) |
| Error | is_writable = false | Err(Immutable) |

### 1.3 assert_readonly

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | is_writable = false | Ok(()) |
| Error | is_writable = true | Err(GeppettoError::ExpectedReadonly) |

### 1.4 assert_owner

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | owner == expected | Ok(()) |
| Error | owner != expected | Err(InvalidAccountOwner) |
| Boundary | owner == system program (未初始化账户) | 如果 expected != system program → Err |

### 1.5 assert_pda

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | address 匹配 seeds 推导 | Ok(bump) |
| Error | address 不匹配 | Err(GeppettoError::PdaMismatch) |
| Boundary | seeds = &[] (空种子) | Ok(bump) — 合法 PDA |
| Boundary | seeds 包含空字节 &[b""] | Ok(bump) — 合法 |

### 1.6 assert_discriminator

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | data[0] == expected | Ok(()) |
| Error | data[0] != expected | Err(GeppettoError::InvalidDiscriminator) |
| Boundary | data 为空 | Err(AccountDataTooSmall) |
| Boundary | data 只有 1 字节且匹配 | Ok(()) |

### 1.7 assert_rent_exempt

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | lamports >= minimum | Ok(()) |
| Error | lamports < minimum | Err(AccountNotRentExempt) |
| Boundary | lamports == minimum 恰好 | Ok(()) |
| Boundary | data_len = 0 | minimum = 890880 |

### 1.8 assert_system_program

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | address == SYSTEM_PROGRAM_ID | Ok(()) |
| Error | address != SYSTEM_PROGRAM_ID | Err(IncorrectProgramId) |

### 1.9 assert_token_program

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy (Token) | address == SPL_TOKEN_PROGRAM_ID | Ok(()) |
| Happy (Token-2022) | address == TOKEN_2022_PROGRAM_ID | Ok(()) |
| Error | address == 其他 | Err(IncorrectProgramId) |

### 1.10 assert_current_program

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | owner == program_id | Ok(()) |
| Error | owner != program_id | Err(InvalidAccountOwner) |

### 1.11 assert_account_count

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | accounts.len() > expected | Ok(()) |
| Boundary | accounts.len() == expected | Ok(()) |
| Error | accounts.len() < expected | Err(NotEnoughAccountKeys) |
| Boundary | expected = 0 | Ok()（任何切片都 >= 0） |

### 1.12 assert_ata

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | address 匹配 ATA 推导 | Ok(()) |
| Error (wrong mint) | mint 不同 | Err(GeppettoError::PdaMismatch) |
| Error (wrong wallet) | wallet 不同 | Err(GeppettoError::PdaMismatch) |
| Error (wrong token program) | token_program 不是 SPL Token / Token-2022 | Err(IncorrectProgramId) |

---

## 2. schema.rs 测试

### 2.1 AccountSchema::validate

```rust
// 测试用 mock 账户类型
#[repr(C)]
struct MockAccount {
    discriminator: u8,
    value: u64,
}

impl AccountSchema for MockAccount {
    const LEN: usize = 16; // 1 + 7 + 8
    const DISCRIMINATOR: Option<u8> = Some(42);

    fn layout() -> &'static [(&'static str, &'static str, usize, usize)] {
        &[
            ("discriminator", "u8", 0, 1),
            ("value", "u64", 8, 8),
        ]
    }
}
```

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | data = [42, 0,0,0,0,0,0,0, 7,0,0,0,0,0,0,0], len=16 | Ok(()) |
| Error (short) | data.len() = 5 | Err(InvalidAccountLen) |
| Error (wrong discriminator) | data[0] = 99 | Err(InvalidAccountData) |
| Boundary (exact len) | data.len() == 16 | Ok(()) |
| Error (longer data) | data.len() == 20 | Err(InvalidAccountLen) |
| Boundary (None discriminator) | DISCRIMINATOR = None, data[0] = 任意 | Ok()（不检查） |

### 2.2 AccountSchema::try_from_account

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | owner 正确 + data 正确 | Ok(&MockAccount) |
| Error (wrong owner) | owner != program_id | Err(InvalidAccountOwner) |
| Error (short data) | data.len() != LEN | Err(InvalidAccountLen) |
| Error (wrong discriminator) | data[0] != DISCRIMINATOR | Err(InvalidAccountData) |

### 2.3 from_bytes_unchecked

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | 16 字节正确数据 | 返回 &MockAccount，字段值正确 |
| 验证零拷贝 | 修改原始 data → 引用的值也变 | 确认是指针转换不是拷贝 |

### 2.4 assert_account_size! 宏

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | size_of::<MockAccount>() == LEN | 编译通过 |
| Error | LEN 设错（比如 10） | 编译失败（compile_fail doctest） |

---

## 3. dispatch.rs 测试

### 3.1 split_tag

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | &[5, 1, 2, 3] | Ok((5, &[1, 2, 3])) |
| Boundary (single byte) | &[0] | Ok((0, &[])) |
| Boundary (tag = 255) | &[255, 0] | Ok((255, &[0])) |
| Error (empty) | &[] | Err(InvalidInstructionData) |

### 3.2 常量

```rust
#[test]
fn test_constants() {
    assert_eq!(SELF_CPI_EVENT_DISCRIMINATOR, 228);
    assert_eq!(BATCH_DISCRIMINATOR, 255);
}
```

---

## 4. error.rs 测试

### 4.1 GeppettoError → ProgramError 转换

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| InvalidDiscriminator | `.into()` | ProgramError::Custom(0x4700) |
| InvalidAccountLen | `.into()` | ProgramError::Custom(0x4701) |
| PdaMismatch | `.into()` | ProgramError::Custom(0x4702) |
| ExpectedReadonly | `.into()` | ProgramError::Custom(0x4703) |

### 4.2 错误码不重叠

```rust
#[test]
fn test_error_codes_unique() {
    let codes = [
        GeppettoError::InvalidDiscriminator as u32,
        GeppettoError::InvalidAccountLen as u32,
        GeppettoError::PdaMismatch as u32,
        GeppettoError::ExpectedReadonly as u32,
    ];
    let set: HashSet<u32> = codes.iter().copied().collect();
    assert_eq!(set.len(), codes.len(), "duplicate error codes");
}
```

---

## 5. idioms.rs 测试

### 5.1 close_account

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | account 有 1000 lamports, 10 字节数据 | recipient += 1000, account = 0 lamports, 数据全零 |
| Boundary | account 有 0 lamports | recipient 不变, 数据仍清零 |
| 验证数据清零 | 写入非零数据后 close | 所有字节 == 0 |

### 5.2 read_u64_le

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | data=[1,0,0,0,0,0,0,0], offset=0 | Ok(1) |
| Happy (非零偏移) | 16 字节 data, offset=8 | 正确读取后 8 字节 |
| Error (越界) | data.len()=4, offset=0 | Err(AccountDataTooSmall) |
| Boundary (恰好) | data.len()=8, offset=0 | Ok |
| Boundary (最大值) | data=[0xFF; 8], offset=0 | Ok(u64::MAX) |

### 5.3 write_u64_le

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | value=42, offset=0 | data[0..8] == 42u64.to_le_bytes() |
| Error (越界) | data.len()=4, offset=0 | Err(AccountDataTooSmall) |
| Roundtrip | write then read | read == original value |

### 5.4 read_address

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | 32 字节正确数据 | Ok(Address) |
| Error (越界) | data.len()=16, offset=0 | Err(AccountDataTooSmall) |
| Boundary | offset = data.len() - 32 | Ok（恰好到末尾） |

---

## 6. testing.rs 测试

### 6.1 assert_account_data

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | data 匹配 | 不 panic |
| Error | data 不匹配 | panic，消息含 field_name + offset |
| Error (越界) | offset 超出范围 | panic，消息含 "out of bounds" |

### 6.2 assert_discriminator (testing 版)

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | data[0] == expected | 不 panic |
| Error | data[0] != expected | panic，消息含 expected + actual |
| Error (空数据) | data = &[] | panic，消息含 "empty" |

### 6.3 assert_u64_le

| 用例 | 输入 | 预期结果 |
|------|------|----------|
| Happy | 值匹配 | 不 panic |
| Error | 值不匹配 | panic，消息含 field_name + expected + actual |

---

## 7. 集成测试

### 7.1 schema + guard 组合

```rust
// tests/integration.rs

#[test]
fn test_schema_validate_then_guard_check() {
    // 1. 构造 MockAccount 数据
    // 2. AccountSchema::validate 通过
    // 3. guard::assert_discriminator 通过
    // 4. guard::assert_owner 通过
    // 5. idioms::read_u64_le 正确读取字段
}

#[test]
fn test_full_instruction_handler_pattern() {
    // 模拟完整的指令处理流程：
    // 1. dispatch::split_tag
    // 2. guard::assert_account_count
    // 3. guard::assert_signer + assert_writable
    // 4. AccountSchema::try_from_account
    // 5. 业务逻辑（修改数据）
    // 6. idioms::write_u64_le
}
```

### 7.2 re-export 验证

```rust
// tests/reexport.rs

#[test]
fn test_pinocchio_types_accessible() {
    // 验证 geppetto::AccountView 等同于 pinocchio::account::AccountView
    // 验证 geppetto::Address 等同于 pinocchio::address::Address
    // 验证 geppetto::ProgramResult 等同于 pinocchio::ProgramResult
}

#[test]
fn test_feature_gated_modules() {
    // 验证 geppetto::system (需要 feature "system")
    // 验证 geppetto::token (需要 feature "token")
    // 编译测试：无 feature 时这些模块不存在
}
```

---

## 8. Fixture-based 客户端对齐测试

### 8.1 Rust 侧：生成 fixture

```rust
// tests/generate_fixtures.rs

#[test]
fn generate_escrow_fixture() {
    // 1. 用 MockAccount schema 构建一个已知数据的 Escrow 账户
    // 2. 序列化为 raw bytes
    // 3. 写入 tests/fixtures/escrow_account.bin
    // 4. 同时写 tests/fixtures/escrow_layout.json：
    //    { "discriminator": {"offset": 0, "size": 1, "value": 1},
    //      "status": {"offset": 1, "size": 1, "value": 0},
    //      "maker": {"offset": 2, "size": 32, "value": "base58..."},
    //      "amount": {"offset": 66, "size": 8, "value": 1000000} }
}
```

### 8.2 TypeScript 侧：验证对齐

```typescript
// tests/client_alignment.ts

import { readFileSync } from 'fs';

const data = readFileSync('tests/fixtures/escrow_account.bin');
const layout = JSON.parse(readFileSync('tests/fixtures/escrow_layout.json', 'utf8'));

// 逐字段验证
assert(data.readUInt8(layout.discriminator.offset) === layout.discriminator.value);
assert(data.readUInt8(layout.status.offset) === layout.status.value);
// ... Address 和 u64 字段同理
```

---

## 9. 测试命名约定

```
test_{module}_{function}_{scenario}

示例：
test_guard_assert_signer_happy
test_guard_assert_signer_error_not_signer
test_schema_validate_boundary_longer_data
test_dispatch_split_tag_empty_input
test_idioms_read_u64_le_max_value
```

---

## 10. Mock 策略

Pinocchio 的 `AccountView` 在测试中需要 mock。两种策略：

1. **直接构造原始字节缓冲区** — 按 Pinocchio 的内部布局构造 `AccountView` 需要的内存。这是最接近真实的方式，但需要了解 Pinocchio 的内部 ABI。

2. **使用 mollusk-svm** — 在 SVM 模拟器中执行指令，不直接 mock AccountView。这是官方推荐的测试方式。

**决策**：单元测试用策略 1（快速、无外部依赖），集成测试用策略 2（mollusk-svm，验证完整链路）。

---

## 测试数量汇总

| 模块 | Happy | Boundary | Error | 合计 |
|------|-------|----------|-------|------|
| guard.rs (12 函数) | 12 | 8 | 12 | 32 |
| schema.rs | 4 | 4 | 4 | 12 |
| dispatch.rs | 2 | 2 | 1 | 5 |
| error.rs | 4 | 0 | 1 | 5 |
| idioms.rs (4 函数) | 4 | 4 | 4 | 12 |
| testing.rs (3 函数) | 3 | 0 | 3 | 6 |
| 集成测试 | 2 | 0 | 0 | 2 |
| re-export 验证 | 2 | 0 | 0 | 2 |
| fixture 对齐 | 1 | 0 | 0 | 1 |
| **合计** | **34** | **18** | **25** | **77** |

---

## Phase 5 验收标准

> 注：以下验收的是**测试规格文档本身的完整性**（"是否设计清楚了"），不是代码实现。本节中的 `77` 个用例是 Phase 5 的设计目标，用于覆盖后续单元、集成、re-export 与 fixture 对齐测试。当前仓库已完成核心实现并通过 `65` 个单元测试；实际执行状态见 `docs/06-implementation-log.md` 与 `docs/07-review-report.md`。

- [x] 每个公开函数有 happy/boundary/error 三类测试（规格设计完成）
- [x] 测试用例表覆盖 Phase 3 的全部 20 个边界条件（规格设计完成）
- [x] Mock 策略明确（单元用字节缓冲，集成用 mollusk-svm）
- [x] Fixture-based 客户端对齐测试设计完成
- [x] 测试命名约定已定义
- [x] 总计 77 个测试用例（规格设计完成，后续实现可按模块分批落地）
- [x] 可进入 Phase 6: Implementation
