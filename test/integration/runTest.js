'use strict';

const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '../..');
  const extensionTestsPath = path.resolve(__dirname, './suite/index.js');
  const workspace = path.resolve(__dirname, '../fixtures');
  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspace, '--disable-extensions', '--disable-workspace-trust']
    });
  } catch (err) {
    console.error('Integration tests failed:', err);
    process.exit(1);
  }
}

main();
