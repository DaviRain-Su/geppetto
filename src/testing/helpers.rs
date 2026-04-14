//! # Testing Helper Functions
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//! > **Verified against**: Solana 2.2.x
//!
//! Assertion helpers for verifying account state in tests.

/// Assert that account data at a given offset equals expected bytes.
pub fn assert_account_data(data: &[u8], offset: usize, expected: &[u8], field_name: &str) {
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
        data[0], expected,
        "discriminator mismatch: expected {}, got {}",
        expected, data[0]
    );
}

/// Assert a u64 LE value at offset matches expected.
pub fn assert_u64_le(data: &[u8], offset: usize, expected: u64, field_name: &str) {
    let actual = crate::idioms::read_u64_le(data, offset).expect("offset out of bounds");
    assert_eq!(
        actual, expected,
        "field '{}' at offset {}: expected {}, got {}",
        field_name, offset, expected, actual
    );
}
