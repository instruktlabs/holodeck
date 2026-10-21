// Explicit manual test. Uses one turn on the user's signed-in ChatGPT subscription.
// Never included in npm test or build.
import {WorldStore} from '../server/world-store.mjs';
import {CodexAgent} from '../server/codex.mjs';
import {ensureKilnWorkspace} from '../server/kiln-workspace.mjs';
import {mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-codex-proof-')),store=await WorldStore.open(root);let proposal;
await ensureKilnWorkspace(root);
const agent=new CodexAgent(store,{observe:()=>null,propose:async(change,isActive)=>{const candidate={...store.snapshot(),...Object.fromEntries(Object.entries(change).filter(([k])=>['scene','bible','references'].includes(k)))};await store.prepare(candidate);if(!isActive())throw new Error('Canceled');proposal=change;return {status:'awaiting user review'};}});
const report={workspace:root,tools:[]};
try{
 const connected=await agent.connect();report.account=connected.account;report.model=connected.model;
 const finished=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Live turn exceeded 90 seconds')),90000);agent.on('agent',s=>{if(s.requests?.length){for(const r of s.requests){if(!r.params.questions)agent.answer({id:r.id,decision:'decline'});}}if(['completed','failed','interrupted'].includes(s.status)){clearTimeout(timeout);resolve(s);}});});
 agent.rpc.on('request',m=>{if(m.method==='item/tool/call')report.tools.push(m.params.tool);});
 await agent.startTurn({text:'This is a bounded Holodeck adapter test in a disposable world. Call world_read, then reference_read for the cove-intention note. Propose only changing the bible title to "Local connection verified" using world_propose with the correct base revision and all other bible fields preserved. Do not use shell, connectors, asset tools, or edit files. Do not claim applied. Then finish with one sentence.',model:connected.model,effort:connected.models.find(m=>m.model===connected.model)?.supportedReasoningEfforts.some(e=>e.reasoningEffort==='low')?'low':null});
 const result=await finished;report.status=result.status;report.threadId=result.threadId;report.error=result.error;report.messages=result.messages;
 if(result.status!=='completed'||!proposal||proposal.bible.title!=='Local connection verified')throw new Error(result.error||'Expected proposal was not produced');
 if(store.current.bible.title==='Local connection verified')throw new Error('Proposal applied without acceptance');
 await store.commit(proposal);report.appliedRevision=store.current.revision;
 console.log(JSON.stringify({status:report.status,model:report.model,tools:report.tools,appliedRevision:report.appliedRevision,workspace:root}));
}catch(e){report.error=e.message;process.exitCode=1;console.log(JSON.stringify({error:e.message,tools:report.tools,status:agent.state.status}));}
finally{await writeFile('evidence/codex-live-probe.json',JSON.stringify(report,null,2));agent.close();await store.close();}
