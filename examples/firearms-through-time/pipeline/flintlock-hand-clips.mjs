// Pattern 1742 musket clips (round v14): Ready, Fired, Fire, Inspect and the condensed ten-second loading drill.
// Key states are authored with pipeline/flintlock-hand-drill.mjs (camera-space root poses, gun-frame hand poses,
// contact and cue placements, virtual-shoulder steering). Owner drill order and commit phase are fixed; times are guides.
// Transitions near the musket get via keys (hands leave a grip outward before travelling, contacts on the cock comb and
// the frizzen follow their arcs, the rammer leaves the muzzle along the bore line before it turns), checked at 60 Hz by
// pipeline/flintlock-hand-motion.mjs.
import * as D from './flintlock-hand-design.mjs';
import * as P from './flintlock-hand-pose.mjs';
import {R0,I3,rootR,camOf,gunOf,rotM,frameXY,cueOf,byCue,byContact,handQcam,ramRel,cartRel,loadPose,steer,digitPt,fingerQ,
 handSamples,place,clearance,stateSurfaces,nelderMead,PAN,MUZZLE,RAMROD,combTarget,frizzenTarget,channelsOf,armAt,bendDir,inView} from './flintlock-hand-drill.mjs';
const {add,sub,mul,dot,cross,len,unit}=D,deg=Math.PI/180,M=P.matMul,T=P.matT,MV=P.matV;

// Root poses (camera space). Priming: lock and pan toward the camera, muzzle up and forward. Loading: muzzle up in front
// of the left shoulder (leaning toward the right shoulder), ramrod side to the left, left hand on the upper fore-end.
export const POSES={prime:{pan:[.06,-.20,-.40],eulerDeg:[30,10,60]},load:{muzzle:[-.04,-.15,-.40],X:[.22,.95,.12],psi:-90}};
export const NOMINAL={right:[.20,-.24,0],left:[-.19,-.28,-.10]};
// Extra clearance points for a cue held in the right hand (cartridge), for contact searches.
const cartPts=(cr,W,Q)=>{const c=cueOf(cr,W,Q),out=[];for(let x=-.042;x<=.0281;x+=.007)out.push({p:add(c.O,MV(c.R,[x,0,0])),r:.0075,part:'cartridge'});return out;};
// Contact placement: hand point pBind (bind frame) on target; rotation searched near Q0 against penetration and the arm.
// targets: [{target,surf,state}] scored together with one rotation (arcs: the hand rides a moving part).
export function contactSearch(ctx,side,pose,ch,pBind,target,surf,state,Q0,nominal,{span=1,margin=.0015,extra=null,targets=null}={}){
 const h=ctx.H[side],samp=handSamples(ctx,side,fingerQ(ctx,side,ch)).filter((_,i)=>i%2===0);
 const make=rv=>{const a=len(rv),Q=a<1e-9?Q0:M(rotM(rv,a),Q0);return byContact(h,Q,pBind,target);};
 const all=targets??[{target,surf,state}],cost=rv=>{const hp=make(rv),s=steer(ctx,side,pose,hp.W,hp.Q,nominal);let pen=0;for(const tg of all){const Q=hp.Q,W=sub(tg.target,MV(Q,sub(pBind,h.Wb))),pts=samp.map(s=>({...s,p:place(h,W,Q,s.p)})).concat(extra?extra(W,Q):[]),c=clearance(ctx,pts,tg.surf,tg.state);pen+=1e5*Math.max(0,margin-c.gap)**2;}return s.cost+pen+.5*(len(rv)/span)**2;};
 let best=null;for(const rv0 of [[0,0,0],[.6,0,0],[-.6,0,0],[0,.6,0],[0,-.6,0],[0,0,.6],[0,0,-.6]]){const r=nelderMead(cost,rv0,.25,120);if(!best||r.f<best.f)best=r;}
 return {...make(best.x),cost:best.f};}
