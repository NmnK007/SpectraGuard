export const FEATURE_VERSION='sg-acoustic-v1';
export const FEATURE_NAMES=['rms','zcr','meanAbs','crest','rmsVariation','differenceEnergy','lag1','lag16'];
// Lightweight, interpretable baseline features. They are not universal spoof indicators.
export function features(input,sampleRate){
 const n=Math.floor(input.length*16000/sampleRate),a=new Float32Array(n);
 for(let i=0;i<n;i++){const t=i*sampleRate/16000,k=Math.floor(t),f=t-k;a[i]=(input[k]||0)*(1-f)+(input[k+1]||0)*f;}
 let square=0,abs=0,peak=0,cross=0,diff=0,lag1=0,lag16=0;const windows=[];
 for(let i=0;i<n;i++){const x=a[i];square+=x*x;abs+=Math.abs(x);peak=Math.max(peak,Math.abs(x));if(i){if(x*a[i-1]<0)cross++;diff+=(x-a[i-1])**2;lag1+=x*a[i-1];}if(i>=16)lag16+=x*a[i-16];}
 for(let i=0;i<n;i+=400){let s=0;const len=Math.min(400,n-i);for(let j=i;j<i+len;j++)s+=a[j]**2;windows.push(Math.sqrt(s/len));}
 const rms=Math.sqrt(square/Math.max(n,1)),mean=windows.reduce((s,x)=>s+x,0)/Math.max(windows.length,1),sd=Math.sqrt(windows.reduce((s,x)=>s+(x-mean)**2,0)/Math.max(windows.length,1));
 a.fill(0);return [rms,cross/Math.max(n,1),abs/Math.max(n,1),peak/(rms+1e-8),sd/(mean+1e-8),diff/(square+1e-8),lag1/(square+1e-8),lag16/(square+1e-8)];
}
export function validateModel(m,branch){
 if(m?.format!==FEATURE_VERSION||m.branch!==branch||!['synthetic','replay'].includes(branch)||typeof m.name!=='string'||m.name.length>100||!Number.isFinite(m.bias))throw new Error('Unsupported model format or branch.');
 for(const key of ['weights','mean','scale'])if(!Array.isArray(m[key])||m[key].length!==FEATURE_NAMES.length||!m[key].every(Number.isFinite))throw new Error('Invalid model parameters.');
 if(m.scale.some(x=>x<=0)||!m.validation||m.validation.samples<4)throw new Error('Model needs positive scales and a held-out evaluation summary.');
 return m;
}
export function predict(m,vector){validateModel(m,m.branch);if(vector.length!==FEATURE_NAMES.length||!vector.every(Number.isFinite))throw new Error('Invalid audio features.');const z=m.bias+m.weights.reduce((sum,w,i)=>sum+w*(vector[i]-m.mean[i])/m.scale[i],0);return Math.round(100/(1+Math.exp(-Math.max(-30,Math.min(30,z)))));}
