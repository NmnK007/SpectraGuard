import * as ort from 'onnxruntime-web';
import fs from 'node:fs';
ort.env.wasm.numThreads=1;
console.time('load');const model=await ort.InferenceSession.create(new Uint8Array(fs.readFileSync('public/models/synthetic.onnx')),{executionProviders:['wasm']});console.timeEnd('load');console.log(model.inputNames,model.outputNames);
const wav=fs.readFileSync(process.argv[2]||'test-voices/03_scam_urgency.wav');let pos=12,rate,data;
while(pos+8<=wav.length){const name=wav.toString('ascii',pos,pos+4),n=wav.readUInt32LE(pos+4);if(name==='fmt ')rate=wav.readUInt32LE(pos+12);if(name==='data'){data=wav.subarray(pos+8,pos+8+n);break;}pos+=8+n+(n%2);}
const x=new Float32Array(32000);for(let i=0;i<x.length;i++)x[i]=data.readInt16LE(Math.min(Math.floor(i*rate/16000),data.length/2-1)*2)/32768;
let mean=x.reduce((a,b)=>a+b,0)/x.length,variance=x.reduce((a,b)=>a+(b-mean)**2,0)/x.length;for(let i=0;i<x.length;i++)x[i]=(x[i]-mean)/Math.sqrt(variance+1e-7);
console.time('infer');let out=await model.run({input_values:new ort.Tensor('float32',x,[1,x.length]),attention_mask:new ort.Tensor('int32',new Int32Array(x.length).fill(1),[1,x.length])});console.timeEnd('infer');const logits=Array.from(out[model.outputNames[0]].data);if(logits.length!==2||!logits.every(Number.isFinite))throw new Error('Invalid output');console.log({logits,syntheticSignal:Math.round(100/(1+Math.exp(logits[0]-logits[1]))),note:'First two seconds only; execution smoke test, not an accuracy evaluation. Requires mono PCM16 WAV.'});await model.release();