const shoulderOf=(ctx,pose,side)=>camOf(pose,ctx.rig.arms[side].shoulder);
// Hand moved by a camera-space offset at a root pose (gun-frame result), orientation kept.
const camMove=(pose,h,dc)=>({W:add(h.W,MV(T(pose.R),dc)),Q:h.Q});
// Rotation path about a fixed hand point G (bind point pG) from QA to QB: both senses; returns sub-step states.
function turnPath(ctx,G,pG,QA,QB,steps,score){const h=ctx.H.right,at=Q=>({W:sub(G,MV(Q,sub(pG,h.Wb))),Q}),Rt=M(QB,T(QA)),qt=P.matToQuat(Rt),n=Math.hypot(qt[0],qt[1],qt[2]);
 const axis0=n<1e-9?[1,0,0]:unit([qt[0],qt[1],qt[2]]),ang0=2*Math.atan2(n,qt[3]);let best=null;
 for(const sgn of [1,-1]){const ax=mul(axis0,sgn),ang=sgn>0?ang0:2*Math.PI-ang0,st=Array.from({length:steps},(_,i)=>at(M(rotM(ax,ang*(i+1)/steps),QA))),s=score(st,at(QA));if(!best||s.score<best.score)best={...s,steps:st,ang,ax};}
 return best;}
// Twist sequence (steered) and its largest step, for path choices.
const twists=(ctx,pose,states,nom)=>states.map(h=>steer(ctx,'right',pose,h.W,h.Q,nom).arm.twist);
const maxStep=tw=>Math.max(0,...tw.slice(1).map((v,i)=>Math.abs(v-tw[i])));

