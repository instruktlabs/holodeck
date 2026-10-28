import * as THREE from 'three/webgpu';
import {rules} from './range-session.mjs';

export const consoleFrame=Object.freeze({width:.466,height:.331,textureWidth:1024,textureHeight:728,
 center:[.1554221517,1.3273941410,-.31],normal:[-.9396926208,.3420201433,0],right:[0,0,1],up:[.3420201433,.9396926208,0],offset:.0008});
export const consoleIds=['booth-console','booth-paper','booth-plates'];

export function drawConsole(ctx,view){
 const W=1024,H=728;ctx.clearRect(0,0,W,H);ctx.fillStyle='#101b20';ctx.fillRect(0,0,W,H);
 const text=(value,x,y,size=25,color='#edf3ef')=>{ctx.font=`${size>=30?'600 ':''}${size}px sans-serif`;ctx.fillStyle=color;ctx.fillText(value,x,y);};
 text('RANGE REVIEW',32,49,30,'#84d2c9');text(`${view.archived?'ARCHIVE':'CURRENT'}  /  ${view.lane.toUpperCase()}  /  STRING ${view.stringId}`,32,89,23);
 ctx.fillStyle='#33484d';ctx.fillRect(32,108,960,2);
 const st=view.stats,g=st.group;
 text(String(st.points).padStart(2,'0'),650,185,68);text('POINTS',790,181,22,'#a3b8bb');
 text(`${st.hits} / ${st.shots} HITS`,650,239,30);
 text(`${st.misses} miss  /  ${st.blocked} blocked`,650,282,23,'#a3b8bb');
 text(`${st.nonScoring} non-scoring`,650,316,23,'#a3b8bb');
 const x=32,y=136,w=580,h=480;ctx.fillStyle='#dad9cd';ctx.fillRect(x,y,w,h);
 const scale=430/Math.max(rules[view.lane]?.width??.8,rules[view.lane]?.height??.8),point=local=>[x+w/2+local[0]*scale,y+h/2-local[1]*scale];
 ctx.strokeStyle='#68726e';ctx.lineWidth=2;
 if(view.lane!=='plates'){const spec=rules[view.lane],center=point(spec.center);for(const r of spec.radii){ctx.beginPath();ctx.arc(...center,r*scale,0,Math.PI*2);ctx.stroke();}}
 else for(let i=0;i<5;i++){ctx.fillStyle='#b2bab5';ctx.beginPath();ctx.arc(x+62+i*114,y+h/2,38,0,Math.PI*2);ctx.fill();ctx.stroke();text(String(i+1),x+54+i*114,y+h/2+74,25,'#253334');}
 view.rows.forEach((shot,i)=>{if(shot.outcome!=='hit'||!shot.impact)return;const p=view.lane==='plates'?[x+62+(shot.impact.plate??0)*114,y+h/2]:point(shot.impact.local);ctx.fillStyle='#ac462f';ctx.beginPath();ctx.arc(...p,7,0,Math.PI*2);ctx.fill();text(String(i+1),p[0]+10,p[1]-9,23,'#253334');});
 if(g.centroid){const p=point(g.centroid);ctx.strokeStyle='#087c86';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p[0]-12,p[1]);ctx.lineTo(p[0]+12,p[1]);ctx.moveTo(p[0],p[1]-12);ctx.lineTo(p[0],p[1]+12);ctx.stroke();}
 text(view.lane==='plates'?'PLATES DOWN':'GROUP SPREAD',650,377,21,'#84d2c9');
 text(view.lane==='plates'?`${view.plateHits} / 5`:g.count>=2?`${(g.spread*100).toFixed(2)} cm`:'--',650,421,34);
 text('RMS',650,466,21,'#a3b8bb');text(g.count>=2?`${(g.rms*100).toFixed(2)} cm`:'--',650,502,28);
 text('CENTROID (cm)',650,548,21,'#a3b8bb');text(g.centroid?`${(g.centroid[0]*100).toFixed(2)}, ${(g.centroid[1]*100).toFixed(2)}`:'--',650,582,25);
 text(`${view.archived?'SAVED GROUP':view.phase.toUpperCase()}  |  SHEET ${view.sheetId}`,32,659,24,'#84d2c9');
 text('Numbered impacts / cyan centroid / game distances',32,698,21,'#a3b8bb');
}

export function bindRangeConsoles(scene,createCanvas=()=>document.createElement('canvas'),placements=[]){
 const screens=[],frames=[];for(const id of consoleIds){let screen=null;scene.traverse(n=>{if(!screen&&n.userData?.target===id)screen=n.getObjectByName('Mesh_Body_screen')??null;});const placement=placements.find(p=>p.id===id&&p.asset==='booth-console');if(!screen&&!placement)return null;frames.push({screen,placement});}
 const canvas=createCanvas();canvas.width=consoleFrame.textureWidth;canvas.height=consoleFrame.textureHeight;const ctx=canvas.getContext('2d');if(!ctx)return null;
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-1});
 const geometry=new THREE.PlaneGeometry(consoleFrame.width,consoleFrame.height),overlays=[];
 const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(...consoleFrame.right),new THREE.Vector3(...consoleFrame.up),new THREE.Vector3(...consoleFrame.normal));
 const proxies=[];for(const {screen,placement}of frames){let parent=screen;if(!parent){parent=new THREE.Group();parent.name='RangeScreenFrame_'+placement.id;parent.position.fromArray(placement.position);parent.rotation.set(...placement.rotation);parent.scale.fromArray(placement.scale);scene.add(parent);proxies.push(parent);}screens.push(parent);const mesh=new THREE.Mesh(geometry,material);mesh.name='RangeReviewDisplay';mesh.userData.rangeConsole=true;mesh.position.fromArray(consoleFrame.center).addScaledVector(new THREE.Vector3(...consoleFrame.normal),consoleFrame.offset);mesh.quaternion.setFromRotationMatrix(basis);parent.add(mesh);overlays.push(mesh);}
 let stamp='',disposed=false,updates=0;
 return {screens,overlays,texture,get updates(){return updates;},update(view){if(disposed||stamp===view.key)return;drawConsole(ctx,view);texture.needsUpdate=true;stamp=view.key;updates++;},dispose(){if(disposed)return;disposed=true;overlays.forEach(m=>m.removeFromParent());proxies.forEach(m=>m.removeFromParent());geometry.dispose();material.dispose();texture.dispose();}};
}
