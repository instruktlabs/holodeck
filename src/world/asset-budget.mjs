export const MAX_PLACEMENTS=1200;
export const MAX_PLACED_TRIANGLES=2000000;
export function placedSourceTriangles(scene,assets){
 let triangles=assets[scene.origin].triangles+(scene.moodboard?assets[scene.moodboard.asset].triangles:0);
 for(const item of scene.objects)if(item.asset)triangles+=assets[item.asset].triangles*(item.behavior?.type==='flock'?item.behavior.count:1);
 return triangles;
}
