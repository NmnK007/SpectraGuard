// LFCC frontend port of Xin Wang's BSD-3-Clause ASVspoof2021 PA baseline.
// See public/models/REPLAY-LICENSE.txt and REPLAY.md. Do not substitute the
// visualization FFT: this model requires raw power, Hamming and log10 LFCC.
export function replayFeatures(pcm, parameters) {
  if(pcm.length<1024||!pcm.every(Number.isFinite))throw new Error('Invalid replay waveform');
  const frames=Math.floor(pcm.length/160)+1, base=new Float32Array(frames*20);
  const emphasized=new Float32Array(pcm.length);
  emphasized[0]=pcm[0];
  for(let i=1;i<pcm.length;i++)emphasized[i]=pcm[i]-Math.fround(.97*pcm[i-1]);
  const re=new Float64Array(1024),im=new Float64Array(1024),power=new Float32Array(256),log=new Float32Array(20);
  for(let frame=0;frame<frames;frame++) {
    re.fill(0);im.fill(0);
    for(let j=0;j<320;j++)re[j]=Math.fround((emphasized[frame*160-160+j]||0)*parameters.window[j]);
    for(let i=1,j=0;i<1024;i++){let bit=512;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[re[i],re[j]]=[re[j],re[i]];}
    for(let len=2;len<=1024;len<<=1){const angle=-2*Math.PI/len;for(let i=0;i<1024;i+=len)for(let j=0;j<len/2;j++){
      const c=Math.cos(angle*j),s=Math.sin(angle*j),k=i+j,l=k+len/2,tr=re[l]*c-im[l]*s,ti=re[l]*s+im[l]*c;
      re[l]=re[k]-tr;im[l]=im[k]-ti;re[k]+=tr;im[k]+=ti;
    }}
    let energy=0;
    for(let k=0;k<256;k++){power[k]=re[k]*re[k]+im[k]*im[k];energy+=power[k]/1024;}
    for(let c=0;c<20;c++){let value=0;for(let k=0;k<256;k++)value+=power[k]*parameters.filterbank[k][c];log[c]=Math.log10(value+1.1920928955078125e-7);}
    for(let c=0;c<20;c++){let value=0;for(let k=0;k<20;k++)value+=log[k]*parameters.dct[c][k];base[frame*20+c]=value;}
    base[frame*20]=Math.log10(energy+1.1920928955078125e-7);
  }
  const delta=x=>{const out=new Float32Array(x.length);for(let f=0;f<frames;f++)for(let c=0;c<20;c++)out[f*20+c]=x[Math.min(frames-1,f+1)*20+c]-x[Math.max(0,f-1)*20+c];return out;};
  const d=delta(base),dd=delta(d),data=new Float32Array(frames*60);
  for(let f=0;f<frames;f++){data.set(base.subarray(f*20,f*20+20),f*60);data.set(d.subarray(f*20,f*20+20),f*60+20);data.set(dd.subarray(f*20,f*20+20),f*60+40);}
  emphasized.fill(0);base.fill(0);d.fill(0);dd.fill(0);
  return {data,frames};
}

// Original training label: bonafide=1, replay/spoof=0.
export function replaySignal(bonafideLogit) {
  if(!Number.isFinite(bonafideLogit))throw new Error('Invalid replay model output');
  return Math.round(100/(1+Math.exp(bonafideLogit)));
}
