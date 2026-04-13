//! # Testing Utilities
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Helpers for testing Pinocchio programs. Enable with:
//! `geppetto = { features = ["test-utils"] }`
//!
//! ## Testing Strategy
//!
//! Use a three-tier approach:
//!
//! 1. **Unit tests** — for pure helpers in `guard.rs` and `idioms.rs`.
//! 2. **Integration fixtures** — `mollusk-svm` for fast instruction-level tests.
//! 3. **End-to-end tests** — `litesvm` for full transaction simulation.
//!
//! ## mollusk-svm vs litesvm
//!
//! | Framework | Best for | Speed |
//! |-----------|----------|-------|
//! | mollusk-svm | Instruction logic, account shape, CU baseline | Very fast |
//! | litesvm | Full tx simulation, client alignment, CPI chains | Fast |
//!
//! Official programs (memo, escrow, rewards) use mollusk-svm or litesvm.
//! Do **not** use `solana-program-test` for new Pinocchio programs.
//!
//! ## CU Profiling
//!
//! When using mollusk-svm, capture compute unit consumption to prevent
//! regressions:
//!
//! ```rust,ignore
//! let result = mollusk.process_and_validate_instruction(
//!     &instruction,
//!     &vec![],
//!     &vec![],
//! );
//! println!("CU consumed: {}", result.compute_units);
//! ```
//!
//! Set a CU budget ceiling in CI and fail the build if any instruction exceeds
//! it. Typical starting points:
//! - Simple state updates: ~3k CU
//! - Token CPIs: ~10k CU
//! - Complex multi-CPI flows: ~30k CU

/// Assert that account data at a given offset equals expected bytes.
pub fn assert_account_data(
    data: &[u8],
    offset: usize,
    expected: &[u8],
    field_name: &str,
) {
    let end = offset.checked_add(expected.len()).unwrap_or_else(|| {
        panic!(
            "field '{}': offset {} + len {} overflow",
            field_name,
            offset,
            expected.len()
        )
    });
    assert!(
        end <= data.len(),
        "field '{}': offset {}..{} out of bounds (data len = {})",
        field_name,
        offset,
        end,
        data.len()
    );
    assert_eq!(
        &data[offset..end],
        expected,
        "field '{}' at offset {} does not match",
        field_name,
        offset
    );
}

/// Assert that the first byte of data matches the expected discriminator.
pub fn assert_discriminator(data: &[u8], expected: u8) {
    assert!(
        !data.is_empty(),
        "account data is empty for discriminator: expected {}",
        expected
    );
    assert_eq!(
        data[0],
        expected,
        "discriminator mismatch: expected {}, got {}",
        expected,
        data[0]
    );
}

/// Assert a u64 LE value at offset matches expected.
pub fn assert_u64_le(data: &[u8], offset: usize, expected: u64, field_name: &str) {
    let actual = crate::idioms::read_u64_le(data, offset).expect("offset out of bounds");
    assert_eq!(
        actual,
        expected,
        "field '{}' at offset {}: expected {}, got {}",
        field_name,
        offset,
        expected,
        actual
    );
}
