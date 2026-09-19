import { mkdir, readFile, writeFile } from 'node:fs/promises';

const legacy = await readFile('../index.html', 'utf8');
const match = legacy.match(/<script id="ksR14ModelData" type="application\\/octet-stream">([\\s\\S]*?)<\\/script>/);
if (!match) throw new Error('R14 model data was not found in the legacy index.html');
const outDir = new URL('../public/models/', import.meta.url);
await mkdir(outDir, { recursive: true });
await writeFile(new URL('refueller-38k-r14.glb', outDir), Buffer.from(match[1].trim(), 'base64'));
console.log('R14 GLB extracted for the new Digital Twin build.');
