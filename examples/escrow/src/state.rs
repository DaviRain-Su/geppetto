use geppetto::address::Address;
use geppetto::schema::AccountSchema;

/// Escrow account — holds the terms of the exchange.
///
/// We avoid `#[repr(C)]` struct with mixed-alignment fields because
/// `u64` would insert padding after `Address` fields. Instead, we use
/// a unit struct with offset constants and manual byte access — the
/// same pattern used by official Pinocchio programs.
///
/// Layout (74 bytes):
/// ```text
/// [0]      discriminator  u8       1 byte
/// [1]      status         u8       1 byte   (0=Open, 1=Exchanged, 2=Closed)
/// [2..34]  maker          Address  32 bytes
/// [34..66] taker          Address  32 bytes  (zeroed until exchange)
/// [66..74] amount         u64 LE   8 bytes
/// ```
pub struct Escrow;

impl AccountSchema for Escrow {
    const LEN: usize = 74; // 1 + 1 + 32 + 32 + 8
    const DISCRIMINATOR: Option<u8> = Some(1);

    fn layout() -> &'static [(&'static str, &'static str, usize, usize)] {
        &[
            ("discriminator", "u8", 0, 1),
            ("status", "u8", 1, 1),
            ("maker", "Address", 2, 32),
            ("taker", "Address", 34, 32),
            ("amount", "u64", 66, 8),
        ]
    }
}

impl Escrow {
    // Field offsets for direct byte access
    pub const DISCRIMINATOR_OFFSET: usize = 0;
    pub const STATUS_OFFSET: usize = 1;
    pub const MAKER_OFFSET: usize = 2;
    pub const TAKER_OFFSET: usize = 34;
    pub const AMOUNT_OFFSET: usize = 66;
}

/// Escrow status values.
pub mod status {
    pub const OPEN: u8 = 0;
    pub const EXCHANGED: u8 = 1;
    pub const CLOSED: u8 = 2;
}

/// PDA seeds for the escrow account.
///
/// `["escrow", maker_address]` -> unique per maker.
pub fn escrow_seeds<'a>(maker: &'a Address) -> [&'a [u8]; 2] {
    [b"escrow", maker.as_ref()]
}
