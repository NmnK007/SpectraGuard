// A failed detector never erases the independent branch or becomes a zero score.
export async function runDetectorBranches(detectors) {
  const result={synthetic:null,replay:null,errors:{}};
  for(const branch of ['synthetic','replay']) {
    try {
      const value=await detectors[branch]();
      if(value===null){result.errors[branch]='Insufficient usable audio for this detector';continue;}
      if(!Number.isFinite(value?.score)||value.score<0||value.score>100)throw new Error('Invalid detector score');
      result[branch]=value;
    }catch(error){result.errors[branch]=error.message||'Detector unavailable';}
  }
  return result;
}
