import pistolUrl from '../authoring/first-pistol-v6.glb?url';
import pistolHandsUrl from '../authoring/first-hands-v7.glb?url';
import rifleUrl from '../authoring/rifle-1866-v3.glb?url';
import rifleHandsUrl from '../authoring/rifle-hands-v2.glb?url';
import rifleTokenUrl from '../authoring/rifle-loading-token-v1.glb?url';
import boltUrl from '../authoring/bolt-no4-v2.glb?url';
import boltHandsUrl from '../authoring/bolt-no4-hands-v2.glb?url';
import boltChargerUrl from '../authoring/bolt-no4-charger-v1.glb?url';
import pistolPins from './pistol-asset-pins-v2.json';
import riflePins from './rifle-asset-pins-v3.json';
import pistolMotion from './animation-v3.json';
import rifleMotion from './rifle-motion-v2.json';
import pistolRig from './arm-rig-v6.json';
import pistolView from './pistol-view-v2.json';
import rifleRig from './rifle-arm-rig-v2.json';
import rifleView from './rifle-view-v2.json';
import boltPins from './bolt-no4-asset-pins-v2.json';
import boltMotion from './bolt-no4-motion-v1.json';
import boltRig from './bolt-no4-arm-rig-v2.json';
import boltView from './bolt-no4-view-v2.json';
import carbineUrl from '../authoring/carbine-m4-v3.glb?url';
import carbineHandsUrl from '../authoring/carbine-m4-hands-v1.glb?url';
import carbinePins from './carbine-m4-asset-pins-v1.json';
import carbineMotion from './carbine-m4-motion-v1.json';
import carbineRig from './carbine-m4-arm-rig-v1.json';
import carbineView from './carbine-m4-view-v1.json';

export const browserProfiles={
 pistol:{id:'pistol',title:'1911-style pistol',gunUrl:pistolUrl,handsUrl:pistolHandsUrl,pins:{gun:pistolPins.assets.pistol,hands:pistolPins.assets.hands},motion:pistolMotion,rig:pistolRig,view:pistolView},
 rifle1866:{id:'rifle1866',title:'1866 sporting rifle',gunUrl:rifleUrl,handsUrl:rifleHandsUrl,tokenUrl:rifleTokenUrl,pins:riflePins.assets,motion:rifleMotion,rig:rifleRig,view:rifleView},
 boltNo4:{id:'boltNo4',title:'No.4 Mk I* bolt rifle',gunUrl:boltUrl,handsUrl:boltHandsUrl,tokenUrl:boltChargerUrl,pins:boltPins.assets,motion:boltMotion,rig:boltRig,view:boltView},
 carbineM4:{id:'carbineM4',title:'Colt M4 carbine (R0977)',gunUrl:carbineUrl,handsUrl:carbineHandsUrl,pins:carbinePins.assets,motion:carbineMotion,rig:carbineRig,view:carbineView}
};
export function browserProfile(id){const p=browserProfiles[id];if(!p)throw Error('Unsupported weapon profile: '+id);return p;}
