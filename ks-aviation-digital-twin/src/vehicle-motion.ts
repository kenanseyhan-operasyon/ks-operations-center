export type Point=[number,number];
export type DriveRoute={id:string;name:string;vehicleId:string;aircraftId?:string;points:Point[];speedKmh:number;approachKmh:number;approachDistance:number};
export type Signal='off'|'left'|'right'|'hazard';
export type Pose={x:number;z:number;heading:number};
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
export function validateRoutes(value:unknown):DriveRoute[]{
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>100)throw new Error('En fazla 100 güzergâh saklanabilir.');
  const ids=new Set<string>();
  return value.map(r=>{
    if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.vehicleId!=='string'||!Array.isArray(r.points)||r.points.length<2||r.points.length>500||r.points.some((p:unknown)=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>50000)))throw new Error('Güzergâh noktaları geçersiz.');
    ids.add(r.id);const n=(x:unknown,d:number)=>typeof x==='number'&&Number.isFinite(x)?x:d;
    return {id:r.id.slice(0,180),name:String(r.name||'R14 güzergâhı').slice(0,100),vehicleId:r.vehicleId.slice(0,180),aircraftId:typeof r.aircraftId==='string'?r.aircraftId.slice(0,180):undefined,points:r.points.map((p:Point)=>[...p] as Point),speedKmh:clamp(n(r.speedKmh,8),1,25),approachKmh:clamp(n(r.approachKmh,2),1,5),approachDistance:clamp(n(r.approachDistance,20),5,100)};
  });
}
export type PathSample={x:number;z:number;heading:number;s:number;curvature:number};
/** Cubic Hermite path preserves the current cab direction and rounds user-drawn bends. */
export function buildDrivePath(points:Point[],heading:number,wheelbase=7):PathSample[]{
  if(points.length<2)throw new Error('En az iki nokta gerekli.');
  const ps=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.5);
  if(ps.length<2)throw new Error('Güzergâh çok kısa.');
  const first=ps[1],start=ps[0],dir=Math.atan2(first[0]-start[0],-(first[1]-start[1]));
  if(Math.abs(angle(dir-heading))>Math.PI/3)throw new Error('İlk noktayı aracın önüne koyun. Gerekirse önce aracı elle yönlendirin.');
  const path:PathSample[]=[];
  for(let i=0;i<ps.length-1;i++){
    const a=ps[i],b=ps[i+1],before=ps[Math.max(0,i-1)],after=ps[Math.min(ps.length-1,i+2)],d=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const tangent=(x:number,z:number,len:number):Point=>{const n=Math.hypot(x,z)||1;return [x/n*len,z/n*len];};
    const ta=i===0?[Math.sin(heading)*d,-Math.cos(heading)*d]:tangent(b[0]-before[0],b[1]-before[1],Math.min(d,Math.hypot(a[0]-before[0],a[1]-before[1]))),tb=tangent(after[0]-a[0],after[1]-a[1],i===ps.length-2?d:Math.min(d,Math.hypot(after[0]-b[0],after[1]-b[1])));
    const count=Math.max(10,Math.ceil(d/.4));
    for(let j=i?1:0;j<=count;j++){
      const t=j/count,t2=t*t,t3=t2*t;
      const x=(2*t3-3*t2+1)*a[0]+(t3-2*t2+t)*ta[0]+(-2*t3+3*t2)*b[0]+(t3-t2)*tb[0];
      const z=(2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*ta[1]+(-2*t3+3*t2)*b[1]+(t3-t2)*tb[1];
      const dx=(6*t2-6*t)*a[0]+(3*t2-4*t+1)*ta[0]+(-6*t2+6*t)*b[0]+(3*t2-2*t)*tb[0],dz=(6*t2-6*t)*a[1]+(3*t2-4*t+1)*ta[1]+(-6*t2+6*t)*b[1]+(3*t2-2*t)*tb[1];
      const ddx=(12*t-6)*a[0]+(6*t-4)*ta[0]+(-12*t+6)*b[0]+(6*t-2)*tb[0],ddz=(12*t-6)*a[1]+(6*t-4)*ta[1]+(-12*t+6)*b[1]+(6*t-2)*tb[1];
      const curvature=(dx*ddz-dz*ddx)/Math.max(.0001,Math.hypot(dx,dz)**3),prev=path.at(-1);
      if(Math.abs(curvature)>Math.tan(Math.PI/5)/wheelbase*1.02)throw new Error('Güzergâh virajı bu araç için dar. Noktaları daha geniş bir dönüş oluşturacak şekilde yerleştirin.');
      path.push({x,z,heading:Math.atan2(dx,-dz),s:prev?prev.s+Math.hypot(x-prev.x,z-prev.z):0,curvature});
    }
  }
  return path;
}
export class VehicleMotion{
  pose:Pose;speed=0;steer=0;distance=0;signal:Signal='off';braking=false;
  mode:'manual'|'route'|'paused'|'complete'='manual';path:PathSample[]=[];progress=0;route?:DriveRoute;
  throttle=0;turn=0;brake=false;maxKmh=8;wheelbase=7;
  constructor(pose:Pose){this.pose={...pose};}
  clearInput(){this.throttle=0;this.turn=0;this.brake=false;}
  stop(){this.speed=0;this.steer=0;this.braking=true;this.clearInput();if(this.mode==='route')this.mode='paused';}
  startRoute(route:DriveRoute){
    const first=route.points[0];if(Math.hypot(this.pose.x-first[0],this.pose.z-first[1])>2)throw new Error('Araç güzergâh başlangıcında değil. Başlangıca geri alın veya yeni güzergâh çizin.');
    this.path=buildDrivePath([[this.pose.x,this.pose.z],...route.points.slice(1)],this.pose.heading,this.wheelbase);this.route=route;this.progress=0;this.speed=0;this.mode='route';this.clearInput();
  }
  get remaining(){return Math.max(0,(this.path.at(-1)?.s||0)-this.progress);}
  step(dt:number,running=true,interlock=false){
    dt=clamp(dt,0,.1);const before=this.speed;
    if(!running||interlock){this.stop();return 0;}
    if(this.mode==='paused'||this.mode==='complete')return 0;
    let desired=0;
    if(this.mode==='route'&&this.route){
      const near=this.remaining<this.route.approachDistance;
      desired=Math.min(this.route.speedKmh,near?this.route.approachKmh:25)/3.6;
      // Brake before the approach zone, then to an exact zero-speed endpoint.
      desired=Math.min(desired,Math.sqrt((this.route.approachKmh/3.6)**2+2*.8*Math.max(0,this.remaining-this.route.approachDistance)),Math.sqrt(2*.8*this.remaining));
    }else{
      desired=this.throttle>0?this.maxKmh/3.6:this.throttle<0?-Math.min(5,this.maxKmh)/3.6:0;
      if(this.speed*desired<0&&Math.abs(this.speed)>.03)desired=0;
      const target=this.turn*Math.PI/5;this.steer+=clamp(target-this.steer,-1.1*dt,1.1*dt);
    }
    if(this.brake)desired=0;
    const slowing=Math.abs(desired)<Math.abs(this.speed),rate=this.brake?3:slowing?1.5:.8;
    this.speed+=clamp(desired-this.speed,-rate*dt,rate*dt);if(Math.abs(this.speed)<.001)this.speed=0;
    this.braking=this.brake||(slowing&&Math.abs(before)>.1);
    let travel=(before+this.speed)*.5*dt;
    if(this.mode==='route'){
      if(this.brake){this.stop();return 0;}
      travel=Math.min(travel,this.remaining);this.progress+=travel;
      let i=this.path.findIndex(p=>p.s>=this.progress);if(i<0)i=this.path.length-1;
      const b=this.path[i],a=this.path[Math.max(0,i-1)],t=clamp((this.progress-a.s)/Math.max(.0001,b.s-a.s),0,1);
      this.pose={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:a.heading+angle(b.heading-a.heading)*t};
      this.steer=Math.atan(this.wheelbase*(a.curvature+(b.curvature-a.curvature)*t));
      const ahead=this.path.find(p=>p.s>this.progress+Math.max(5,this.speed*2))||b,turn=angle(ahead.heading-this.pose.heading);
      if(this.signal!=='hazard')this.signal=turn>.06?'right':turn<-.06?'left':'off';
      if(this.remaining<.01){this.speed=0;this.steer=0;this.mode='complete';this.signal='off';}
    }else{
      const yaw=travel*Math.tan(this.steer)/this.wheelbase,mid=this.pose.heading+yaw/2;this.pose.x+=Math.sin(mid)*travel;this.pose.z-=Math.cos(mid)*travel;this.pose.heading=angle(this.pose.heading+yaw);
      if(this.signal!=='hazard')this.signal=this.turn>.1?'right':this.turn<-.1?'left':this.signal;
    }
    this.distance+=travel;return travel;
  }
}
