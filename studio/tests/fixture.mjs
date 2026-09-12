import * as THREE from 'three';
export function fixtureGLB(){
  const geometry=new THREE.BoxGeometry(1,1,1).toNonIndexed(),data=[],bufferViews=[],accessors=[];let offset=0;
  for(const name of ['position','normal','uv']){
    const a=geometry.attributes[name],b=Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
    bufferViews.push({buffer:0,byteOffset:offset,byteLength:b.length,target:34962});
    accessors.push({bufferView:bufferViews.length-1,componentType:5126,count:a.count,type:a.itemSize===3?'VEC3':'VEC2',...(name==='position'?{min:[-.5,-.5,-.5],max:[.5,.5,.5]}:{})});
    data.push(b);offset+=b.length;
  }
  const binary=Buffer.concat(data),doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{name:'Tank',mesh:0,translation:[-1,0,0]},{name:'Vana',mesh:0,translation:[1,0,0]}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},material:0}]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.5,.6,.7,1],metallicFactor:.1,roughnessFactor:.7}}],buffers:[{byteLength:binary.length}],bufferViews,accessors};
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,json,binHeader,binary]);
}
