#!/usr/bin/env node
const { execSync, spawn } = require('child_process');
const fs = require('fs');

function detectBrowser() {
  if (process.env.FOOD_CLAUDE_BROWSER) return process.env.FOOD_CLAUDE_BROWSER;

  if (process.platform === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app')) return 'chrome';
    if (fs.existsSync('/Applications/Microsoft Edge.app')) return 'msedge';
    if (fs.existsSync('/Applications/Firefox.app')) return 'firefox';
  }

  if (process.platform === 'win32') {
    const programFiles = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean);
    for (const pf of programFiles) {
      if (fs.existsSync(`${pf}\\Google\\Chrome\\Application\\chrome.exe`)) return 'chrome';
      if (fs.existsSync(`${pf}\\Microsoft\\Edge\\Application\\msedge.exe`)) return 'msedge';
      if (fs.existsSync(`${pf}\\Mozilla Firefox\\firefox.exe`)) return 'firefox';
    }
  }

  const candidates = [
    ['google-chrome', 'chrome'],
    ['google-chrome-stable', 'chrome'],
    ['microsoft-edge', 'msedge'],
    ['microsoft-edge-stable', 'msedge'],
    ['firefox', 'firefox'],
    ['chromium', 'chromium'],
    ['chromium-browser', 'chromium'],
  ];
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  for (const [cmd, channel] of candidates) {
    try {
      execSync(`${lookup} ${cmd}`, { stdio: 'pipe' });
      return channel;
    } catch (_) { /* not found */ }
  }

  return null;
}

let browser = detectBrowser();
if (!browser) {
  console.error('[food-claude] No system browser detected (looked for Chrome, Edge, Firefox).');
  console.error('[food-claude] Either install one, or set FOOD_CLAUDE_BROWSER to: chrome | msedge | firefox | chromium | webkit.');
  console.error('[food-claude] Falling back to Playwright-bundled Chromium for now (one-time ~200MB download on first launch).');
  browser = 'chromium';
}

console.error(`[food-claude] Using browser: ${browser}`);

const child = spawn('npx', ['-y', '@playwright/mcp@latest', '--browser', browser], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
