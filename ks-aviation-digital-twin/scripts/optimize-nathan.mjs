import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Preserve the archived 8K original. Runtime geometry, rig and animations stay
// byte-identical; only its embedded JPEG and the following byte offsets change.
const root=new URL('../',import.meta.url),parts=new URL('model-parts/nathan/',root);
const metadata=JSON.parse(await readFile(new URL('runtime-texture.json',parts),'utf8'));
const source=await readFile(new URL('public/models/personnel/KS_Nathan_15_Hareket.glb',root));
const hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(source)!==metadata.sourceSha256)throw new Error('Nathan source changed: regenerate runtime texture');
const names=(await readdir(parts)).filter(name=>/^runtime-texture-\d+\.b64$/.test(name)).sort();
const texture=Buffer.concat(await Promise.all(names.map(async name=>Buffer.from(await readFile(new URL(name,parts),'utf8'),'base64'))));
if(hash(texture)!==metadata.textureSha256)throw new Error('Nathan runtime texture checksum mismatch');
if(texture.readUInt16BE(0)!==0xffd8||texture.readUInt16BE(texture.length-2)!==0xffd9)throw new Error('Nathan runtime JPEG is incomplete');
const jsonLength=source.readUInt32LE(12),doc=JSON.parse(source.subarray(20,20+jsonLength).toString());
const binStart=28+jsonLength,bin=source.subarray(binStart,binStart+doc.buffers[0].byteLength),view=doc.bufferViews[doc.images[0].bufferView];
const start=view.byteOffset||0,end=Math.ceil((start+view.byteLength)/4)*4,replacement=Buffer.alloc(Math.ceil(texture.length/4)*4);
texture.copy(replacement);const delta=replacement.length-(end-start);
const nextBin=Buffer.concat([bin.subarray(0,start),replacement,bin.subarray(end)]);
for(const other of doc.bufferViews)if(other!==view&&(other.byteOffset||0)>=end)other.byteOffset+=delta;
view.byteLength=texture.length;doc.buffers[0].byteLength=nextBin.length;
const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);
const output=Buffer.alloc(28+json.length+nextBin.length);output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);
output.writeUInt32LE(json.length,12);output.writeUInt32LE(0x4e4f534a,16);json.copy(output,20);
output.writeUInt32LE(nextBin.length,20+json.length);output.writeUInt32LE(0x004e4942,24+json.length);nextBin.copy(output,28+json.length);
await writeFile(new URL('public/models/personnel/KS_Nathan_Runtime.glb',root),output);
console.log(`Nathan runtime: ${output.length} bytes; original rig and animation buffers preserved`);
