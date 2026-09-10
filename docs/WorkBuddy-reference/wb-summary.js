// summarize asar-files.txt: node wb-summary.js <txt> [depth]
const fs = require('fs');
const lines = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter(l => /^\d/.test(l));
const depth = Number(process.argv[3] || 1);
const groups = {};
for (const l of lines) {
  const parts = l.split('\t');
  const p = parts[parts.length - 1];
  const key = p.split('/').slice(0, depth).join('/');
  if (!groups[key]) groups[key] = { count: 0, size: 0 };
  groups[key].count++;
  groups[key].size += Number(parts[0]) || 0;
}
for (const [k, v] of Object.entries(groups).sort((a, b) => b[1].size - a[1].size)) {
  console.log(`${String(v.count).padStart(6)}  ${(v.size / 1048576).toFixed(1).padStart(9)}MB  ${k}`);
}
