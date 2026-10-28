import {stats,rules} from './range-session.mjs';
import {rangeView} from './range-view.mjs';
const css={background:'#23383b',color:'#edf3ef',border:'1px solid #668480',borderRadius:'4px',padding:'5px 7px',margin:'3px',cursor:'pointer'};
export function rangeUI(action,exportSession){
 const host=document.createElement('section');host.setAttribute('aria-label','Range session');Object.assign(host.style,{position:'fixed',right:'18px',top:'78px',width:'300px',maxHeight:'76vh',overflowY:'auto',zIndex:21,background:'#101b20ed',color:'#edf3ef',padding:'12px',border:'1px solid #557574',borderRadius:'10px',font:'13px system-ui'});
 const title=document.createElement('strong');title.textContent='RANGE · STRING & TARGET REVIEW';host.append(title);
 const lanes=document.createElement('div'),buttons=new Map();for(const [id,label] of [['paper','Paper'],['plates','Plates'],['original','Original']]){const b=document.createElement('button');b.textContent=label;Object.assign(b.style,css);b.onclick=()=>{action('select',id);b.blur();};lanes.append(b);buttons.set(id,b);}host.append(lanes);
 const status=document.createElement('div');status.setAttribute('role','status');host.append(status);
 const controls=document.createElement('div');for(const [id,label] of [['start','Start string'],['end','End string'],['return','Return paper'],['replace','New sheet']]){const b=document.createElement('button');b.textContent=label;Object.assign(b.style,css);b.onclick=()=>{action(id);b.blur();};controls.append(b);buttons.set(id,b);}const exp=document.createElement('button');exp.textContent='Export session';exp.onclick=exportSession;Object.assign(exp.style,css);controls.append(exp);host.append(controls);
 const keys=document.createElement('div');keys.textContent='Fire starts a string · L lane · Backspace end · P return paper · Y new sheet / reset plates · PgUp/PgDn review · F8 export';Object.assign(keys.style,{fontSize:'11px',color:'#b9c8c5',margin:'2px 3px 6px'});host.append(keys);
 const history=document.createElement('select');history.setAttribute('aria-label','Shot string review');history.style.width='100%';host.append(history);
 const summary=document.createElement('div');summary.style.margin='8px 0';host.append(summary);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 280 240');svg.setAttribute('role','img');svg.setAttribute('aria-label','Numbered shot group');svg.style.width='100%';svg.style.background='#dad9cd';host.append(svg);
 const detail=document.createElement('div');detail.style.fontSize='11px';host.append(detail);document.body.append(host);
 let stamp='';
 function draw(rows,lane){svg.replaceChildren();const add=(tag,attrs,text)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);};const scale=260/Math.max(rules[lane]?.width??.8,rules[lane]?.height??.8),point=local=>[140+local[0]*scale,120-local[1]*scale];
  if(lane!=='plates'){const spec=rules[lane],c=point(spec.center);for(const r of spec.radii)add('circle',{cx:c[0],cy:c[1],r:r*scale,fill:'none',stroke:'#68726e','stroke-width':1});}
  else for(let i=0;i<5;i++){add('circle',{cx:35+i*52,cy:110,r:19,fill:'#b2bab5',stroke:'#68726e','stroke-width':1});add('text',{x:31+i*52,y:145,fill:'#253334','font-size':12},String(i+1));}
  rows.forEach((shot,i)=>{if(shot.outcome!=='hit'||!shot.impact)return;const p=lane==='plates'?[35+(shot.impact.plate??0)*52,110]:point(shot.impact.local);add('circle',{cx:p[0],cy:p[1],r:5,fill:'#ac462f'});add('text',{x:p[0]+6,y:p[1]-5,fill:'#253334','font-size':12},String(i+1));});
  const g=stats(rows).group;if(g.centroid){const p=point(g.centroid);add('path',{d:`M${p[0]-7},${p[1]}h14 M${p[0]},${p[1]-7}v14`,stroke:'#087c86','stroke-width':2});}
 }
 return {host,update(s,enabled,ready){host.hidden=!enabled;const moving=['returning','deploying','blocked'].includes(s.phase);status.textContent=ready?`${s.lane.toUpperCase()} · ${s.phase} · ${s.message}`:'Waiting for target bindings…';for(const lane of ['paper','plates','original']){buttons.get(lane).disabled=!ready||s.phase==='active'||moving;buttons.get(lane).setAttribute('aria-pressed',String(s.lane===lane));}
  buttons.get('start').disabled=!ready||!['ready','review'].includes(s.phase);buttons.get('end').disabled=s.phase!=='active';buttons.get('return').disabled=!ready||s.lane!=='paper'||s.phase==='deploying';buttons.get('return').textContent=s.phase==='blocked'?'Resume travel':'Return paper';buttons.get('replace').disabled=s.lane!=='paper'||s.phase!=='review'||s.travel<1;
  if(history.options.length!==s.archives.length+1){const selected=history.value;history.replaceChildren();for(const [value,label]of [['current','Current string'],...s.archives.map((a,i)=>[String(i),`String ${a.stringId} · ${a.lane} · ${a.stats.points} pts`])]){const o=document.createElement('option');o.value=value;o.textContent=label;history.append(o);}history.value=selected||'current';}
  const view=rangeView(s,history.value),{rows,lane,stats:st,key:next}=view,g=st.group;summary.textContent=`${st.points} pts · ${st.hits}/${st.shots} hits · ${st.misses} misses · ${st.blocked} blocked · ${st.nonScoring} non-scoring`;
  detail.textContent=lane==='plates'?`${view.plateHits}/5 plates in this group. Start a new string to reset.`:g.count<2?'Group size needs two hits. Cyan cross = centroid.':`Spread ${(g.spread*100).toFixed(2)} cm · RMS ${(g.rms*100).toFixed(2)} cm · centroid (${(g.centroid[0]*100).toFixed(2)}, ${(g.centroid[1]*100).toFixed(2)}) cm`;
  if(stamp!==next){draw(rows,lane);stamp=next;}
  return view;
 },
 // PageUp steps back through archived strings and PageDown forward to the current one, as in Unreal.
 review(step){const count=history.options.length-1,at=history.value==='current'?null:Number(history.value);const next=step<0?(at===null?(count?count-1:null):Math.max(0,at-1)):(at===null||at+1>=count?null:at+1);history.value=next===null?'current':String(next);},
 dispose(){host.remove();}};
}
