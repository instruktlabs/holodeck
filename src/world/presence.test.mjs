import test from 'node:test';
import assert from 'node:assert/strict';
import {agentPresence,readLastAgent,writeLastAgent,modelGroups,isExactModel} from './presence.mjs';

test('presence puts a pending request ahead of work, and work ahead of idle',()=>{
 assert.deepEqual(agentPresence({provider:'claude',connected:true,turnId:'t',activity:'Bash',requests:[{id:1},{id:2}]}),{state:'needs',label:'Claude needs you',count:2});
 assert.deepEqual(agentPresence({provider:'cursor',connected:true,status:'working',activity:'editing'}),{state:'working',label:'Cursor · editing'});
 assert.equal(agentPresence({provider:'codex',connected:true,status:'ready'}).label,'Codex · ready');
 assert.equal(agentPresence({provider:'claude',connected:true,status:'interrupted'}).state,'stopped');
});

test('a disconnected world offers its last provider for one-click reconnect',()=>{
 assert.deepEqual(agentPresence({connected:false},{remembered:{provider:'claude'}}),{state:'disconnected',label:'Claude Code is not connected',reconnect:'claude'});
 assert.deepEqual(agentPresence({connected:false}),{state:'disconnected',label:'No agent connected'});
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 writeLastAgent(storage,'w1',{provider:'claude',model:'opus',effort:'max'});
 assert.deepEqual(readLastAgent(storage,'w1'),{provider:'claude',model:'opus',effort:'max'});
 assert.equal(readLastAgent(storage,'w2'),null,'each world remembers its own provider');
 assert.equal(readLastAgent({getItem:()=>{throw new Error('blocked');}},'w1'),null);
});

test('exact model IDs are listed apart from aliases',()=>{
 assert.equal(isExactModel('opus'),false);assert.equal(isExactModel('claude-opus-5-5'),true);assert.equal(isExactModel('gpt-5.2'),true);
 assert.deepEqual(modelGroups([{model:'default'},{model:'opus'},{model:'claude-opus-5-5'}]).map(g=>[g.label,g.models.map(m=>m.model)]),[['Aliases',['default','opus']],['Exact model IDs',['claude-opus-5-5']]]);
 assert.deepEqual(modelGroups([{model:'opus'}]).map(g=>g.label),['Aliases'],'an empty group is left out');
});
