import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile(new URL('../ground-parts/manifest.json',import.meta.url),'utf8'));
await mkdir(new URL('../public/textures/',import.meta.url),{recursive:true});
for(const item of manifest){const bytes=Buffer.concat(await Promise.all(item.parts.map(async path=>Buffer.from((await readFile(new URL('../ground-parts/'+path,import.meta.url),'utf8')).trim(),'base64'))));if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error('Ground asset checksum mismatch: '+item.file);await writeFile(new URL('../public/textures/'+item.file,import.meta.url),bytes);console.log(`ADB static ground: ${item.file} · ${bytes.length} bytes`);}
