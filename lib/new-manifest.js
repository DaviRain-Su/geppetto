const path = require('node:path');

const NEW_PROJECT_TEMPLATE_FILES = Object.freeze([
  {
    relativePath: 'Cargo.toml',
    content: '[package]\\nname = "{{PACKAGE_NAME}}"\\nversion = "0.1.0"\\nedition = "2024"\\npublish = false\\n\\n[dependencies]\\ngeppetto = "0.1"\\n\\n[lib]\\ncrate-type = ["cdylib", "lib"]\\n',
  },
  {
    relativePath: 'src/lib.rs',
    content: '#![no_std]\\n\\n//! Program: {{PROGRAM_NAME}}\\n\\nuse geppetto::address::Address;\\nuse geppetto::account::AccountView;\\nuse geppetto::ProgramResult;\\n\\npub mod processor;\\n\\ngeppetto::program_entrypoint!(process_instruction);\\ngeppetto::default_allocator!();\\ngeppetto::nostd_panic_handler!();\\n\\npub fn process_instruction(\\n    program_id: &Address,\\n    accounts: &mut [AccountView],\\n    data: &[u8],\\n) -> ProgramResult {\\n    processor::process_instruction(program_id, accounts, data)\\n}\\n',
  },
  {
    relativePath: 'src/processor.rs',
    content: '// {{CRATE_NAME}}\\nuse geppetto::account::AccountView;\\nuse geppetto::address::Address;\\nuse geppetto::ProgramResult;\\n\\npub fn process_instruction(\\n    _program_id: &Address,\\n    _accounts: &mut [AccountView],\\n    _data: &[u8],\\n) -> ProgramResult {\\n    Ok(())\\n}\\n',
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
