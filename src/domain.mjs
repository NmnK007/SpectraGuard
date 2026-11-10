export const scenarios = [
 {id:'SG-1048',name:'Urgent beneficiary transfer',kind:'Cloned scam call',time:'14:32:08',amount:48500,payee:'New beneficiary',newPayee:true,synthetic:88,replay:18,quality:'usable',freshness:'fresh',path:'unknown',transcript:'This is the bank security team. Transfer the money immediately to this safe account. Do not tell anyone.',duration:8.4},
 {id:'SG-1047',name:'Everyday payment',kind:'Genuine payment',time:'14:28:41',amount:1250,payee:'Saved beneficiary',newPayee:false,synthetic:9,replay:12,quality:'usable',freshness:'fresh',path:'unknown',transcript:'Please send the usual payment to my saved beneficiary.',duration:6.2},
 {id:'SG-1046',name:'Speaker playback',kind:'Acoustic replay',time:'14:24:16',amount:8000,payee:'Saved beneficiary',newPayee:false,synthetic:16,replay:84,quality:'usable',freshness:'fresh',path:'unknown',transcript:'I would like to make a payment to my saved beneficiary.',duration:7.1},
 {id:'SG-1045',name:'Unverified capture route',kind:'Virtual microphone scenario',time:'14:20:03',amount:18000,payee:'New beneficiary',newPayee:true,synthetic:null,replay:null,quality:'usable',freshness:'fresh',path:'unknown',transcript:'Please transfer this amount to the new beneficiary.',duration:5.8},
 {id:'SG-1044',name:'Previous session submission',kind:'Reused challenge',time:'14:16:52',amount:2500,payee:'Saved beneficiary',newPayee:false,synthetic:12,replay:14,quality:'usable',freshness:'reused',path:'unknown',transcript:'I would like to complete my payment.',duration:6.4},
 {id:'SG-1043',name:'Noisy café recording',kind:'Low-quality genuine speech',time:'14:12:29',amount:900,payee:'Saved beneficiary',newPayee:false,synthetic:null,replay:null,quality:'poor',freshness:'fresh',path:'unknown',transcript:'Please pay for my order.',duration:4.1}
].map(x=>({...x,mode:'demo'}));

// Context rules are review cues. They do not infer emotion, intent, identity, or fraud.
export function contextFlags(text='') {
 const rules=[['secrecy','Secrecy request',/\b(do not tell anyone|don['’]t tell anyone|keep (?:this |it )?(?:a )?secret)\b/ig],['credential','Credential request',/\b(?:share|send|tell|give|read)(?:\s+\w+){0,4}\s+(?:otp|pin|password|verification code)\b/ig],['urgency','Time pressure',/\b(immediately|right now|within \d+ minutes|urgent(?:ly)?)\b/ig],['destination','Payment redirection',/\b(safe account|temporary account|security account)\b/ig],['authority','Authority claim',/\b(bank security team|police officer|bank manager)\b/ig]];
 const flags=[];
 for(const [code,label,re] of rules)for(const m of text.matchAll(re)){
   const prefix=text.slice(Math.max(0,m.index-35),m.index);
   if(['credential','urgency'].includes(code)&&/\b(?:never|do not|don['’]t|no need to)\s+(?:\w+\s+){0,3}$/i.test(prefix))continue;
   flags.push({code,label,match:m[0],start:m.index,end:m.index+m[0].length});
 }
 return flags.sort((a,b)=>a.start-b.start);
}
export function decide(s,policy={highAmount:25000,audioThreshold:70}) {
 const flags=contextFlags(s.transcript);
 const reasons=[];
 if(s.freshness!=='fresh')return {action:'Reissue challenge',tone:'blue',reasons:['SESSION_NOT_FRESH'],description:'The session evidence is stale, reused, mismatched, or unavailable. Start a fresh verification attempt.',flags};
 if(s.quality!=='usable')return {action:'Retry or use another method',tone:'blue',reasons:['AUDIO_INCONCLUSIVE'],description:'There is not enough usable audio to assess. Offer a quieter retry or a non-voice route.',flags};
 if(s.synthetic!=null&&s.synthetic>=policy.audioThreshold)reasons.push('SYNTHETIC_SIGNAL');
 if(s.replay!=null&&s.replay>=policy.audioThreshold)reasons.push('REPLAY_SIGNAL');
 if(s.newPayee)reasons.push('NEW_BENEFICIARY');
 if(s.amount>=policy.highAmount)reasons.push('HIGH_VALUE');
 if(flags.length>=2)reasons.push('CONTEXT_REVIEW');
 if(s.synthetic==null||s.replay==null)reasons.push('MODEL_UNAVAILABLE');
 const strong=flags.some(x=>['credential','destination'].includes(x.code));
 if(reasons.some(x=>['SYNTHETIC_SIGNAL','REPLAY_SIGNAL'].includes(x))&&(s.newPayee||strong))return {action:'Pause & verify',tone:'amber',reasons,description:'Multiple signals warrant an independent check before this mock payment proceeds.',flags};
 if(reasons.length)return {action:'Step-up verification',tone:'amber',reasons,description:'Use a bank-controlled second factor or a callback through a known, trusted channel.',flags};
 return {action:'Continue normal checks',tone:'lime',reasons:['NO_CURRENT_WARNING'],description:'No configured warning was raised. Existing payment authentication and bank risk controls still apply.',flags};
}
export function report(s,policy) {const d=decide(s,policy);return {product:'SpectraGuard',version:'prototype-0.1',generatedAt:new Date().toISOString(),session:s.id,mode:s.mode,evidence:{synthetic:s.synthetic,replay:s.replay,quality:s.quality,sessionFreshness:s.freshness,captureOrigin:'unknown'},decision:{action:d.action,reasonCodes:d.reasons},limitations:['No identity or fraud determination','Demo scores are simulated; local model scores are experimental and not calibrated fraud probabilities','Browser capture does not prove a physical microphone','No real payment or authentication is performed'],privacy:{rawAudioIncluded:false,transcriptIncluded:false,payeeIncluded:false}};}
