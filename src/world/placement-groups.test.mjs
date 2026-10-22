import test from 'node:test';
import assert from 'node:assert/strict';
import {groupPlacements,locatePlacement} from './placement-groups.mjs';

const objects=[
 ...Array.from({length:24},(_,i)=>({id:`palm-lean-${i}`,asset:'palm-lean'})),
 ...Array.from({length:31},(_,i)=>({id:`palm-tall-${i}`,asset:'palm-tall'})),
 ...Array.from({length:9},(_,i)=>({id:`rock-reef-a-${i}`,asset:'rock-reef-a'})),
 {id:'cove-hearth',asset:'hearth',layer:'origin'},{id:'cove-lamp-left',asset:'lamp',layer:'origin'},
 {id:'marker',shape:{type:'box'}},
];

test('placements group by family and asset with counts, cove last',()=>{
 const {groups,total,matched}=groupPlacements(objects);
 assert.equal(total,67);assert.equal(matched,67);
 assert.deepEqual(groups.map(g=>[g.label,g.count]),[['Palm',55],['Rock',9],['Shape',1],['Cove',2]]);
 assert.deepEqual(groups[0].assets.map(a=>[a.asset,a.count]),[['palm-tall',31],['palm-lean',24]]);
});

test('the filter matches ids and assets, and a selection can be located',()=>{
 const {groups,matched}=groupPlacements(objects,'LEAN');
 assert.equal(matched,24);assert.deepEqual(groups.map(g=>g.key),['palm']);
 assert.deepEqual(locatePlacement(groupPlacements(objects).groups,'rock-reef-a-3'),{family:'rock',asset:'rock-reef-a'});
 assert.equal(locatePlacement(groups,'missing'),null);
});

test('504 placements collapse to a handful of rows',()=>{
 const many=Array.from({length:504},(_,i)=>({id:`p${i}`,asset:['palm-tall','plant-fern','rock-cliff-a','debris-shells'][i%4]}));
 assert.equal(groupPlacements(many).groups.length,4);
});
