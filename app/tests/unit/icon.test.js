'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('icône : ICO valide avec 7 tailles (16 → 256 px), images PNG', async () => {
  const { readIco, decodePng, SIZES } = await import('../../scripts/make-icon.mjs');
  const buf = fs.readFileSync(path.join(__dirname, '../../build/icon.ico'));
  assert.equal(buf.readUInt16LE(0), 0);
  assert.equal(buf.readUInt16LE(2), 1);                 // type : icône
  const entries = readIco(buf);
  assert.deepEqual(entries.map((e) => e.width), SIZES);
  for (const e of entries) {
    const png = buf.subarray(e.offset, e.offset + e.bytes);
    const img = decodePng(png);
    assert.equal(img.width, e.width);
    assert.equal(img.height, e.height);
  }
  assert.deepEqual(fs.readFileSync(path.join(__dirname, '../../main/assets/icon.ico')), buf);
});

test('icône : encodeur et décodeur PNG cohérents (aller-retour)', async () => {
  const { encodePng, decodePng } = await import('../../scripts/make-icon.mjs');
  const data = Buffer.alloc(3 * 2 * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 37) & 255;
  const back = decodePng(encodePng({ width: 3, height: 2, data }));
  assert.deepEqual(back.data, data);
});
