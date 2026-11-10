import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as ort from 'onnxruntime-web';
import {replayFeatures,replaySignal} from '../src/replay-features.mjs';
import {runDetectorBranches} from '../src/detector-results.mjs';
const params=JSON.parse(fs.readFileSync(new URL('../public/models/replay-frontend.json',import.meta.url)));
const references=JSON.parse(fs.readFileSync(new URL('./fixtures/replay-reference.json',import.meta.url)));
const waveform=n=>Float32Array.from({length:n},(_,i)=>.08*Math.sin(i*.137)+.03*Math.cos(i*.071)+.01*Math.sin(i*i*.001));

test('bundled replay weights match the verified PA conversion',()=>{
  const bytes=fs.readFileSync(new URL('../public/models/replay.onnx',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'9c25e59bf73b9f772e6e126c6911c984f070deb162cf75d35b854365edadc0a1');
});

test('replay LFCC matches original PyTorch frontend including deltas and boundaries',()=>{
  const reference=references[0],actual=replayFeatures(waveform(reference.length),params);
  assert.equal(actual.frames,reference.frames);
  const max=Math.max(...actual.data.map((v,i)=>Math.abs(v-reference.features[i])));
  assert.ok(max<.001,`LFCC maximum error ${max}`);
});

test('trained PA ONNX matches original logits at multiple input lengths',async()=>{
  ort.env.wasm.numThreads=1;
  const session=await ort.InferenceSession.create(new Uint8Array(fs.readFileSync(new URL('../public/models/replay.onnx',import.meta.url))),{executionProviders:['wasm']});
  try {for(const reference of references.slice(1)){
    const {data,frames}=replayFeatures(waveform(reference.length),params);
    const input=new ort.Tensor('float32',data,[1,frames,60]);
    const result=await session.run({lfcc:input});
    const value=Number(result.bonafide_logit.data[0]);
    assert.ok(Math.abs(value-reference.logit)<.001,`length ${reference.length}: ${value} vs ${reference.logit}`);
    input.dispose();result.bonafide_logit.dispose();
  }}finally{await session.release();}
});

test('replay score direction is opposite bonafide logit; invalid values fail closed',()=>{
  assert.equal(replaySignal(0),50);
  assert.ok(replaySignal(-4)>95);
  assert.ok(replaySignal(4)<5);
  assert.throws(()=>replaySignal(NaN));
  assert.throws(()=>replayFeatures(new Float32Array(100),params));
  assert.throws(()=>replayFeatures(new Float32Array(1024).fill(NaN),params));
});

test('independent detector failures preserve the other result and never become zero',async()=>{
  const partial=await runDetectorBranches({synthetic:async()=>{throw new Error('Missing weights');},replay:async()=>({score:83})});
  assert.equal(partial.synthetic,null);assert.equal(partial.replay.score,83);
  assert.equal(partial.errors.synthetic,'Missing weights');
  const opposite=await runDetectorBranches({synthetic:async()=>({score:0}),replay:async()=>({score:NaN})});
  assert.equal(opposite.synthetic.score,0);assert.equal(opposite.replay,null);
  assert.ok(opposite.errors.replay);
});
