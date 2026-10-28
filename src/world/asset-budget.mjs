import {placedObjects} from './scatter.mjs';
// Unique assets in a schema-v2 scene, set from a browser stress test rather than a guess:
// see "Asset budget" in docs/architecture.md for the measurements and the rule.
export const MAX_ASSETS=128;
// Legacy schema-v1 scenes keep their original cap; the v1 runtime was not remeasured.
export const LEGACY_MAX_ASSETS=64;
export const MAX_PLACEMENTS=1200;
export const MAX_PLACED_TRIANGLES=2000000;
export function placedSourceTriangles(scene,assets){
 let triangles=assets[scene.origin].triangles+(scene.moodboard?assets[scene.moodboard.asset].triangles:0);
 for(const item of placedObjects(scene))if(item.asset)triangles+=assets[item.asset].triangles*(item.behavior?.type==='flock'?item.behavior.count:1);
 return triangles;
}
