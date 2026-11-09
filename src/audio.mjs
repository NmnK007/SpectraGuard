import {features} from './models.mjs';
// A windowed radix-2 FFT produces a measured STFT visualization, not a classifier.
export function spectrum(samples,offset,size=512) {
 const re=new Float64Array(size),im=new Float64Array(size);
 for(let i=0;i<size;i++)re[i]=(samples[offset+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/(size-1)));
 for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[re[i],re[j]]=[re[j],re[i]];}
 for(let len=2;len<=size;len<<=1){const angle=-2*Math.PI/len;for(let i=0;i<size;i+=len)for(let j=0;j<len/2;j++){const c=Math.cos(angle*j),s=Math.sin(angle*j),k=i+j,l=k+len/2,tr=re[l]*c-im[l]*s,ti=re[l]*s+im[l]*c;re[l]=re[k]-tr;im[l]=im[k]-ti;re[k]+=tr;im[k]+=ti;}}
 return Array.from({length:size/2},(_,i)=>Math.max(0,Math.min(1,(20*Math.log10(Math.hypot(re[i],im[i])/size+1e-8)+90)/80)));
}
export function analyzeSamples(samples,sampleRate){
 const duration=samples.length/sampleRate;let sum=0,clip=0;
 for(const v of samples){sum+=v*v;if(Math.abs(v)>.99)clip++;}
 const rms=Math.sqrt(sum/Math.max(1,samples.length)),clipping=clip/Math.max(1,samples.length);
 const frames=Array.from({length:240},(_,i)=>spectrum(samples,Math.floor(i*Math.max(0,samples.length-512)/240)));
 return {duration,rms,clipping,sampleRate,frames,features:features(samples,sampleRate),quality:duration<2||rms<.004||clipping>.03?'poor':'usable'};
}
export async function decodeAudio(blob){
 const bytes=await blob.arrayBuffer();const ctx=new AudioContext();
 try{const buffer=await ctx.decodeAudioData(bytes.slice(0));if(buffer.duration>30)throw new Error('Use a clip of 30 seconds or less.');const mono=new Float32Array(buffer.length);for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=0;i<data.length;i++)mono[i]+=data[i]/buffer.numberOfChannels;}const result=analyzeSamples(mono,buffer.sampleRate);mono.fill(0);return {...result,digest:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')};}finally{await ctx.close();}
}
