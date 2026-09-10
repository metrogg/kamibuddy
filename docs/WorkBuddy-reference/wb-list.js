// list asar contents: node wb-list.js <asar> [filter]
const fs = require('fs');
const asarPath = process.argv[2];
const filter = (process.argv[3] || '').toLowerCase();
const fd = fs.openSync(asarPath, 'r');
const buf8 = Buffer.alloc(8);
fs.readSync(fd, buf8, 0, 8, 0);
const headerSize = buf8.readUInt32LE(4);
const headerBuf = Buffer.alloc(headerSize);
fs.readSync(fd, headerBuf, 0, headerSize, 8);
const jsonLen = headerBuf.readUInt32LE(4);
const header = JSON.parse(headerBuf.toString('utf8', 8, 8 + jsonLen));
fs.closeSync(fd);
const rows = [];
(function walk(node, prefix) {
  if (node.files) {
    for (const [name, child] of Object.entries(node.files)) walk(child, prefix ? prefix + '/' + name : name);
  } else {
    rows.push({ p: prefix, s: node.size ?? 0, u: !!node.unpacked, l: node.link });
  }
})(header, '');
let n = 0;
for (const r of rows) {
  if (filter && !r.p.toLowerCase().includes(filter)) continue;
  console.log(`${r.s}\t${r.u ? 'U' : ' '}\t${r.l ? 'LINK->' + r.l : ''}\t${r.p}`);
  n++;
}
console.error(`shown=${n} total=${rows.length}`);
