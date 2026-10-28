import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sceneHomeHref} from '../src/viewer/scene-home.mjs';

test('the scene name returns to the shelf above worlds/<id>/',()=>{
 assert.equal(sceneHomeHref('/worlds/crescent-cove/'),'../../');
 assert.equal(sceneHomeHref('/worlds/crescent-cove/index.html'),'../../');
 assert.equal(sceneHomeHref('/holodeck/worlds/cove/'),'../../');
 assert.equal(sceneHomeHref('/holodeck/worlds/cove'),'../');
 assert.equal(sceneHomeHref('/garden/'),'./');
 assert.equal(sceneHomeHref('/'),'./');
 assert.equal(sceneHomeHref('/worlds/'),'./');
});
