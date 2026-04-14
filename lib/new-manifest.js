const fs = require('node:fs');
const path = require('node:path');
const {
  assertTemplateManifest,
  getTemplateEntries,
  getTemplateRoot: getCanonicalTemplateRoot,
} = require('./templates');

const NEW_PROJECT_RUST_TEMPLATE_FILES = Object.freeze([
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
    content:
      '// SVM tests for {{PACKAGE_NAME}}.\\n' +
      '//\\n' +
      '// 1. Run before these tests: `cargo build-sbf`.\\n' +
      '// 2. Replace the placeholder tests with real happy/error paths.\\n' +
      '// 3. Keep the helper functions if they match your instruction schema.\\n' +
      '\n' +
      'use std::path::Path;\\n' +
      '\n' +
      'const PROGRAM_ID_PLACEHOLDER: &str = "CHANGE_ME";\\n' +
      '\n' +
      'fn build_ix_data(tag: u8, payload: &[u8]) -> Vec<u8> {\\n' +
      '    let mut data = vec![tag];\\n' +
      '    data.extend_from_slice(payload);\\n' +
      '    data\\n' +
      '}\\n' +
      '\n' +
      'fn setup_mollusk() -> String {\\n' +
      '    let elf_path = Path::new(env!(\"CARGO_MANIFEST_DIR\"))\\n' +
      '        .join(\"target\")\\n' +
      '        .join(\"deploy\")\\n' +
      '        .join(\"{{PACKAGE_NAME}}.so\");\\n' +
      '    if !elf_path.exists() {\\n' +
      '        panic!(\\n' +
      '            \"SBF artifact missing: {}. Run `cargo build-sbf` first.\",\\n' +
      '            elf_path.display(),\\n' +
      '        );\\n' +
      '    }\\n' +
      '\n' +
      '    elf_path\\n' +
      '        .to_str()\\n' +
      '        .map(|value| value.to_owned())\\n' +
      '        .expect(\"ELF path is not valid UTF-8\")\\n' +
      '}\\n' +
      '\n' +
      'fn setup_program_id() -> [u8; 32] {\\n' +
      '    let bytes = PROGRAM_ID_PLACEHOLDER.as_bytes();\\n' +
      '    let mut program_id = [0u8; 32];\\n' +
      '    let len = bytes.len().min(program_id.len());\\n' +
      '    program_id[..len].copy_from_slice(&bytes[..len]);\\n' +
      '    program_id\\n' +
      '}\\n' +
      '\n' +
      '#[test]\\n' +
      'fn test_build_ix_data() {\\n' +
      '    let payload = vec![0xAB, 0xCD];\\n' +
      '    let ix = build_ix_data(7, &payload);\\n' +
      '    assert_eq!(ix, vec![7, 0xAB, 0xCD]);\\n' +
      '    assert_eq!(setup_program_id().len(), 32);\\n' +
      '}\\n' +
      '\n' +
      '#[test]\\n' +
      'fn test_setup_mollusk_instructs_build_first() {\\n' +
      '    assert_eq!(\\n' +
      '        PROGRAM_ID_PLACEHOLDER,\\n' +
      '        \"CHANGE_ME\"\\n' +
      '    );\\n' +
      '}\\n' +
      '\n' +
      '// Replace these with real happy/error assertions after adding your runtime fixture.\\n' +
      '#[test]\\n' +
      '#[ignore = "wire real happy path with Mollusk once instruction model is added"]\\n' +
      'fn test_svm_placeholder_happy_path() {\\n' +
      '    let elf_path = setup_mollusk();\\n' +
      '    let ix = build_ix_data(0, &[0x01]);\\n' +
      '    assert!(!elf_path.is_empty());\\n' +
      '    assert!(!ix.is_empty());\\n' +
      '}\\n' +
      '\\n' +
      '#[test]\\n' +
      '#[ignore = "wire real error path with Mollusk once instruction model is added"]\\n' +
      'fn test_svm_placeholder_error_path() {\\n' +
      '    let ix = build_ix_data(0, &[0x00]);\\n' +
      '    assert_eq!(ix[0], 0);\\n' +
      '    assert!(!ix.is_empty());\\n' +
      '}\\n',
  },
]);

function getTemplateRoot() {
  return getCanonicalTemplateRoot();
}

function getCanonicalProjectTemplateEntries(templateRoot = getTemplateRoot()) {
  const templateEntries = getTemplateEntries(templateRoot);
  const entries = [];

  for (const { relativePath, sourcePath } of templateEntries) {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing canonical template source: ${sourcePath}`);
    }

    const content = fs.readFileSync(sourcePath, 'utf8');
    entries.push({
      relativePath,
      content,
      sourcePath,
    });
  }

  return entries;
}

function assertNewProjectManifest(templateRoot = getTemplateRoot()) {
  const canonicalEntries = getCanonicalProjectTemplateEntries(templateRoot);
  const seen = new Set();

  assertTemplateManifest(templateRoot);

  for (const { relativePath, content } of canonicalEntries) {
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

  for (const { relativePath, content } of NEW_PROJECT_RUST_TEMPLATE_FILES) {
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

function getNewProjectTemplateEntries(templateRoot = getTemplateRoot()) {
  return [
    ...NEW_PROJECT_RUST_TEMPLATE_FILES,
    ...getCanonicalProjectTemplateEntries(templateRoot),
  ];
}

module.exports = {
  NEW_PROJECT_RUST_TEMPLATE_FILES,
  assertNewProjectManifest,
  getNewProjectTemplateEntries,
  getCanonicalProjectTemplateEntries,
  getTemplateRoot,
};
