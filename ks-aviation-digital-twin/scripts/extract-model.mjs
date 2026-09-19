import { mkdir, readFile, writeFile } from 'node:fs/promises';

const legacy = await readFile('../index.html', 'utf8');
const marker = '<script id="ksR14ModelData" type="application/octet-stream">';
const start = legacy.indexOf(marker);
const end = legacy.indexOf('</script>', start + marker.length);
if (start < 0 || end < 0) throw new Error('R14 model data was not found in the legacy index.html');
const encoded = legacy.slice(start + marker.length, end).trim();
const outDir = new URL('../public/models/', import.meta.url);
await mkdir(outDir, { recursive: true });
await writeFile(new URL('refueller-38k-r14.glb', outDir), Buffer.from(encoded, 'base64'));
console.log('R14 GLB extracted for the new Digital Twin build.');
