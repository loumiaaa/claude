#!/usr/bin/env node
// Tests end-to-end (Playwright _electron) sur le build Linux packagé.
// 1. construit dist/linux-unpacked avec le binaire Electron installé par npm
//    (LAMIA_E2E=1 : fusible d'inspection ouvert pour Playwright) ;
// 2. lance node --test sur tests/e2e/ (sous Xvfb s'il n'y a pas d'écran).
// Playwright n'est pas une dépendance du projet : on utilise l'installation
// globale (NODE_PATH = npm root -g), Chromium n'est pas nécessaire.
// Options : --no-build (réutilise le build existant).

import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const require = createRequire(import.meta.url);
const env = Object.assign({}, process.env, { LAMIA_E2E: '1' });

try { require.resolve('playwright'); } catch (e) {
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  env.NODE_PATH = [globalRoot, env.NODE_PATH].filter(Boolean).join(delimiter);
}

const exe = resolve(appDir, 'dist', 'linux-unpacked', 'plateforme-suivi-lamia');
if (!process.argv.includes('--no-build') || !existsSync(exe)) {
  const r = spawnSync('npm', ['run', 'build:linux-dir'], { cwd: appDir, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status || 1);
}
env.LAMIA_E2E_EXE = exe;

const args = ['--test', '--test-concurrency=1', 'tests/e2e/*.test.js'];
const needX = process.platform === 'linux' && !env.DISPLAY;
const cmd = needX ? 'xvfb-run' : process.execPath;
const argv = needX ? ['-a', '-s', '-screen 0 1920x1080x24', process.execPath, ...args] : args;
const r = spawnSync(cmd, argv, { cwd: appDir, env, stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
