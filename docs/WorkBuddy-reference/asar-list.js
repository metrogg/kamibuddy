// asar header reader: list files inside an .asar archive
const fs = require('fs');
const asarPath = process.argv[2];
const fd = fs.openSync(asarPath, 'r');
const buf8 = Buffer.alloc(8);
fs.readSync(fd, buf8, 0, 8, 0);
const jsonSize = buf8.readUInt32LE(4);
const jsonBuf = Buffer.alloc(jsonSize);
fs.readSync(fd, jsonBuf, 0, jsonSize, 8);
fs.closeSync(fd);
const header = JSON.parse(jsonBuf.toString('utf8'));
const rows = [];
function walk(node, prefix) {
  if (node.files) {
    for (const [name, child] of Object.entries(node.files)) walk(child, prefix ? prefix + '/' + name : name);
  } else {
    rows.push({ path: prefix, size: node.size ?? 0, unpacked: !!node.unpacked, offset: node.offset });
  }
}
walk(header, '');
console.log(`TOTAL ${rows.length}`);
const mode = process.argv[3] || 'summary';
if (mode === 'full') {
  for (const r of rows) console.log(`${r.size}\t${r.unpacked ? 'U' : ' '}\t${r.path}`);
} else {
  const summary = {};
  for (const r of rows) {
    const parts = r.path.split('/');
    const key = parts.slice(0, Math.min(3, Math.max(parts.length - 1, 1))).join('/');
    summary[key] = (summary[key] || 0) + 1;
  }
  for (const [k, v] of Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, 300)) console.log(`${v}\t${k}`);
}
