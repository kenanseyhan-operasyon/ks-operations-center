import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const partsDir = new URL('../model-parts/', import.meta.url);
const partNames = (await readdir(partsDir)).filter(name => name.endsWith('.b64')).sort();
if (!partNames.length) throw new Error('R14 model parts were not found');
const buffers = [];
for (const name of partNames) {
  const encoded = await readFile(new URL(name, partsDir), 'utf8');
  buffers.push(Buffer.from(encoded.trim(), 'base64'));
}
const model = Buffer.concat(buffers);
if (model.length !== 6437208) throw new Error(`R14 model size mismatch: ${model.length}`);
const outDir = new URL('../public/models/', import.meta.url);
await mkdir(outDir, { recursive: true });
await writeFile(new URL('refueller-38k-r14.glb', outDir), model);
console.log(`R14 GLB reconstructed: ${model.length} bytes`);
