/**
 * Read the *real* Nathan runtime GLB and inventory the source motions without
 * changing skin weights, bone names or retargeting. Uses Node built-ins only.
 * Usage: node scripts/audit-nathan-clips.mjs [path-to-glb]
 */
import {readFileSync,existsSync} from 'node:fs';

const filepath=process.argv[2]||'public/models/personnel/KS_Nathan_Runtime.glb';
if(!existsSync(filepath))throw Error('Nathan runtime GLB not built: '+filepath+'; run npm run pretest first.');
const bin=readFileSync(filepath);
if(bin.readUInt32LE(0)!==0x46546c67)throw Error('Not a valid binary GLB');
if(bin.readUInt32LE(8)!==bin.length)throw Error('Invalid GLB length');
let gltf,embeddedBin;
for(let ptr=12;ptr<bin.length;){
 const len=bin.readUInt32LE(ptr),kind=bin.readUInt32LE(ptr+4);
 if(kind===0x4e4f534a)gltf=JSON.parse(bin.subarray(ptr+8,ptr+8+len).toString('utf8').trim());
 if(kind===0x004e4942)embeddedBin=bin.subarray(ptr+8,ptr+8+len);
 ptr+=8+len;
}
if(!gltf||!embeddedBin)throw Error('Nathan GLB requires inline JSON and BIN chunks');
const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const bytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const read=(offset,componentType)=>{
 switch(componentType){
 case 5120:return embeddedBin.readInt8(offset);
 case 5121:return embeddedBin.readUInt8(offset);
 case 5122:return embeddedBin.readInt16LE(offset);
 case 5123:return embeddedBin.readUInt16LE(offset);
 case 5125:return embeddedBin.readUInt32LE(offset);
 case 5126:return embeddedBin.readFloatLE(offset);
 default:throw Error('Unsupported component type: '+componentType);
 }
};
function accessor(index){
 const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView];
 const size=bytes[a.componentType],count=width[a.type],stride=v.byteStride??count*size;
 const start=(v.byteOffset??0)+(a.byteOffset??0);
 const first=[],last=[];
 for(let k=0;k<count;k++){
   first.push(read(start+k*size,a.componentType));
   last.push(read(start+(a.count-1)*stride+k*size,a.componentType));
 }
 return {count:a.count,first,last,type:a.type,componentType:a.componentType};
}
const output={source:filepath,asset:gltf.asset?.generator||null,
  meshNodes:gltf.nodes?.length||0,animations:[]};
for(const clip of gltf.animations||[]){
 const tracks=[],roots=[];
 for(const channel of clip.channels||[]){
   const name=gltf.nodes[channel.target.node]?.name||'#'+channel.target.node;
   const sampler=clip.samplers[channel.sampler],outputData=accessor(sampler.output),time=accessor(sampler.input);
   const first=outputData.first,last=outputData.last,path=channel.target.path;
   const report={node:name,path,frames:outputData.count,
     durationSeconds:time.last[0]-time.first[0]};
   if(path==='translation'){
     report.delta=first.map((v,i)=>Number((last[i]-v).toFixed(4)));
     report.offsetRawUnits=Number(Math.hypot(...report.delta).toFixed(4));
   }
   tracks.push(report);
   if(/(hip|hips|root)/i.test(name))roots.push(report);
 }
 const maximumSourceRootDrift=Math.max(0,...roots.filter(x=>x.path==='translation').map(x=>x.offsetRawUnits));
 output.animations.push({
   clip:clip.name,tracks:tracks.length,rootAndHipTracks:roots.slice(0,8),
   sourceTranslationDriftRawUnits:maximumSourceRootDrift,
   mustReviewRootMotion:maximumSourceRootDrift>.15
 });
}
console.log('NATHAN_REAL_GLB_MOTION_AUDIT_BEGIN');
console.log(JSON.stringify(output,null,2));
console.log('NATHAN_REAL_GLB_MOTION_AUDIT_END');
// A visual failure is NOT a pass. This is a diagnostic: inspect flagged clips
// before importing new FBX/GLB motions onto Nathan's existing skeleton.
