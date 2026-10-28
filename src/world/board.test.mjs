import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPaintKey,cardLayout,placeCards} from './board.mjs';

test('a fresh empty pin list does not change the painted board',()=>{
 const board={page:0,title:'Hearth',theme:'linen'},card={id:'ref',kind:'image',file:'references/files/a.png',title:'Begin',notes:'A place',group:'Atmosphere',status:'exploring',page:0,layout:{x:30,y:115,w:385,h:385}};
 assert.equal(boardPaintKey(board,[card],[]),boardPaintKey(board,[card],[]));
 assert.notEqual(boardPaintKey(board,[card],[]),boardPaintKey(board,[{...card,title:'Changed'}],[]));
 assert.notEqual(boardPaintKey(board,[card],[]),boardPaintKey(board,[card],['ref']));
});

test('cards added one at a time take distinct free slots instead of stacking',()=>{
 const refs=[{id:'cove',page:0,layout:{x:840,y:115,w:330,h:385}}];
 for(let i=0;i<5;i++){const [slot]=placeCards(refs,1,0);refs.push({id:`r${i}`,...slot});}
 const sheet0=refs.slice(1).filter(r=>r.page===0).map(r=>`${r.layout.x},${r.layout.y}`);
 assert.equal(new Set(sheet0).size,sheet0.length,'no two new cards share a position');
 assert.ok(refs.slice(1).every(r=>!(r.page===0&&r.layout.x+r.layout.w>840&&r.layout.y<500)),'the existing card keeps its space');
 assert.ok(refs.some(r=>r.page===1),'a full sheet spills onto the next one');
});

test('a batch fills the current sheet first and keeps legacy unplaced cards in mind',()=>{
 const legacy=[{id:'a'},{id:'b'}];
 const slots=placeCards(legacy,3,0);
 assert.deepEqual(slots.map(s=>s.layout),[cardLayout({},2),cardLayout({},3),cardLayout({},4)]);
 assert.ok(slots.every(s=>s.page===0));
 assert.equal(placeCards([],2,4)[0].page,4,'placement starts at the visible sheet');
});
