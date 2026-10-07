import {clamp} from './vehicle-motion';
export type EngineInput={id?:string;running:boolean;speed:number;throttle:number;braking:boolean;automatic:boolean};
/** Approximate automatic diesel drivetrain, used for sound only; never changes physics. */
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
    const changed=old>0&&this.gear>0&&old!==this.gear;if(changed)this.shift=.22;
    const load=input.braking?0:Math.max(Math.abs(input.throttle),input.automatic ? .6 : 0),g=Math.max(1,this.gear);
    const base=this.gear<0?850+kmh*170:700+Math.max(0,kmh-limits[g-1])*130;
    const target=clamp(base+load*260-(this.shift?260:0),620,2400);
    this.rpm+=(target-this.rpm)*(1-Math.exp(-dt*9));return changed;
  }
}
type Voice={engine:OscillatorNode;hum:OscillatorNode;noise:AudioBufferSourceNode;filter:BiquadFilterNode;gain:GainNode;air:GainNode;nodes:AudioNode[]};
export class VehicleAudio{
  enabled=true;volume=.35;readonly tone=new EngineTone();
  private context?:AudioContext;private master?:GainNode;private voice?:Voice;private noise?:AudioBuffer;
  private id?:string;private startId?:string;private wasBraking=false;private suspended=false;private startingUntil=0;
  private transients=new Set<AudioScheduledSourceNode>();
  constructor(private factory=()=>new (window.AudioContext||(window as any).webkitAudioContext)()){
    try{const prefs=JSON.parse(localStorage.getItem('KS_ADT_SOUND_V1')||'null');if(prefs){this.enabled=prefs.enabled!==false;this.volume=clamp(Number(prefs.volume)||0,0,1);}}catch{}
  }
  get supported(){return !!(typeof window!=='undefined'&&(window.AudioContext||(window as any).webkitAudioContext));}
  private persist(){try{localStorage.setItem('KS_ADT_SOUND_V1',JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}}
  /** Called only by an explicit click/key gesture, including engine and sound controls. */
  unlock(){
    if(!this.enabled)return;
    try{
      if(!this.context){
        this.context=this.factory();this.master=this.context.createGain();this.master.gain.value=this.volume;
        const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-10;compressor.ratio.value=8;compressor.connect(this.context.destination);this.master.connect(compressor);
        this.noise=this.context.createBuffer(1,this.context.sampleRate,this.context.sampleRate);
        const samples=this.noise.getChannelData(0);let last=0;for(let i=0;i<samples.length;i++){last=(last+(Math.random()*2-1)*.16)/1.08;samples[i]=last;}
      }
      this.suspended=false;void this.context.resume().catch(()=>{});
    }catch{/* Unsupported audio must never interrupt driving. */}
  }
  engine(id:string,on:boolean){if(on){this.startId=id;this.unlock();}else if(this.id===id){this.stopVoice();this.startId=undefined;}}
  setEnabled(value:boolean){this.enabled=value;this.persist();if(value)this.unlock();else this.silence();}
  setVolume(value:number){this.volume=clamp(Number.isFinite(value)?value:0,0,1);this.persist();this.unlock();if(this.master&&this.context)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.025);}
  silence(){this.suspended=true;this.startId=undefined;this.stopVoice();for(const source of this.transients){try{source.stop();}catch{}}this.transients.clear();if(this.context)void this.context.suspend().catch(()=>{});}
  private stopVoice(){
    if(!this.voice)return;for(const s of [this.voice.engine,this.voice.hum,this.voice.noise]){try{s.stop();}catch{}}
    for(const node of this.voice.nodes)node.disconnect();this.voice=undefined;
  }
  private createVoice(){
    const c=this.context!,gain=c.createGain(),air=c.createGain(),filter=c.createBiquadFilter();filter.type='lowpass';filter.Q.value=.55;
    const engine=c.createOscillator(),hum=c.createOscillator(),noise=c.createBufferSource(),humGain=c.createGain();
    const real=new Float32Array(25),imag=new Float32Array(25);for(let i=1;i<imag.length;i++)imag[i]=(1+Math.sin(i*2.1)*.28)/Math.pow(i,1.15);
    engine.setPeriodicWave(c.createPeriodicWave(real,imag));hum.type='sine';noise.buffer=this.noise!;noise.loop=true;
    engine.connect(filter);filter.connect(gain);hum.connect(humGain);humGain.gain.value=.08;humGain.connect(gain);noise.connect(air);air.connect(gain);gain.connect(this.master!);gain.gain.value=0;
    engine.start();hum.start();noise.start();this.voice={engine,hum,noise,filter,gain,air,nodes:[engine,hum,noise,filter,gain,air,humGain]};
  }
  private effect(kind:'start'|'shift'|'brake'){
    const c=this.context!,t=c.currentTime,length=kind==='start'?.65:kind==='brake'?.23:.1;
    const gain=c.createGain(),filter=c.createBiquadFilter(),source=c.createBufferSource();source.buffer=this.noise!;filter.type='bandpass';filter.frequency.value=kind==='start'?380:kind==='brake'?1800:700;filter.Q.value=.6;
    source.connect(filter);filter.connect(gain);gain.connect(this.master!);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(kind==='start'?.65:.35,t+.025);gain.gain.exponentialRampToValueAtTime(.0001,t+length);source.start(t);source.stop(t+length);
    this.transients.add(source);source.onended=()=>{this.transients.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
    if(kind==='start'){
      this.startingUntil=t+length;
      const starter=c.createOscillator(),motor=c.createGain();starter.type='triangle';starter.frequency.setValueAtTime(48,t);starter.frequency.linearRampToValueAtTime(105,t+.4);starter.connect(motor);motor.connect(this.master!);motor.gain.setValueAtTime(.24,t);motor.gain.linearRampToValueAtTime(.28,t+.4);motor.gain.exponentialRampToValueAtTime(.0001,t+length);starter.start(t);starter.stop(t+length);this.transients.add(starter);starter.onended=()=>{this.transients.delete(starter);starter.disconnect();motor.disconnect();};
    }
  }
  update(dt:number,input:EngineInput){
    const changed=this.id!==input.id;if(changed){this.stopVoice();this.wasBraking=false;}this.id=input.id;
    const shifted=this.tone.update(dt,input);
    if(!input.id||!input.running||!this.enabled||this.suspended||!this.context||this.context.state!=='running'){this.stopVoice();return;}
    if(!this.voice)this.createVoice();
    if(this.startId===input.id){this.effect('start');this.startId=undefined;}
    if(shifted)this.effect('shift');
    if(input.braking&&!this.wasBraking&&Math.abs(input.speed)>.2)this.effect('brake');this.wasBraking=input.braking;
    const v=this.voice!,t=this.context.currentTime,rpm=Math.max(620,this.tone.rpm),load=input.braking?0:Math.max(Math.abs(input.throttle),input.automatic ? .6 : 0);
    v.engine.frequency.setTargetAtTime(rpm/20,t,.04);v.hum.frequency.setTargetAtTime(rpm/60,t,.05);
    v.filter.frequency.setTargetAtTime(260+rpm*.36+load*350,t,.06);v.air.gain.setTargetAtTime(.18+load*.3,t,.05);
    v.gain.gain.setTargetAtTime((.13+load*.11)*(this.tone.shift ? .55 : 1)*(t<this.startingUntil ? .25 : 1),t,.035);
  }
}
