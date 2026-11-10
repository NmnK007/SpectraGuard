import * as ort from 'onnxruntime-web/wasm';
import wasmURL from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import moduleURL from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import replayParameters from '../public/models/replay-frontend.json';
import {replayFeatures,replaySignal} from './replay-features.mjs';
import {runDetectorBranches} from './detector-results.mjs';

export const syntheticName='Wav2Vec2 XLSR · pretrained INT8';
export const replayName='ASVspoof PA · LFCC–LCNN pretrained';
let session;
let replaySession;

async function resampleMono(samples,rate) {
  const context=new OfflineAudioContext(1,Math.ceil(samples.length*16000/rate),16000);
  const buffer=context.createBuffer(1,samples.length,rate);buffer.copyToChannel(samples,0);
  const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start();
  const rendered=await context.startRendering();
  buffer.getChannelData(0).fill(0);
  return rendered.getChannelData(0);
}

export async function detectAudio(samples,rate,progress=()=>{}) {
  return runDetectorBranches({
    synthetic:()=>detectSynthetic(samples,rate,progress),
    replay:()=>detectReplay(samples,rate,progress),
  });
}

export async function detectReplay(samples,rate,progress=()=>{}) {
  ort.env.wasm.numThreads=1;
  ort.env.wasm.wasmPaths={wasm:wasmURL,mjs:moduleURL};
  progress('Loading separate acoustic replay detector (1.1 MB)…');
  if(!replaySession)replaySession=ort.InferenceSession.create('/models/replay.onnx',{executionProviders:['wasm']}).catch(e=>{replaySession=null;throw e;});
  const model=await replaySession;
  const pcm=await resampleMono(samples,rate);
  let input,outputs,features;
  try {
    progress('Running acoustic replay detector · full recording…');
    features=replayFeatures(pcm,replayParameters);
    input=new ort.Tensor('float32',features.data,[1,features.frames,60]);
    outputs=await model.run({lfcc:input});
    const logits=outputs.bonafide_logit?.data;
    if(!logits||logits.length!==1)throw new Error('Invalid replay output shape');
    const logit=Number(logits[0]);
    return {score:replaySignal(logit),bonafideLogit:logit,frames:features.frames};
  }finally {
    input?.dispose();if(outputs)Object.values(outputs).forEach(t=>t.dispose());
    pcm.fill(0);features?.data.fill(0);
  }
}
export async function detectSynthetic(samples, rate, progress=()=>{}) {
  ort.env.wasm.numThreads=1;
  ort.env.wasm.wasmPaths={wasm:wasmURL,mjs:moduleURL};
  progress('Loading pretrained detector (339 MiB); first analysis may take a minute…');
  if(!session) session=ort.InferenceSession.create('/models/synthetic.onnx',{executionProviders:['wasm']}).catch(e=>{session=null;throw e;});
  const model=await session;
  // Browser OfflineAudioContext performs band-limited sample-rate conversion.
  const pcm=await resampleMono(samples,rate);
  const scores=[];
  try {
    // Cover the complete clip in <=4-second windows, folding a short tail into the last window.
    const count=Math.ceil(pcm.length/64000);
    for(let i=0;i<count;i++) {
      progress(`Running synthetic-speech detector · window ${i+1}/${count}…`);
      const start=Math.min(i*64000,Math.max(0,pcm.length-32000));
      const input=pcm.slice(start,Math.min(pcm.length,start+64000));
      let mean=0;for(const v of input)mean+=v;mean/=input.length;
      let variance=0;for(const v of input)variance+=(v-mean)**2;variance/=input.length;
      if(Math.sqrt(variance)<.004){input.fill(0);continue;}
      for(let j=0;j<input.length;j++)input[j]=(input[j]-mean)/Math.sqrt(variance+1e-7);
      const feeds={input_values:new ort.Tensor('float32',input,[1,input.length]),attention_mask:new ort.Tensor('int32',new Int32Array(input.length).fill(1),[1,input.length])};
      let outputs;
      try {outputs=await model.run(feeds);const logits=outputs[model.outputNames[0]].data;
        if(logits.length!==2||!Array.from(logits).every(Number.isFinite))throw new Error('Invalid classifier output');
        scores.push(1/(1+Math.exp(Number(logits[0])-Number(logits[1]))));
      }finally{input.fill(0);Object.values(feeds).forEach(t=>t.dispose());if(outputs)Object.values(outputs).forEach(t=>t.dispose());}
    }
    return scores.length?{score:Math.round(100*scores.reduce((a,b)=>a+b,0)/scores.length),windows:scores.length}:null;
  } finally {pcm.fill(0);}
}

