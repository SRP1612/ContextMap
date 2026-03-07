/**
 * Builds a self-contained release folder that only requires Node.js to run.
 * Output: release/ContextMap/
 *   ├── dist/            (built frontend)
 *   ├── server/server.mjs (bundled backend — no node_modules needed)
 *   ├── .env.example
 *   ├── ContextMap.bat
 *   └── README.md
 */
import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'release', 'ContextMap');

// Clean previous release
rmSync(join(root, 'release'), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. Build frontend
console.log('Building frontend...');
execSync('npx vite build', { cwd: root, stdio: 'inherit' });

// 2. Bundle server
console.log('Bundling server...');
execSync(
  'npx esbuild server/index.ts --bundle --platform=node --format=esm ' +
    '--outfile=release/ContextMap/server/server.mjs ' +
    "--banner:js=\"import{createRequire as __cr}from'module';const require=__cr(import.meta.url);\"",
  { cwd: root, stdio: 'inherit' },
);

// 3. Copy built frontend
cpSync(join(root, 'dist'), join(out, 'dist'), { recursive: true });

// 4. Copy static files
cpSync(join(root, '.env.example'), join(out, '.env.example'));
cpSync(join(root, 'README.md'), join(out, 'README.md'));
cpSync(join(root, 'LICENSE'), join(out, 'LICENSE'));

// 5. Create release launcher
writeFileSync(
  join(out, 'ContextMap.bat'),
  '@echo off\r\n' +
    'title ContextMap\r\n' +
    'cd /d "%~dp0"\r\n' +
    '\r\n' +
    'where node >nul 2>nul\r\n' +
    'if %errorlevel% neq 0 (\r\n' +
    '    echo ERROR: Node.js is not installed or not in PATH.\r\n' +
    '    echo Download it from https://nodejs.org/\r\n' +
    '    pause\r\n' +
    '    exit /b 1\r\n' +
    ')\r\n' +
    '\r\n' +
    'if not exist .env (\r\n' +
    '    echo ERROR: .env file not found.\r\n' +
    '    echo Copy .env.example to .env and paste your Gemini API key.\r\n' +
    '    pause\r\n' +
    '    exit /b 1\r\n' +
    ')\r\n' +
    '\r\n' +
    'echo Starting ContextMap...\r\n' +
    'node server/server.mjs\r\n' +
    'pause\r\n',
);

console.log('\n✅ Release built → release/ContextMap/');
console.log('   Zip that folder and distribute it.');
