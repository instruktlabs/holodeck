import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineSpans,messageBlocks} from './message-format.mjs';

test('agent replies split into headings, lists, tables and paragraphs',()=>{
 const blocks=messageBlocks('## What it has\n\nIntro line\nsecond line\n\n- **Water:** waves\n- Sky\n  continued\n\n1. First\n2. Second\n\n| Area | Has |\n|---|---|\n| Water | Sine waves |\n| Sky | Sun |');
 assert.deepEqual(blocks.map(b=>b.type),['heading','paragraph','list','list','table']);
 assert.equal(blocks[0].level,2);
 assert.equal(blocks[1].text,'Intro line\nsecond line');
 assert.deepEqual(blocks[2].items,['**Water:** waves','Sky continued']);
 assert.equal(blocks[3].ordered,true);
 assert.deepEqual(blocks[4].head,['Area','Has']);
 assert.deepEqual(blocks[4].rows,[['Water','Sine waves'],['Sky','Sun']]);
});

test('inline emphasis and code become spans and markup stays text',()=>{
 assert.deepEqual(inlineSpans('Use **world_read** then `world_propose` <b>now</b>'),[
  {text:'Use '},{text:'world_read',strong:true},{text:' then '},{text:'world_propose',code:true},{text:' <b>now</b>'}]);
 assert.deepEqual(messageBlocks('a | b'),[{type:'paragraph',text:'a | b'}],'a pipe without a rule is not a table');
});
