import {test} from 'node:test';
import assert from 'node:assert/strict';
import {linearHex,placedBottom,placedExtent,underwaterAssets,underwaterColor,waterCeiling} from './water-optics.mjs';

const water={level:-2.5,waves:[{amplitude:.07},{amplitude:.04},{amplitude:.025}],color:'#0b4a7c',shallowColor:'#4fd2cf'};
const near=(a,b,e=1e-3)=>a.every((v,i)=>Math.abs(v-b[i])<e);

test('the tint leaves dry surfaces alone and fades in over the first 12 cm',()=>{
  const coral=linearHex('#e8d8c4');
  assert.deepEqual(underwaterColor(coral,0,water),coral);
  assert.deepEqual(underwaterColor(coral,-3,water),coral,'above the water');
  const just=underwaterColor(coral,.05,water),full=underwaterColor(coral,.5,water);
  assert.ok(Math.abs(just[0]-coral[0])<Math.abs(full[0]-coral[0]));
});

test('red is absorbed first, and deeper surfaces move toward the scatter colour',()=>{
  const white=[1,1,1],shallow=underwaterColor(white,1,water),deep=underwaterColor(white,6,water);
  assert.ok(shallow[0]<shallow[1]&&shallow[0]<shallow[2],'red drops fastest');
  assert.ok(deep[0]<shallow[0]&&deep[1]<shallow[1]);
  const far=underwaterColor(white,40,water);assert.ok(near(far,linearHex('#0b4a7c')),'deep water is the deep colour');
});

test('an object and the seabed at the same depth take the same colour',()=>{
  const sand=linearHex('#d8c49a');
  assert.deepEqual(underwaterColor(sand,2.2,water),underwaterColor([...sand],2.2,water));
  const defaults=underwaterColor(sand,2.2,{}),themed=underwaterColor(sand,2.2,water);
  assert.notDeepEqual(defaults,themed,'the world water colours apply');
});

test('placements are tinted when any part can reach below the highest crest',()=>{
  assert.ok(Math.abs(waterCeiling(water)-(-2.5+.135+.15))<1e-12);
  const box={min:[-1,0,-1],max:[1,2,1]};
  assert.equal(placedBottom(box,{position:[0,-3,0]}),-3);
  assert.ok(Math.abs(placedBottom(box,{position:[0,0,0],rotation:[Math.PI,0,0]})-(-2))<1e-12,'flipped upside down');
  assert.ok(Math.abs(placedBottom(box,{position:[0,0,0],rotation:[0,0,Math.PI/2],scale:[2,1,1]})-(-2))<1e-12,'rolled onto its scaled side');
  const bounds={coral:{min:[-.5,0,-.5],max:[.5,.6,.5]},palm:{min:[-1,0,-1],max:[1,9,1]},rock:{min:[-1,-.8,-1],max:[1,1,1]}};
  const placed=[{asset:'coral',position:[0,-3.4,0]},{asset:'palm',position:[0,1.2,0]},{asset:'rock',position:[4,-1.6,0]},{asset:'rock',position:[9,3,0]},{shape:{type:'box'},position:[0,-9,0]},{asset:'missing',position:[0,-9,0]}];
  assert.deepEqual([...underwaterAssets(placed,bounds,water)].sort(),['coral','rock'],'a rock reaching 2.4 m down counts; the palm on the beach does not');
});

test('only placements over the ocean rectangle take the tint',()=>{
  // A floating court: a pool at level 0 inside [-5,5,-5,5], with a foundation and an inverted spire far below it elsewhere.
  const pool={...water,level:0,bounds:[-5,5,-5,5]};
  const bounds={coping:{min:[-1,-.6,-.2],max:[1,.1,.2]},foundation:{min:[-3,-12,-3],max:[3,0,3]},spire:{min:[-1,0,-1],max:[1,20,1]}};
  const placed=[{asset:'coping',position:[4.9,0,0]},{asset:'foundation',position:[20,0,0]},{asset:'spire',position:[0,-40,30],rotation:[Math.PI,0,0]}];
  assert.deepEqual([...underwaterAssets(placed,bounds,pool)],['coping'],'the coping edge reaches into the pool; the rest is dry');
  const {min,max}=placedExtent({min:[0,0,-1],max:[4,1,1]},{position:[10,0,0],rotation:[0,Math.PI/2,0]});
  assert.ok(Math.abs(min[0]-9)<1e-12&&Math.abs(max[0]-11)<1e-12&&Math.abs(min[2]-(-4))<1e-12&&Math.abs(max[2])<1e-12,'a quarter turn about y swings +x onto -z');
  assert.deepEqual([...underwaterAssets(placed,bounds,{...pool,bounds:undefined})].sort(),['coping','foundation','spire'],'without bounds every low placement still counts');
});
