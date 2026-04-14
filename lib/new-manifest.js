const path = require('node:path');

const NEW_PROJECT_TEMPLATE_FILES = Object.freeze([
  {
    relativePath: 'Cargo.toml',
    content: '[package]\\nname = "{{PACKAGE_NAME}}"\\nversion = "0.1.0"\\nedition = "2024"\\npublish = false\\n\\n[dependencies]\\ngeppetto = "0.1"\\n\\n[lib]\\ncrate-type = ["cdylib", "lib"]\\n',
  },
  {
    relativePath: 'src/lib.rs',
    content: '#![no_std]\\n\\n//! Program: {{PROGRAM_NAME}}\\n\\nuse geppetto::account::AccountView;\\nuse geppetto::address::Address;\\nuse geppetto::ProgramResult;\\n\\npub mod error;\\npub mod instructions;\\npub mod processor;\\npub mod state;\\n\\ngeppetto::program_entrypoint!(process_instruction);\\ngeppetto::default_allocator!();\\ngeppetto::nostd_panic_handler!();\\n\\npub fn process_instruction(\\n    program_id: &Address,\\n    accounts: &mut [AccountView],\\n    data: &[u8],\\n) -> ProgramResult {\\n    processor::process_instruction(program_id, accounts, data)\\n}\\n',
  },
  {
    relativePath: 'src/processor.rs',
    content: '// {{CRATE_NAME}}\\nuse geppetto::account::AccountView;\\nuse geppetto::address::Address;\\nuse geppetto::dispatch;\\nuse geppetto::error::ProgramError;\\nuse geppetto::ProgramResult;\\n\\nuse crate::instructions;\\n\\npub fn process_instruction(\\n    _program_id: &Address,\\n    accounts: &mut [AccountView],\\n    data: &[u8],\\n) -> ProgramResult {\\n    let (tag, rest) = dispatch::split_tag(data)?;\\n\\n    match tag {\\n        0 => instructions::handle_placeholder(_program_id, accounts, rest),\\n        _ => Err(ProgramError::InvalidInstructionData),\\n    }\\n}\\n',
  },
  {
    relativePath: 'src/state.rs',
    content: 'use geppetto::schema::AccountSchema;\\n\\n#[repr(C)]\\n#[derive(Clone, Copy)]\\npub struct ExampleAccount {\\n    pub discriminator: u8,\\n    pub count: u64,\\n    pub _padding: [u8; 7],\\n}\\n\\nimpl ExampleAccount {\\n    pub const LEN: usize = 16;\\n    pub const DISCRIMINATOR: Option<u8> = Some(1);\\n    pub const DISCRIMINATOR_OFFSET: usize = 0;\\n    pub const COUNT_OFFSET: usize = 1;\\n}\\n\\nimpl AccountSchema for ExampleAccount {\\n    const LEN: usize = Self::LEN;\\n    const DISCRIMINATOR: Option<u8> = Self::DISCRIMINATOR;\\n\\n    const DISCRIMINATOR_OFFSET: usize = Self::DISCRIMINATOR_OFFSET;\\n}\\n',
  },
  {
    relativePath: 'src/error.rs',
    content: 'use geppetto::error::ProgramError;\\n\\n#[derive(Debug, Clone, Copy, Eq, PartialEq)]\\n#[repr(u32)]\\npub enum ProgramErrorExt {\\n    InvalidState = 0x7001,\\n    AlreadyInitialized = 0x7002,\\n}\\n\\nimpl From<ProgramErrorExt> for ProgramError {\\n    fn from(err: ProgramErrorExt) -> Self {\\n        ProgramError::Custom(err as u32)\\n    }\\n}\\n',
  },
  {
    relativePath: 'src/instructions/mod.rs',
    content: 'use geppetto::account::AccountView;\\nuse geppetto::address::Address;\\nuse geppetto::error::ProgramError;\\nuse geppetto::ProgramResult;\\n\\n/// TODO: create per-tag handler modules and route real instruction logic here.\\npub fn handle_placeholder(\\n    _program_id: &Address,\\n    _accounts: &mut [AccountView],\\n    _data: &[u8],\\n) -> ProgramResult {\\n    Err(ProgramError::InvalidInstructionData)\\n}\\n',
  },
  {
    relativePath: 'tests/svm.rs',
    content: '#[test]\\nfn template_smoke() {\\n    assert_eq!(1 + 1, 2);\\n}\\n',
  },
]);

function getTemplateRoot() {
  return path.resolve(__dirname, '..');
}

function assertNewProjectManifest() {
  const seen = new Set();

  for (const { relativePath, content } of NEW_PROJECT_TEMPLATE_FILES) {
    if (path.isAbsolute(relativePath)) {
      throw new Error(`Template path must be relative: ${relativePath}`);
    }

    if (relativePath.includes('\\')) {
      throw new Error(`Template path must use POSIX separators: ${relativePath}`);
    }

    if (seen.has(relativePath)) {
      throw new Error(`Duplicate template path: ${relativePath}`);
    }

    if (typeof content !== 'string' || content.length === 0) {
      throw new Error(`Template content missing: ${relativePath}`);
    }

    seen.add(relativePath);
  }
}

function getNewProjectTemplateEntries() {
  return NEW_PROJECT_TEMPLATE_FILES;
}

module.exports = {
  NEW_PROJECT_TEMPLATE_FILES,
  assertNewProjectManifest,
  getNewProjectTemplateEntries,
  getTemplateRoot,
};
