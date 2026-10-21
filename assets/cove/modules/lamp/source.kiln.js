const meta={name:'Cove / low ember lamp',role:'prop'};
async function build(){
 const root=createRoot('EmberLamp');
 const clay=new THREE.MeshStandardMaterial({color:0xa88b6a,roughness:.9});
 const glow=new THREE.MeshStandardMaterial({color:0xf6d7a2,emissive:0xe7a767,emissiveIntensity:1.1,roughness:.7});
 createPart('LampBase',new THREE.CylinderGeometry(.24,.28,.10,32),clay,{parent:root,position:[0,.05,0]});
 createPart('LightStone',new THREE.SphereGeometry(1,32,24),glow,{parent:root,position:[0,.37,0],scale:[.20,.29,.19]});
 return root;
}
