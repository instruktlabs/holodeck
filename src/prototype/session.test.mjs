import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialSession, sessionReducer as reduce, interpret } from './session.mjs';
test('canceled builds cannot arrive late', () => {
  const decision=reduce(initialSession,{type:'REQUEST_WORLD',text:'woodland'});
  const building=reduce(decision,{type:'CHOOSE_RULE',clear:true});
  const stopped=reduce(building,{type:'STOP'});
  assert.equal(reduce(stopped,{type:'COMPLETE',job:building.job}),stopped);
  assert.equal(stopped.world,false);
});
test('bridge previews are separate from committed geometry and undo restores prior revision', () => {
  let s=reduce(initialSession,{type:'CHOOSE_RULE',clear:true});
  s=reduce(s,{type:'COMPLETE',job:s.job});
  s=reduce(s,{type:'BUILD_BRIDGE',text:'bridge here',target:'crossing'});
  s=reduce(s,{type:'COMPLETE',job:s.job});
  assert.equal(s.bridge,null); assert.equal(s.preview,'high');
  s=reduce(s,{type:'APPLY'}); assert.equal(s.bridge,'high');
  s=reduce(s,{type:'REVISE',text:'lower rails'});
  s=reduce(s,{type:'COMPLETE',job:s.job});
  assert.equal(s.bridge,'high'); assert.equal(s.preview,'low');
  s=reduce(s,{type:'APPLY'}); assert.equal(s.bridge,'low');
  s=reduce(s,{type:'UNDO'}); assert.equal(s.bridge,'high');
});
test('unknown requests and bridge requests without a target never mutate the world', () => {
  assert.equal(interpret('add a dragon', initialSession, null).type,'UNSUPPORTED');
  assert.equal(interpret('build a bridge', {...initialSession,world:true}, null).type,'NEED_TARGET');
  assert.equal(reduce(initialSession,{type:'APPLY'}),initialSession);
});
