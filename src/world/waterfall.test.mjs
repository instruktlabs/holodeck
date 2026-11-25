import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWater} from './terrain.mjs';
import {validateWaterfalls,resolveWaterfall,buildWaterfallCurtainData,buildWaterfallSplashData,buildWaterfallMistData} from './waterfall.mjs';

const fall=extra=>({id:'main-fall',top:[17,15,-37],bottom:[16,-2,-35],...extra});
const water=extra=>({type:'ocean',bounds:[-40,40,-60,20],level:-2,waves:[],...extra});

test('waterfall schema validates bounded falls and rejects invalid inputs',()=>{
 assert.equal(validateWater(water({falls:[fall()]})).falls.length,1);
 assert.equal(validateWaterfalls([fall({facing:[0,1],width:4,spread:1.4,arch:1.5,speed:6,opacity:.9,color:'#eefbff',tint:'#5ec8cc',mist:{radius:6,height:5,opacity:.6}})]).length,1);
 assert.equal(validateWaterfalls([fall({mist:null})]).length,1);
 for(const bad of [
  [fall({top:[0,1,0],bottom:[0,1,0]})],
  [fall({facing:[2,0]})],
  [fall({width:0})],
  [fall({spread:.2})],
  [fall({speed:0})],
  [fall({color:'white'})],
  [fall({mist:{radius:0}})],
  [fall({unknown:true})],
  [fall({id:'dup'}),fall({id:'dup'})],
  Array.from({length:9},(_,i)=>fall({id:`f${i}`})),
 ])assert.throws(()=>validateWaterfalls(bad));
});

test('waterfall geometry builders produce finite indexed buffers and respect mist opt-out',()=>{
 const resolved=resolveWaterfall(fall());
 assert.ok(resolved.drop>16);
 assert.ok(Math.abs(Math.hypot(...resolved.facing)-1)<1e-6);
 const curtain=buildWaterfallCurtainData(fall());
 assert.ok(curtain.positions.length>0&&curtain.indices.length>0);
 assert.ok(curtain.positions.every(Number.isFinite));
 const splash=buildWaterfallSplashData(fall(),-2);
 const mist=buildWaterfallMistData(fall(),-2);
 assert.ok(splash.positions.every(Number.isFinite)&&mist.positions.every(Number.isFinite));
 assert.equal(buildWaterfallSplashData(fall({mist:null}),-2),null);
 assert.equal(buildWaterfallMistData(fall({mist:null}),-2),null);
});
