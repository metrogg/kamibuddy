// asar extractor: robust header parsing + selective extraction
// Usage:
//   node asar-extract.js <asar> list [prefixFilter]
//   node asar-extract.js <asar> extract-all <outDir> [prefixFilter]
//   node asar-extract.js <asar> extract-file <pathInAsar> <outFile>
const fs = require('fs');
const path = require('path');

const asarPath = process.argv[2];
const cmd = process.argv[3];

const fd = fs.openSync(asarPath, 'r');
const pre = Buffer.alloc(16);
fs.readSync(fd, pre, 0, 16, 0);
// chromium Pickle: [payload_size][string_length][string bytes...]
// some versions wrap twice; detect by locating first '{"files"'
let header = null, headerSize = 0, dataOffset = 0;
const pickleSize = pre.readUInt32LE(0);
const strLen = pre.readUInt32LE(4);
function tryParse(off, len) {
  const b = Buffer.alloc(len);
  fs.readSync(fd, b, 0, len, off);
  const s = b.toString('utf8');
  const start = s.indexOf('{"files"');
  if (start === -1) return null;
  try { return JSON.parse(s.slice(start)); } catch (e) { return null; }
}
// candidate: string starts at offset 8, length strLen; pickle total = 4 + pickleSize
header = tryParse(8, strLen);
if (header) {
  dataOffset = 8 + Math.ceil(strLen / 4) * 4;
  // asar data section starts after 4 (pickleSize field) + pickleSize, aligned
  dataOffset = 4 + pickleSize;
} else {
  // fallback: scan first 1KB for {"files"
  const probe = Buffer.alloc(1024);
  fs.readSync(fd, probe, 0, 1024, 0);
  const idx = probe.indexOf('{"files"');
  if (idx === -1) { console.error('header not found'); process.exit(1); }
  // assume 4-byte length right before it
  const len = probe.readUInt32LE(idx - 4);
  header = tryParse(idx, len);
  if (!header) { console.error('header parse failed'); process.exit(1); }
  dataOffset = idx + Math.ceil(len / 4) * 4;
}

const rows = [];
function walk(node, prefix) {
  if (node.files) {
    for (const [name, child] of Object.entries(node.files)) walk(child, prefix ? prefix + '/' + name : name);
  } else if (node.link !== undefined) {
    rows.push({ path: prefix, link: node.link, size: 0, unpacked: !!node.unpacked });
  } else {
    rows.push({ path, size: node.size ?? 0, unpacked: !!node.unpacked, offset: node.offset });
  }
}
walk(header, '');

if (cmd === 'list') {
  const filter = process.argv[4] || '';
  for (const r of rows) if (!filter || r.path.startsWith(filter)) console.log(`${r.size}\t${r.unpacked ? 'U' : ' '}\t${r.path}`);
  console.error(`TOTAL ${rows.length}`);
} else if (cmd === 'extract-all') {
  const outDir = process.argv[4];
  const filter = process.argv[5] || '';
  let n = 0;
  for (const r of rows) {
    if (r.link !== undefined) continue;
    if (r.unpacked) continue; // unpacked files live on disk already
    if (filter && !r.path.startsWith(filter)) continue;
    const dest = path.join(outDir, r.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const b = Buffer.alloc(r.size);
    fs.readSync(fd, b, 0, r.size, dataOffset + Number(r.offset));
    fs.writeFileSync(dest, b);
    n++;
  }
  console.log(`extracted ${n} files -> ${outDir} (dataOffset=${dataOffset})`);
} else if (cmd === 'extract-file') {
  const p = process.argv[4], outFile = process.argv[5];
  const r = rows.find(x => x.path === p);
  if (!r) { console.error('not found: ' + p); process.exit(1); }
  const b = Buffer.alloc(r.size);
  fs.readSync(fd, b, 0, r.size, dataOffset + Number(r.offset));
  fs.writeFileSync(outFile, b);
  console.log(`ok ${p} -> ${outFile} (${r.size} bytes)`);
}
fs.closeSync(fd);
