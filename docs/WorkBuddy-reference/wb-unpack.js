// wb-unpack.js <asar> <outDir> <prefix1,prefix2,...>
// extracts packed files whose path starts with any prefix; copies unpacked files from app.asar.unpacked
const fs = require('fs');
const path = require('path');
const [asarPath, outDir, prefixArg] = process.argv.slice(2);
const prefixes = prefixArg.split(',').map(s => s.trim()).filter(Boolean);

const fd = fs.openSync(asarPath, 'r');
const buf8 = Buffer.alloc(8);
fs.readSync(fd, buf8, 0, 8, 0);
const headerSize = buf8.readUInt32LE(4);
const headerBuf = Buffer.alloc(headerSize);
fs.readSync(fd, headerBuf, 0, headerSize, 8);
const jsonLen = headerBuf.readUInt32LE(4);
const header = JSON.parse(headerBuf.toString('utf8', 8, 8 + jsonLen));
const dataOffset = 8 + headerSize;
const unpackedRoot = asarPath.replace(/\.asar$/i, '.asar.unpacked');

let done = 0, skipped = 0, bytes = 0;
(function walk(node, prefix) {
  if (node.files) {
    for (const [name, child] of Object.entries(node.files)) walk(child, prefix ? prefix + '/' + name : name);
    return;
  }
  if (!prefixes.some(p => prefix.startsWith(p))) { skipped++; return; }
  const dest = path.join(outDir, prefix);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (node.unpacked) {
    const src = path.join(unpackedRoot, prefix);
    if (fs.existsSync(src)) { fs.copyFileSync(src, dest); bytes += fs.statSync(src).size; }
    else fs.writeFileSync(dest, '');
  } else {
    const b = Buffer.alloc(node.size);
    fs.readSync(fd, b, 0, node.size, dataOffset + Number(node.offset));
    fs.writeFileSync(dest, b);
    bytes += node.size;
  }
  done++;
})(header, '');
fs.closeSync(fd);
console.log(`done=${done} skipped=${skipped} bytes=${(bytes / 1048576).toFixed(1)}MB`);
