export const initialSession = { phase:'welcome', world:false, clear:true, bridge:null, preview:null, previous:null, canUndo:false, job:0, task:null, request:'', notice:'', target:null };
export function sessionReducer(s,a) {
  switch(a.type) {
    case 'REQUEST_WORLD': return {...s,phase:'decision',request:a.text,notice:''};
    case 'CHOOSE_RULE': return {...s,phase:'building',task:'world',clear:a.clear,job:s.job+1,notice:''};
    case 'BUILD_BRIDGE':
      if(!s.world || a.target!=='crossing') return {...s,notice:'Select the stream crossing first, then ask for a bridge.'};
      return {...s,phase:'building',task:'bridge',job:s.job+1,target:a.target,request:a.text,notice:'',draft:'high'};
    case 'REVISE':
      if(!s.world || (!s.preview && !s.bridge)) return s;
      return {...s,phase:'building',task:'bridge',job:s.job+1,draft:'low',request:a.text||'Lower the rails. Keep the crossing open.',notice:''};
    case 'COMPLETE':
      if(s.phase!=='building' || a.job!==s.job) return s;
      return s.task==='world' ? {...s,phase:'world',world:true,task:null} : {...s,phase:'preview',preview:s.draft,task:null};
    case 'STOP': return {...s,phase:s.world?(s.preview?'preview':'world'):'welcome',task:null,job:s.job+1,notice:'Stopped. The last applied scene is unchanged.'};
    case 'APPLY':
      if(!s.preview || s.phase!=='preview') return s;
      return {...s,phase:'applied',previous:s.bridge,bridge:s.preview,preview:null,canUndo:true,notice:''};
    case 'DISCARD': return {...s,phase:s.bridge?'applied':'world',preview:null,notice:'Preview discarded.'};
    case 'UNDO':
      if(!s.canUndo) return s;
      return {...s,phase:s.previous?'applied':'world',bridge:s.previous,preview:null,canUndo:false,notice:'Restored the previous crossing.'};
    case 'NEED_TARGET': return {...s,notice:'Look at the stream and press E, or use Select crossing below.'};
    case 'UNSUPPORTED': return {...s,notice:'This mock can create a woodland, build a bridge at the crossing, lower its rails, and undo. Try a suggestion below.'};
    default:return s;
  }
}
export function interpret(text,s,target) {
  const q=text.toLowerCase();
  if(/\b(stop|cancel)\b/.test(q) && s.phase==='building') return {type:'STOP'};
  if(s.phase==='building') return {type:'UNSUPPORTED'};
  if(/\bundo\b/.test(q)) return {type:'UNDO'};
  if(/\b(apply|keep it|accept)\b/.test(q)&&s.preview) return {type:'APPLY'};
  if(/\b(discard|reject)\b/.test(q)&&s.preview) return {type:'DISCARD'};
  if(/\b(lower|rails|revise)\b/.test(q)&&(s.preview||s.bridge)) return {type:'REVISE',text};
  if(/\b(bridge|crossing)\b/.test(q)&&s.world) return target ? {type:'BUILD_BRIDGE',text,target} : {type:'NEED_TARGET'};
  if(/\b(woodland|forest|stream|world)\b/.test(q)&&!s.world) return {type:'REQUEST_WORLD',text};
  return {type:'UNSUPPORTED'};
}
