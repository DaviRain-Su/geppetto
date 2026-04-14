//! Fixture generator: serializes known Escrow account data to files
//! so TypeScript tests can verify layout alignment.
//!
//! Run: `cargo test --test generate_fixtures`
//! Output: tests/fixtures/escrow_account.bin + escrow_layout.json

use geppetto::schema::AccountSchema;
use geppetto_escrow::state::{status, Escrow};
use std::fs;
use std::path::Path;

/// Known test values for the Escrow account.
const DISCRIMINATOR: u8 = 1;
const STATUS: u8 = status::OPEN;
const MAKER: [u8; 32] = [2u8; 32];
const TAKER: [u8; 32] = [0u8; 32]; // zeroed (not yet assigned)
const AMOUNT: u64 = 1_000_000;

#[test]
fn generate_escrow_fixture() {
    // Build raw account bytes matching Escrow layout
    let mut data = vec![0u8; Escrow::LEN];

    data[Escrow::DISCRIMINATOR_OFFSET] = DISCRIMINATOR;
    data[Escrow::STATUS_OFFSET] = STATUS;
    data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32].copy_from_slice(&MAKER);
    data[Escrow::TAKER_OFFSET..Escrow::TAKER_OFFSET + 32].copy_from_slice(&TAKER);
    data[Escrow::AMOUNT_OFFSET..Escrow::AMOUNT_OFFSET + 8]
        .copy_from_slice(&AMOUNT.to_le_bytes());

    // Write binary fixture
    let fixture_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    fs::create_dir_all(&fixture_dir).unwrap();

    fs::write(fixture_dir.join("escrow_account.bin"), &data).unwrap();

    // Write JSON layout (for TypeScript to read)
    let layout_json = format!(
        r#"{{
  "total_len": {total_len},
  "fields": [
    {{ "name": "discriminator", "type": "u8",      "offset": {d_off}, "size": 1,  "value": {d_val} }},
    {{ "name": "status",        "type": "u8",      "offset": {s_off}, "size": 1,  "value": {s_val} }},
    {{ "name": "maker",         "type": "Address",  "offset": {m_off}, "size": 32, "value": "{m_hex}" }},
    {{ "name": "taker",         "type": "Address",  "offset": {t_off}, "size": 32, "value": "{t_hex}" }},
    {{ "name": "amount",        "type": "u64",      "offset": {a_off}, "size": 8,  "value": {a_val} }}
  ]
}}"#,
        total_len = Escrow::LEN,
        d_off = Escrow::DISCRIMINATOR_OFFSET,
        d_val = DISCRIMINATOR,
        s_off = Escrow::STATUS_OFFSET,
        s_val = STATUS,
        m_off = Escrow::MAKER_OFFSET,
        m_hex = hex::encode(MAKER),
        t_off = Escrow::TAKER_OFFSET,
        t_hex = hex::encode(TAKER),
        a_off = Escrow::AMOUNT_OFFSET,
        a_val = AMOUNT,
    );

    fs::write(fixture_dir.join("escrow_layout.json"), layout_json).unwrap();

    // Verify the binary matches what we'd read back
    let read_back = fs::read(fixture_dir.join("escrow_account.bin")).unwrap();
    assert_eq!(read_back.len(), Escrow::LEN);
    assert_eq!(read_back[Escrow::DISCRIMINATOR_OFFSET], DISCRIMINATOR);
    assert_eq!(
        u64::from_le_bytes(
            read_back[Escrow::AMOUNT_OFFSET..Escrow::AMOUNT_OFFSET + 8]
                .try_into()
                .unwrap()
        ),
        AMOUNT
    );

    println!("Fixtures generated at: {}", fixture_dir.display());
}