export async function buildClips(ctx,{log=()=>{}}={}){
 const H=ctx.H,READY={pos:ctx.hip,R:R0},shReady={right:shoulderOf(ctx,READY,'right'),left:shoulderOf(ctx,READY,'left')};
 const RB={W:H.right.Wb,Q:I3},LB={W:H.left.Wb,Q:I3},LG={W:ctx.design.loadGripLeft.W,Q:ctx.design.loadGripLeft.Q};
 const Rp=rootR(POSES.prime.eulerDeg.map(v=>v*deg)),PRIME={pos:sub(POSES.prime.pan,MV(Rp,PAN)),R:Rp},LOAD=loadPose(POSES.load.muzzle,POSES.load.X,POSES.load.psi);
 const hold=ctx.design.holds,CART={rightOpen:hold.cartridge.rightOpen,rightThumb:hold.cartridge.rightThumb},FIST={rightOpen:-1,rightThumb:1},OPEN={rightOpen:.25,rightThumb:.3},TURN_OPEN={rightOpen:.7,rightThumb:-.3};
 const s01=await stateSurfaces(ctx,0,1),s51=await stateSurfaces(ctx,.5,1),s50=await stateSurfaces(ctx,.5,0);await stateSurfaces(ctx,1,0);
 // Palmar normals (gun frame) of the left grips: the hand leaves and approaches each grip along it.
 const nL=Q=>MV(Q,ctx.H.left.F.n),leftAway=(G,d)=>({W:sub(G.W,mul(nL(G.Q),d)),Q:G.Q});
 // Thumb on the cock comb: priming position (fired -> half cock) and at the shoulder (half -> full cock); the hand
 // follows the comb's arc with an intermediate key.
 const TH={rightOpen:.2,rightThumb:-.5,rightIndex:0},thumbPad=digitPt(H.right,fingerQ(ctx,'right',TH),4,.85);
 const s251=await stateSurfaces(ctx,.25,1),s750=await stateSurfaces(ctx,.75,0),s10=await stateSurfaces(ctx,1,0);
 const cockP=contactSearch(ctx,'right',PRIME,TH,thumbPad,combTarget(0),s01,{cock:0,frizzen:1},I3,NOMINAL.right,{targets:[[0,s01],[.25,s251],[.5,s51]].map(([c,sf])=>({target:combTarget(c),surf:sf,state:{cock:c,frizzen:1}}))}),cockAt=(c,Q)=>byContact(H.right,Q,thumbPad,combTarget(c));
 const cockR=contactSearch(ctx,'right',READY,TH,thumbPad,combTarget(.5),s50,{cock:.5,frizzen:0},I3,shReady.right,{targets:[[.5,s50],[.75,s750],[1,s10]].map(([c,sf])=>({target:combTarget(c),surf:sf,state:{cock:c,frizzen:0}}))});
 log('cock contacts',{prime:cockP.cost,ready:cockR.cost});
 // Pouch behind the right hip.
 const pouch={W:gunOf(PRIME,[.30,-.70,.10]),Q:handQcam(ctx,'right',PRIME,[.05,-1,.25],[-1,0,.1])},pouchIn={W:gunOf(PRIME,[.30,-.74,.11]),Q:pouch.Q},pastButt={W:gunOf(PRIME,[.38,-.48,-.02]),Q:pouch.Q};
 // Cartridge (powder end = cue origin - 0.042 along the cue X).
 const cr=cartRel(ctx);
 const cueCam=(pose,endCam,XCam,phi,yh=[0,0,1])=>{const Xg=unit(MV(T(pose.R),XCam)),Yg=MV(T(pose.R),yh),Rc=frameXY(Xg,MV(rotM(Xg,phi),Yg));return byCue(cr,add(gunOf(pose,endCam),mul(Xg,.042)),Rc);};
 const cueGun=(endG,Xg,phi,yh=[0,0,1])=>{Xg=unit(Xg);const Rc=frameXY(Xg,MV(rotM(Xg,phi),yh));return byCue(cr,add(endG,mul(Xg,.042)),Rc);};
 const roll=(pose,make,nom,extra=()=>0)=>{let best=null;for(let k=0;k<24;k++){const phi=k*15*deg,h=make(phi),s=steer(ctx,'right',pose,h.W,h.Q,nom,{gun:true}),c=s.cost+extra(h,s);if(!best||c<best.c)best={phi,h,s,c};}return best;};
 const mouth=roll(PRIME,phi=>cueCam(PRIME,[0,-.075,-.07],[.15,-.85,-.5],phi),NOMINAL.right).h;
 // Pour at the pan: the cartridge's own clearance to the lock is scored with the hand's.
 const pourClear=h=>{const c=clearance(ctx,handSamples(ctx,'right',fingerQ(ctx,'right',CART)).filter((_,i)=>i%2===0).map(s=>({...s,p:place(H.right,h.W,h.Q,s.p)})).concat(cartPts(cr,h.W,h.Q)),s51,{cock:.5,frizzen:1});return 1e5*Math.max(0,.002-c.gap)**2;};
 const panX=[-.25,.75,.6],pour=roll(PRIME,phi=>cueGun(add(PAN,[0,.012,.004]),panX,phi),NOMINAL.right,h=>pourClear(h)),pourPhi=pour.phi;
 const pourA=pour.h,pourB=cueGun(add(PAN,[0,.010,.004]),MV(rotM([0,0,1],-8*deg),panX),pourPhi);
 // Shut the pan: the index middle phalanx (cartridge fist) on the frizzen top, carried closed along the frizzen's arc.
 const s505=await stateSurfaces(ctx,.5,.5),fz=digitPt(H.right,fingerQ(ctx,'right',CART),0,.55),friz=contactSearch(ctx,'right',PRIME,CART,fz,frizzenTarget(1),s51,{cock:.5,frizzen:1},pour.h.Q,NOMINAL.right,{span:1.5,margin:.0025,extra:(W,Q)=>cartPts(cr,W,Q),targets:[[1,s51],[.5,s505],[0,s50]].map(([f,sf])=>({target:frizzenTarget(f),surf:sf,state:{cock:.5,frizzen:f}}))}),frizAt=f=>byContact(H.right,friz.Q,fz,frizzenTarget(f));
 log('frizzen contact',friz.cost);
 const twShut=steer(ctx,'right',PRIME,frizAt(0).W,frizAt(0).Q,NOMINAL.right).arm.twist;
 // Charge: powder end poured over the muzzle with the cartridge tilted (tilt, azimuth and roll searched; the forearm twist
 // stays near the shut-pan twist so the cast about turns the forearm the short way), then the cartridge goes in at the
 // muzzle face (its visibility drops after the charge key).
 let over=null;for(const tilt of [0,15,30,45])for(let az=0;az<360;az+=45){if(tilt===0&&az>0)continue;const Xg=[Math.cos(tilt*deg),Math.sin(tilt*deg)*Math.cos(az*deg),Math.sin(tilt*deg)*Math.sin(az*deg)];
  const b=roll(LOAD,phi=>cueGun(add(MUZZLE,[.025,0,0]),Xg,phi,[0,1,0]),NOMINAL.right,(h,s)=>((s.arm.twist-twShut)/50)**2);if(!over||b.c<over.c)over={...b,Xg,tilt,az};}
 const charge=cueGun(add(MUZZLE,[.003,0,0]),over.Xg,over.phi,[0,1,0]),castR={W:add(over.h.W,[.06,0,-.02]),Q:over.h.Q};
 log('over the muzzle',{tilt:over.tilt,az:over.az,phi:over.phi/deg,cost:over.c,twist:over.s.arm.twist,twShut});
 // Ramrod. Drawn with the head out of the thumb side of the fist (relA, thumb up); at full draw the hand turns over on the
 // rod and holds it with the head out of the little-finger side (relB, the cue relation), so that after the rammer is
 // turned end over end the ram is made thumb up. Grips: g1 behind the head, g2 for the second pull, the swap and the ram.
 const g1=-.03,g2=.42,dPull=.526,O=d=>add(RAMROD.origin,[d,0,0]),onRod=(rel,d)=>byCue(rel,O(d),I3);
 const sRod=d=>({cock:.5,frizzen:0,draw:d,ramrodVisible:false});
 const fistPts=h=>handSamples(ctx,'right',fingerQ(ctx,'right',FIST)).filter((_,i)=>i%2===0).map(s=>({...s,p:place(H.right,h.W,h.Q,s.p)}));
 // Each draw grip's roll is chosen for both positions it is used at (g1: grasp behind the head and the end of the first
 // pull; g2: the second pull from the slide-down to full draw), scored with the arm (gun proxy) and the fist's clearance to
 // the barrel and stock (the rod itself is held); the hand regrips (opens and slides) between them.
 const rollFor=(g,ds)=>{let best=null;for(let k=0;k<24;k++){const phi=k*15*deg;let c=0;for(const d of ds){const h=onRod(ramRel(ctx,g,phi,false),d),s=steer(ctx,'right',LOAD,h.W,h.Q,NOMINAL.right,{gun:true}),cl=clearance(ctx,fistPts(h),s50,sRod(d));c+=s.cost+1e5*Math.max(0,.002-cl.gap)**2;}if(!best||c<best.c)best={phi,c};}return best.phi;};
 const phiA1=rollFor(g1,[0,dPull]),phiA=rollFor(g2,[dPull,RAMROD.draw]),relA2=ramRel(ctx,g2,phiA,false),relA1=ramRel(ctx,g1,phiA1,false);
 // Ram: cue axis down the bore (-X), head end D below the muzzle face; roll about the bore searched.
 const relB0=ramRel(ctx,g2,0,true);let ramPsi=null;for(let k=0;k<24;k++){const ps=k*15*deg,Rc=frameXY([-1,0,0],[0,Math.cos(ps),Math.sin(ps)]);let c=0;for(const Dp of [0,.33]){const h=byCue(relB0,add(MUZZLE,[-Dp,0,0]),Rc);c+=steer(ctx,'right',LOAD,h.W,h.Q,NOMINAL.right,{gun:true}).cost;}if(!ramPsi||c<ramPsi.c)ramPsi={ps,c,Rc};}
 // The ram pose does not depend on the hand roll chosen for the swap (the roll about the bore absorbs it), so the ram is
 // solved with roll 0 first; the swap roll is then chosen for the arm at full draw and a forearm twist near the ram's.
 const hRam15=byCue(relB0,add(MUZZLE,[-.15,0,0]),ramPsi.Rc),ramTwist=steer(ctx,'right',LOAD,hRam15.W,hRam15.Q,NOMINAL.right).arm.twist;
 let phiB=null;for(let k=0;k<24;k++){const phi=k*15*deg,h=onRod(ramRel(ctx,g2,phi,true),RAMROD.draw),st=steer(ctx,'right',LOAD,h.W,h.Q,NOMINAL.right,{gun:true}),c=st.cost+((st.arm.twist-ramTwist)/45)**2;if(!phiB||c<phiB.c)phiB={phi,c,tw:st.arm.twist};}
 const relB=ramRel(ctx,g2,phiB.phi,true),swapA=onRod(relA2,RAMROD.draw),swap=onRod(relB,RAMROD.draw);
 // Same ram pose expressed with relB: cue roll about the bore re-solved so that the hand matches.
 const hRam0=byCue(relB0,MUZZLE,ramPsi.Rc),RcB=M(hRam0.Q,relB.R),ram=Dp=>byCue(relB,add(MUZZLE,[-Dp,0,0]),RcB),Qram=ram(0).Q;
 const gripB=ctx.design.cues.ramrod.rodCentre,atGrip=(G,Q)=>({W:sub(G,MV(Q,sub(gripB,H.right.Wb))),Q}),gripOf=h=>add(h.W,MV(h.Q,sub(gripB,H.right.Wb)));
 // Turn the hand over on the rod at full draw (relA2 -> relB about the grip point), the sense with the continuous twist.
 const G2=gripOf(swapA),turnOver=turnPath(ctx,G2,gripB,swapA.Q,swap.Q,3,(st,s0)=>{const tw=twists(ctx,LOAD,[s0,...st],NOMINAL.right);return {score:maxStep(tw)+(Math.max(...tw.map(Math.abs))>150?1e3:0),tw};});
 log('turn over',{deg:turnOver.ang/deg,twist:turnOver.tw.map(v=>+v.toFixed(0))});
 // Leave the muzzle along the rod line (the tail is still beside the muzzle at full draw), then turn end over end about
 // the grip: both senses tried, chosen for the rod's clearance to the musket and the camera and a continuous twist.
 const Gflip=add(gripOf(swap),[.11,0,0]),lift=atGrip(Gflip,swap.Q);
 const rodPts=h=>{const c=cueOf(relB,h.W,h.Q),out=[];for(let s=0;s<=RAMROD.length+1e-9;s+=.02)out.push({p:add(c.O,MV(c.R,[-s,0,0])),r:s<.025?.0044:.0026,part:'rammer cue'});return out;};
 const flip=turnPath(ctx,Gflip,gripB,swap.Q,Qram,6,(st,s0)=>{let camMin=Infinity,gap=Infinity;for(const h of [s0,...st]){for(const q of rodPts(h))camMin=Math.min(camMin,len(camOf(LOAD,q.p)));gap=Math.min(gap,clearance(ctx,rodPts(h),s50,sRod(RAMROD.draw),{skip:['Ramrod']}).gap);}
  const tw=twists(ctx,LOAD,[s0,...st],NOMINAL.right);return {score:(camMin<.3?(.3-camMin)*100:0)+(gap<.003?(.003-gap)*1e4:0)+maxStep(tw)/30,camMin,gap,tw};});
 log('rammer',{phiA1:phiA1/deg,phiA:phiA/deg,phiB:phiB.phi/deg,swapTwist:phiB.tw,ramTwist,ramPsi:ramPsi.ps/deg,turnDeg:flip.ang/deg,camMin:flip.camMin,rodGap:flip.gap,twist:flip.tw.map(v=>+v.toFixed(0)),ramCost:ramPsi.c});
 // Fist on the rammer head (the rod at rest; the head is the only free part) and its approach from below and the right.
 const grasp=onRod(relA1,0),graspAway=d=>({W:add(grasp.W,mul([0,-.8,.6],d)),Q:grasp.Q});
 const out={};
 const base={pose:READY,right:RB,left:LB,ch:{open:0,thumb:0,rightIndex:0,rightOpen:0,rightThumb:0,cock:1,frizzen:0,ramrod:0,ramrodCue:0,cartridge:0},fixed:true};
 const tl=start=>{const keys=[];let cur=start;return {keys,K:(t,phase,mod={})=>{cur={...cur,...mod,ch:{...cur.ch,...(mod.ch??{})}};keys.push({t,phase,st:cur});}};};
 {const a=tl(base);a.K(0,'ready');a.K(1,'ready');out.Ready={duration:1,loop:true,keys:a.keys};}
 const fired={...base,ch:{...base.ch,cock:0,frizzen:1}};
 {const a=tl(fired);a.K(0,'fired');a.K(1,'fired');out.Fired={duration:1,loop:true,keys:a.keys};}
 // Fire: trigger at 0; cock down by 15 ms; frizzen open 15-30 ms; the game fires at 60 ms; absorb; end at Fired.
 {const a=tl(base),rp=(pitch,forward,lift)=>({pose:{pos:add(ctx.hip,[0,lift,-forward]),R:rootR([pitch,0,0])}});
  a.K(0,'ready');a.K(.025,'cock falls',{ch:{rightIndex:1,cock:0}});a.K(.05,'pan flash',{ch:{frizzen:1}});a.K(.10,'shot');
  a.K(.22,'absorb',rp(.045,-.03,.01));a.K(.45,'settle',{...rp(.012,-.008,.002),ch:{rightIndex:.5}});a.K(1,'fired',{pose:READY,ch:{rightIndex:0}});out.Fire={duration:.6,loop:false,keys:a.keys};}
 // Inspect: lock side toward the camera, then the side-plate side; shoulders steered to stay put.
 {const a=tl({...base,nom:shReady}),rp=(e,lift)=>({pose:{pos:add(ctx.hip,[0,lift,0]),R:rootR(e)},fixed:false});
  a.K(0,'ready');a.K(.22,'lock view',rp([.06,.32,.42],.05));a.K(.42,'lock hold',rp([.06,.32,.42],.05));a.K(.64,'side plate view',rp([.03,-.25,-.38],.05));a.K(.78,'side plate hold',rp([.03,-.25,-.38],.05));a.K(1,'ready',{pose:READY,fixed:true});
  out.Inspect={duration:3.6,loop:false,keys:a.keys};}
 // Reload: fired -> ready.
 {const a=tl({...fired,nom:NOMINAL}),K=a.K,dr=RAMROD.draw;
  // Intermediate root poses for the large turns (shoulders are steered at them too).
  const qs=(A,B,f)=>P.quatToMat(P.qSlerp(P.matToQuat(A),P.matToQuat(B),f)),midPose=(A,B,f)=>({pos:add(mul(A.pos,1-f),mul(B.pos,f)),R:qs(A.R,B.R,f)}),midHand=(A,B,f,dG=[0,0,0])=>({W:add(add(mul(A.W,1-f),mul(B.W,f)),dG),Q:qs(A.Q,B.Q,f)});
  const HAND_OPEN={rightOpen:1,rightThumb:-.5},offStock=camMove(READY,RB,[.06,.015,0]),lift0=camMove(PRIME,cockAt(.5,cockP.Q),[0,.03,.03]),clearStock=camMove(PRIME,lift0,[.10,-.06,.08]);
  const fromPan=camMove(PRIME,pourB,[0,.05,.04]),aboveFriz={W:add(frizAt(1).W,[0,.045,.015]),Q:friz.Q},liftAway=camMove(PRIME,frizAt(0),[.06,.07,.06]);
  const CAST=midPose(PRIME,LOAD,.5),castMidR=midHand(liftAway,castR,.5,[0,.06,.10]),castMidL=midHand(leftAway(LB,.05),leftAway(LG,.05),.5);
  const releaseR=add(grasp.W,[0,-.035,.03]),clearBarrel=camMove(LOAD,{W:releaseR,Q:grasp.Q},[.12,-.04,.04]),RECOVER=midPose(LOAD,READY,.5);
  const aboveCock=camMove(READY,cockR,[.02,.07,0]),recMidR=midHand(clearBarrel,aboveCock,.5,[0,.04,.12]),recMidL=midHand(leftAway(LG,.05),leftAway(LB,.05),.5);
  K(0,'fired');
  K(.006,'open the hand',{right:RB,ch:HAND_OPEN});
  K(.014,'release grip',{right:offStock});
  K(.04,'priming position',{pose:PRIME,right:cockP,fixed:false,ch:{...TH}});
  K(.06,'half-cock',{right:cockAt(.25,cockP.Q),ch:{cock:.25}});
  K(.08,'half-cock',{right:cockAt(.5,cockP.Q),ch:{cock:.5}});
  K(.095,'off the cock',{right:lift0,ch:{rightOpen:.4,rightThumb:0}});
  K(.107,'clear the stock',{right:clearStock,ch:{rightOpen:.6,rightThumb:-.3}});
  K(.117,'past the butt',{right:pastButt});
  K(.13,'to the pouch',{right:pouch});
  K(.15,'in the pouch',{right:pouchIn,ch:{rightOpen:.4}});
  K(.18,'take cartridge',{right:pouch,ch:{...CART,cartridge:1}});
  K(.195,'past the butt',{right:pastButt});
  K(.23,'bite',{right:mouth});
  K(.25,'tear',{right:{W:add(mouth.W,MV(T(PRIME.R),[.03,-.03,-.02])),Q:mouth.Q}});
  K(.28,'prime',{right:pourA});
  K(.297,'pour',{right:pourB});
  K(.302,'from the pan',{right:fromPan});
  K(.306,'over the frizzen',{right:aboveFriz});
  K(.31,'to the frizzen',{right:frizAt(1)});
  K(.315,'shut pan',{right:frizAt(.75),ch:{frizzen:.75}});
  K(.32,'shut pan',{right:frizAt(.5),ch:{frizzen:.5}});
  K(.325,'shut pan',{right:frizAt(.25),ch:{frizzen:.25}});
  K(.33,'shut pan',{right:frizAt(0),ch:{frizzen:0}});
  K(.334,'release support',{ch:{open:1}});
  K(.339,'lift away',{right:liftAway,left:leftAway(LB,.05)});
  K(.347,'cast about',{pose:CAST,right:castMidR,left:castMidL});
  K(.356,'cast about',{pose:LOAD,right:castR,left:leftAway(LG,.05)});
  K(.366,'to the loading grip',{left:LG});
  K(.38,'loading position',{ch:{open:-.96}});
  K(.41,'over the muzzle',{right:over.h});
  K(.44,'charge',{right:charge});
  K(.445,'cartridge in',{ch:{cartridge:0}});
  K(.455,'reach rammer',{right:{W:releaseR,Q:grasp.Q},ch:{rightOpen:.3,rightThumb:0}});
  K(.465,'grasp rammer',{right:grasp,ch:{...FIST,ramrod:0}});
  K(.485,'draw rammer',{right:onRod(relA1,dPull),ch:{ramrod:dPull/dr}});
  K(.49,'open',{ch:OPEN});
  K(.497,'slide down',{right:onRod(relA2,dPull)});
  K(.502,'regrip',{ch:{...FIST}});
  K(.518,'full draw',{right:swapA,ch:{ramrod:1}});
  K(.521,'open',{ch:TURN_OPEN});
  turnOver.steps.forEach((h,i)=>K(+(.523+i*.0025).toFixed(4),'turn the hand',{right:h}));
  K(.532,'regrip',{ch:{...FIST}});
  K(.535,'swap to rammer cue',{ch:{ramrodCue:1}});
  K(.545,'clear the muzzle',{right:lift});
  flip.steps.forEach((h,i)=>K(+(.5508+i*.00584).toFixed(4),i===5?'turn rammer':'turning',{right:h}));
  K(.59,'over the muzzle',{right:ram(-.03)});
  K(.60,'enter the muzzle',{right:ram(0)});
  K(.68,'ram down',{right:ram(.22)});
  K(.75,'rammed (commit)',{right:ram(.33)});
  K(.775,'withdraw',{right:ram(0)});
  K(.785,'clear the muzzle',{right:ram(-.03)});
  K(.79,'lift',{right:flip.steps[5]});
  [4,3,2,1,0].forEach((i,j)=>K(+(.7967+j*.0067).toFixed(4),'turning back',{right:flip.steps[i]}));
  K(.83,'turned',{right:lift});
  K(.84,'return rammer',{right:swap});
  K(.845,'swap to ramrod',{ch:{ramrodCue:0}});
  K(.849,'open',{ch:TURN_OPEN});
  [1,0].forEach((i,j)=>K(+(.851+j*.0025).toFixed(4),'turn the hand',{right:turnOver.steps[i]}));
  K(.856,'turn the hand',{right:swapA});
  K(.86,'regrip',{ch:{...FIST}});
  K(.875,'return rammer',{right:onRod(relA2,dPull),ch:{ramrod:dPull/dr}});
  K(.879,'open',{ch:OPEN});
  K(.886,'slide up',{right:onRod(relA1,dPull)});
  K(.89,'regrip',{ch:{...FIST}});
  K(.905,'rammer home',{right:grasp,ch:{ramrod:0}});
  K(.909,'release',{ch:{rightOpen:.5,rightThumb:-.2}});
  K(.914,'release',{right:{W:releaseR,Q:grasp.Q}});
  K(.92,'clear of the barrel',{right:clearBarrel,ch:{open:1}});
  K(.925,'release the fore-end',{left:leftAway(LG,.05)});
  K(.932,'recover',{pose:RECOVER,right:recMidR,left:recMidL});
  K(.94,'recover',{pose:READY,right:aboveCock,left:leftAway(LB,.05),ch:{...TH}});
  K(.947,'thumb on the cock',{right:cockR});
  K(.951,'support',{left:LB});
  K(.956,'support',{ch:{open:0}});
  K(.962,'full cock',{right:cockAt(.75,cockR.Q),ch:{cock:.75}});
  K(.968,'full cock',{right:cockAt(1,cockR.Q),ch:{cock:1}});
  K(.974,'off the cock',{right:camMove(READY,cockAt(1,cockR.Q),[.03,.03,0]),ch:{rightOpen:.6,rightThumb:-.3}});
  K(.981,'to the grip',{right:offStock,ch:HAND_OPEN});
  K(.988,'at the grip',{right:RB});
  K(.996,'grip',{right:RB,ch:{rightOpen:0,rightThumb:0},fixed:true});
  K(1,'ready');
  out.Reload={duration:10,loop:false,commitPhase:.75,keys:a.keys};}
 return {clips:out,poses:{READY,PRIME,LOAD},grips:{RB,LB,LG},parts:{relA1,relA2,relB,phiA1,phiA,phiB:phiB.phi,ramPsi:ramPsi.ps,cartRel:cr,flip,turnOver,swap,swapA,Qram,g1,g2,dPull,pourPhi,over},shReady};}

