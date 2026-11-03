'use strict';

const path = require('path');
const Mocha = require('mocha');

function run() {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 20000 });
  mocha.addFile(path.resolve(__dirname, 'extension.test.js'));
  return new Promise((resolve, reject) => {
    mocha.run((failures) => (failures ? reject(new Error(`${failures} tests failed.`)) : resolve()));
  });
}

module.exports = { run };
