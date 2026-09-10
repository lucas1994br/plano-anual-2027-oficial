const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('google_apps_script.js', 'utf8');

// Mock Apps Script globals
const sandbox = {
  SpreadsheetApp: {},
  Utilities: {
    getUuid: () => '12345678-1234-1234-1234-123456789abc',
    computeDigest: () => [],
    Charset: { UTF_8: 'UTF-8' },
    DigestAlgorithm: { SHA_256: 'SHA_256' }
  },
  ContentService: {
    createTextOutput: () => ({ setMimeType: () => {} }),
    MimeType: { JSON: 'application/json' }
  },
  LockService: {
    getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} })
  },
  console: console
};

try {
  vm.runInNewContext(code, sandbox);
  console.log('SUCCESS: google_apps_script.js parsed and loaded without syntax errors!');
  
  // Test canonical UUID helpers
  console.log('UUID valid test:', sandbox.ensureCanonicalUuid('00149c22-e917-4956-bf32-365c76fa4a07'));
  console.log('UUID invalid fallback test:', sandbox.ensureCanonicalUuid('not-a-uuid'));
  
  // Test numeric formatting
  console.log('parseSafeNumberGAS date test (3329-10-01):', sandbox.parseSafeNumberGAS(new Date('3329-10-01T03:00:00.000Z')));
  console.log('parseSafeNumberGAS currency test:', sandbox.parseSafeNumberGAS('R$ 1.327,65'));
  console.log('formatCellSafe item test:', sandbox.formatCellSafe('item', '5'));
  console.log('formatCellSafe codigo test:', sandbox.formatCellSafe('codigo', '102440'));
  console.log('formatCellSafe boolean test:', sandbox.formatCellSafe('ativo', 'VERDADEIRO'));
} catch (e) {
  console.error('Syntax error:', e);
  process.exit(1);
}