// Shoulders per key (fixed keys keep the rig shoulders; others are steered with the gun proxy, nominal blended with the
// previous key's shoulder for continuity), then channel values and shoulder-shift values.
export function finalizeClips(ctx,built){const out={};
 for(const [name,clip]of Object.entries(built.clips)){let prevSh={...built.shReady},prevE=null;const keys=[],shift=[],diag=[];
  for(const k of clip.keys){const st=k.st,sh={};
   for(const side of ['right','left']){if(st.fixed){sh[side]=built.shReady[side];continue;}
    const nomBase=st.pose===built.poses.READY?built.shReady[side]:(st.nom?.[side]??NOMINAL[side]),nom=add(mul(nomBase,.5),mul(prevSh[side],.5));
    sh[side]=steer(ctx,side,st.pose,st[side].W,st[side].Q,nom,{gun:true}).Sc;}
   prevSh=sh;const c=channelsOf(ctx,{...st,shoulders:sh},prevE);prevE=c.euler;keys.push({t:k.t,phase:k.phase,v:c.v});shift.push({t:k.t,v:c.shift});
   const d={t:k.t,phase:k.phase};for(const side of ['right','left']){const Sv=gunOf(st.pose,sh[side]),a=armAt(ctx,side,Sv,st[side].W,st[side].Q),Ec=camOf(st.pose,a.elbow),Wc=camOf(st.pose,st[side].W);
    d[side]={reach:+a.reach.toFixed(3),bend:+a.bend.toFixed(1),twist:+a.twist.toFixed(0),S:sh[side].map(v=>+v.toFixed(3)),E:Ec.map(v=>+v.toFixed(3)),W:Wc.map(v=>+v.toFixed(3)),bd:bendDir(sh[side],Ec,Wc).map(v=>+v.toFixed(2)),shoulderInView:inView(sh[side],.05)};}
   diag.push(d);}
  out[name]={duration:clip.duration,loop:clip.loop,...(clip.commitPhase!==undefined?{commitPhase:clip.commitPhase}:{}),keys,shift,diag};}
 return out;}
