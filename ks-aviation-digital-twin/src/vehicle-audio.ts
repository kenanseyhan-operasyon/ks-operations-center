import {clamp} from './vehicle-motion';
export type EngineInput={id?:string;running:boolean;speed:number;throttle:number;braking:boolean;automatic:boolean};
export const TRUCK_SAMPLE_URL='/audio/diesel-truck-soft-v2.wav';
const SOUND_PROFILE='truck-v2';
/** Sound-only automatic drivetrain: low diesel revs, with a gentle shift dip. */
export class EngineTone{
  gear=0;rpm=0;shift=0;private id?:string;
  update(dt:number,input:EngineInput){
    if(this.id!==input.id){this.id=input.id;this.gear=0;this.rpm=0;this.shift=0;}
    dt=clamp(dt,0,.1);this.shift=Math.max(0,this.shift-dt);
    if(!input.running){this.gear=0;this.rpm=0;return false;}
    const kmh=Math.abs(input.speed)*3.6,old=this.gear,limits=[0,6,12,19,27];
    if(input.speed<-.02)this.gear=-1;
    else if(kmh<.15&&input.throttle<=0&&!input.automatic)this.gear=0;
    else{
      this.gear=Math.max(1,this.gear);
      while(this.gear<5&&kmh>limits[this.gear])this.gear++;
      while(this.gear>1&&kmh<limits[this.gear-1]-1.5)this.gear--;
    }
    const changed=old>0&&this.gear>0&&old!==this.gear;if(changed)this.shift=.3;
    const load=input.braking?0:Math.max(Math.abs(input.throttle),input.automatic ? .6 : 0),g=Math.max(1,this.gear);
    const base=this.gear<0?680+kmh*85:620+Math.max(0,kmh-limits[g-1])*78;
    const target=clamp(base+load*140-(this.shift?150:0),580,1600);
    this.rpm+=(target-this.rpm)*(1-Math.exp(-dt*4));return changed;
  }
}
type Voice={engine:AudioBufferSourceNode;filter:BiquadFilterNode;gain:GainNode;nodes:AudioNode[]};
export class VehicleAudio{
  enabled=true;volume=.2;readonly tone=new EngineTone();ready?:Promise<void>;failed=false;
  private context?:AudioContext;private master?:GainNode;private voice?:Voice;private noise?:AudioBuffer;private sample?:AudioBuffer;
  private id?:string;private startId?:string;private wasBraking=false;private suspended=false;private startingUntil=0;
  private transients=new Set<AudioScheduledSourceNode>();
  constructor(private factory=()=>new (window.AudioContext||(window as any).webkitAudioContext)(),private readSample:()=>Promise<ArrayBuffer>=async()=>{
    const response=await fetch(TRUCK_SAMPLE_URL);if(!response.ok)throw new Error('Audio unavailable');return response.arrayBuffer();
  }){
    try{
      const prefs=JSON.parse(localStorage.getItem('KS_ADT_SOUND_V1')||'null');
      if(prefs){this.enabled=prefs.enabled!==false;this.volume=clamp(Number.isFinite(prefs.volume)?prefs.volume:.2,0,1);
        // Apply the quieter profile once, including devices that retained the old default.
        if(prefs.profile!==SOUND_PROFILE){this.volume=Math.min(this.volume,.2);this.persist();}
      }
    }catch{}
  }
  get supported(){return !!(typeof window!=='undefined'&&(window.AudioContext||(window as any).webkitAudioContext));}
  get loading(){return !!this.ready&&!this.sample&&!this.failed;}
  private persist(){try{localStorage.setItem('KS_ADT_SOUND_V1',JSON.stringify({enabled:this.enabled,volume:this.volume,profile:SOUND_PROFILE}));}catch{}}
  /** Audio context is created/resumed only by a click or key gesture. */
  unlock(){
    if(!this.enabled)return;
    try{
      if(!this.context){
        this.context=this.factory();this.master=this.context.createGain();this.master.gain.value=this.volume*.6;
        const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.ratio.value=3;compressor.knee.value=18;compressor.attack.value=.02;compressor.release.value=.25;compressor.connect(this.context.destination);this.master.connect(compressor);
        this.noise=this.context.createBuffer(1,this.context.sampleRate,this.context.sampleRate);
        const samples=this.noise.getChannelData(0);let last=0;for(let i=0;i<samples.length;i++){last=(last+(Math.random()*2-1)*.16)/1.08;samples[i]=last;}
      }
      this.suspended=false;void this.context.resume().catch(()=>{});
      if(!this.sample&&(!this.ready||this.failed)){
        this.failed=false;this.ready=this.readSample().then(bytes=>this.context!.decodeAudioData(bytes)).then(buffer=>{this.sample=buffer;}).catch(()=>{this.failed=true;});
      }
    }catch{/* Audio support must never interrupt driving. */}
  }
  engine(id:string,on:boolean){if(on){this.startId=id;this.unlock();}else if(this.id===id){this.stopVoice();this.startId=undefined;}}
  setEnabled(value:boolean){this.enabled=value;this.persist();if(value)this.unlock();else this.silence();}
  setVolume(value:number){this.volume=clamp(Number.isFinite(value)?value:0,0,1);this.persist();this.unlock();if(this.master&&this.context)this.master.gain.setTargetAtTime(this.volume*.6,this.context.currentTime,.12);}
  silence(){this.suspended=true;this.startId=undefined;this.stopVoice();for(const source of this.transients){try{source.stop();}catch{}}this.transients.clear();if(this.context)void this.context.suspend().catch(()=>{});}
  private stopVoice(){
    if(!this.voice)return;try{this.voice.engine.stop();}catch{}
    for(const node of this.voice.nodes)node.disconnect();this.voice=undefined;
  }
  private createVoice(){
    const c=this.context!,gain=c.createGain(),filter=c.createBiquadFilter(),engine=c.createBufferSource();
    filter.type='lowpass';filter.Q.value=.5;filter.frequency.value=430;
    engine.buffer=this.sample!;engine.loop=true;engine.playbackRate.value=.86;
    engine.connect(filter);filter.connect(gain);gain.connect(this.master!);gain.gain.value=0;
    engine.start();this.voice={engine,filter,gain,nodes:[engine,filter,gain]};
  }
  private effect(kind:'start'|'shift'|'brake'){
    const c=this.context!,t=c.currentTime,length=kind==='start'?.85:kind==='brake'?.2:.12;
    const gain=c.createGain(),filter=c.createBiquadFilter(),source=c.createBufferSource();source.buffer=this.noise!;
    filter.type='lowpass';filter.frequency.value=kind==='brake'?750:260;filter.Q.value=.5;
    source.connect(filter);filter.connect(gain);gain.connect(this.master!);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(kind==='start'?.12:.065,t+.05);gain.gain.exponentialRampToValueAtTime(.0001,t+length);source.start(t);source.stop(t+length);
    this.transients.add(source);source.onended=()=>{this.transients.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
    if(kind==='start')this.startingUntil=t+length;
  }
  update(dt:number,input:EngineInput){
    const changed=this.id!==input.id;if(changed){this.stopVoice();this.wasBraking=false;}this.id=input.id;
    const shifted=this.tone.update(dt,input);
    if(!input.id||!input.running||!this.enabled||this.suspended||!this.context||this.context.state!=='running'||!this.sample){this.stopVoice();return;}
    if(!this.voice)this.createVoice();
    if(this.startId===input.id){this.effect('start');this.startId=undefined;}
    if(shifted)this.effect('shift');
    if(input.braking&&!this.wasBraking&&Math.abs(input.speed)>.2)this.effect('brake');this.wasBraking=input.braking;
    const v=this.voice!,t=this.context.currentTime,rpm=Math.max(580,this.tone.rpm),load=input.braking?0:Math.max(Math.abs(input.throttle),input.automatic ? .6 : 0);
    // Narrow pitch range and rounded EQ keep a heavy engine texture under throttle.
    const starting=t<this.startingUntil,rate=starting?.68:clamp(.86+(rpm-620)/980*.22,.84,1.08);
    v.engine.playbackRate.setTargetAtTime(rate,t,.22);v.filter.frequency.setTargetAtTime(430+load*100,t,.25);
    v.gain.gain.setTargetAtTime((.75+load*.14)*(this.tone.shift ? .85 : 1)*(starting ? .45 : 1),t,.18);
  }
}
