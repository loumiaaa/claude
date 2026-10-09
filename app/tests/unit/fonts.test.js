'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');

// Petite archive ZIP (méthodes « stored » et « deflate ») pour tester le lecteur maison
function makeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content, deflate] of entries) {
    const data = deflate ? zlib.deflateRawSync(content) : content;
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

test('General Sans : lecture de l’archive Fontshare (stored + deflate)', async () => {
  const { readZip } = await import('../../scripts/fetch-general-sans.mjs');
  const woff = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(200, 7)]);
  const zip = makeZip([
    ['GeneralSans_Complete/Fonts/WEB/fonts/GeneralSans-Regular.woff2', woff, true],
    ['GeneralSans_Complete/License/FFL.txt', Buffer.from('ITF Free Font License'), false]
  ]);
  const files = readZip(zip);
  assert.deepEqual(files.map((f) => f.name), ['GeneralSans_Complete/Fonts/WEB/fonts/GeneralSans-Regular.woff2', 'GeneralSans_Complete/License/FFL.txt']);
  assert.deepEqual(files[0].read(), woff);
  assert.equal(files[1].read().toString(), 'ITF Free Font License');
  assert.throws(() => readZip(Buffer.from('pas une archive')), /ZIP/);
});

test('General Sans : la copie du renderer ajoute url() après local(), sans toucher design/', () => {
  const app = path.join(__dirname, '../..');
  const fontsDir = path.join(app, 'renderer/fonts/general-sans');
  const hadFonts = fs.existsSync(fontsDir);
  const source = fs.readFileSync(path.join(app, '../design/fonts/fonts.css'), 'utf8');
  if (!hadFonts) {
    fs.mkdirSync(fontsDir, { recursive: true });
    for (const f of ['Regular', 'Medium', 'Semibold', 'Bold']) fs.writeFileSync(path.join(fontsDir, `GeneralSans-${f}.woff2`), 'wOF2');
  }
  try {
    execFileSync(process.execPath, [path.join(app, 'scripts/sync-design.mjs')], { stdio: 'pipe' });
    const css = fs.readFileSync(path.join(app, 'renderer/design/fonts/fonts.css'), 'utf8');
    assert.match(css, /src: local\("General Sans"\), local\("GeneralSans-Regular"\), local\("General Sans Regular"\), url\("\.\.\/\.\.\/fonts\/general-sans\/GeneralSans-Regular\.woff2"\) format\("woff2"\);/);
    assert.match(css, /GeneralSans-Bold\.woff2/);
    assert.equal(fs.readFileSync(path.join(app, '../design/fonts/fonts.css'), 'utf8'), source);
  } finally {
    if (!hadFonts) fs.rmSync(path.join(app, 'renderer/fonts'), { recursive: true, force: true });
    execFileSync(process.execPath, [path.join(app, 'scripts/sync-design.mjs')], { stdio: 'pipe' });
  }
  if (!hadFonts) assert.doesNotMatch(fs.readFileSync(path.join(app, 'renderer/design/fonts/fonts.css'), 'utf8'), /url\("\.\.\/\.\.\/fonts/);
});
