import {If,Loop,cameraPosition,color,dot,exp,float,floor,frameId,mix,screenCoordinate,select,smoothstep,step,vec2,vec3} from 'three/tsl';
import {AERIAL_DEFAULTS,KOSCHMIEDER,aerialWeights,resolveAerial} from './aerial.mjs';

// cloudSea.model 'cumulus' (H125, plateau plan step 3; see sky.mjs). The 'billows' deck draws
// gradient-noise fbm, which reads as dunes or terrain, shades it by slope alone, and hazes
// it into fogColor along a downward-slope ramp, so the deck a kilometre out is mostly haze.
// Here the deck is a union of rounded lobes at three scales, lit through its own depth
// toward the sun, its gaps open onto a darker, bluer layer below, and the air above it is
// clear: distance haze per channel instead of the slope ramp.

// Three hashes in [0, 1) per cell (Dave Hoskins' sine-free hash).
const cellHash=cell=>{const h=vec3(cell.x,cell.y,cell.x.add(cell.y.mul(1.7))).mul(vec3(.1031,.103,.0973)).fract().toVar();h.addAssign(dot(h,h.yzx.add(33.33)));return h.xxy.add(h.yzz).mul(h.zyx).fract();};
// The smooth maximum of two fields [height, d/dx, d/dy] (polynomial, k wide in height): lobes
// that meet merge through a rounded valley, not a crease, and the gradient is the same blend.
const smax=(a,b,k)=>{const m=a.x.sub(b.x).div(k).mul(.5).add(.5).clamp(0,1);return vec3(mix(b.x,a.x,m).add(m.mul(m.oneMinus()).mul(k)),mix(b.yz,a.yz,m));};
// Each lobe is a sphere sunk to SUNK of its radius, so its flanks meet the layer below at
// about 65° rather than straight down.
const SUNK=.4;
// The lobes over p (in cell units), merged smoothly: [height 0..1, d/dx, d/dy]. Each cell holds
// one, its centre within [.25, .75] of the cell and its radius at most .75, so only the 2×2
// block of cells nearest p can reach it. sparse < 1 keeps that share of the cells. The first
// union lifts empty ground by k/4, which is taken off again so ground between lobes stays at 0.
function lobeField(p,k,sparse=1){
  const base=floor(p).add(step(.5,p.fract())).sub(1);let field=vec3(0);
  for(let j=0;j<2;j++)for(let i=0;i<2;i++){
    const cell=base.add(vec2(i,j)),h=cellHash(cell),radius=h.z.mul(.3).add(.45),top=h.x.add(h.z).mul(17.17).fract().mul(.5).add(.5).div(1-SUNK);
    const v=p.sub(cell.add(h.xy.mul(.5).add(.25))).div(radius),s=float(1).sub(dot(v,v)).max(0).sqrt();
    let height=s.sub(SUNK).max(0).mul(top),slope=v.mul(top).div(s.max(SUNK).mul(radius)).negate().mul(step(SUNK,s));
    if(sparse<1){const keep=step(h.x,sparse);height=height.mul(keep);slope=slope.mul(keep);}
    field=smax(field,vec3(height,slope),k);
  }
  const lifted=field.x.sub(k*.25);
  return vec3(lifted.max(0),field.yz.mul(step(0,lifted)));
}
// Each scale's cells are turned against the others', so no grid lines up across scales.
const turn=(p,a)=>{const c=Math.cos(a),s=Math.sin(a);return vec2(p.x.mul(c).sub(p.y.mul(s)),p.x.mul(s).add(p.y.mul(c)));};
// lobeField at p turned by a and divided by scale, with its gradient back in p's frame.
const lobesAt=(p,scale,a,k,sparse)=>{const f=lobeField(turn(p,a).div(scale),k,sparse);return vec3(f.x,turn(f.yz,-a).div(scale));};
const CUMULUS_STEPS=12,CUMULUS_RELIEF=1.2,MASS=9,MASS_EDGE=.35,FINE=.32,TOWER=5;
// The deck height in relief units at q (billow units) with its gradient: masses a few hundred
// metres across set where cloud stands (coverage keeps that share of them) and taper at their
// edges; billows give their rounded tops, as tall as they are wide, so their sides turn from
// the sun and shade each other; with detail, finer cauliflower lobes; and a few towers rise
// out of the deck, merged into it over a short blend.
function deckField(q,coverage,towers,detail){
  const mass=lobesAt(q,MASS,.6,.3,coverage),t=mass.x.div(MASS_EDGE).clamp(0,1),m=t.mul(t).mul(t.mul(-2).add(3));
  const dm=mass.yz.mul(t.mul(t.oneMinus()).mul(6/MASS_EDGE)),billow=lobesAt(q,1,0,.35);
  let body=billow.x.mul(.65).add(.35),dbody=billow.yz.mul(.65);
  if(detail){const fine=lobesAt(q,FINE,2.2,.3);body=body.add(fine.x.mul(.05));dbody=dbody.add(fine.yz.mul(.05));}
  let field=vec3(m.mul(body),dm.mul(body).add(dbody.mul(m)));
  if(towers>0)field=smax(field,lobesAt(q,TOWER,1.1,.2,.1).mul(towers*4),.12);
  return {h:field.x,dh:field.yz};
}
// The deck's mean top, in relief units, where grazing rays far out meet it.
const MEAN_TOP=.6;
// Interleaved gradient noise, a fresh pattern each frame, for the march's start offset.
const frameNoise=()=>{const p=screenCoordinate.xy.add(float(frameId).mod(64).mul(5.588238));return dot(p,vec2(.06711056,.00583715)).fract().mul(52.9829189).fract();};

export function cumulusDeckNode({sea,sky,environment,direction,cosine,clock,sun,cloudLight}){
  const size=85*sea.scale,relief=CUMULUS_RELIEF*size,coverage=sea.coverage,towers=sea.towers??0,top=relief*Math.max(1.2,towers*4);
  const down=direction.y.negate(),slope=down.max(.002),above=cameraPosition.y.sub(sea.height).max(.5);
  const drift=vec2(clock.mul(sea.drift[0]),clock.mul(sea.drift[1]));
  const unit=t=>cameraPosition.xz.add(direction.xz.mul(t)).add(drift).div(size);
  // Far out the ray meets the deck's tops, not its floor.
  const reach=above.sub(MEAN_TOP*relief).max(.5).div(slope).min(80000),q=unit(reach),detail=smoothstep(.45,.05,q.fwidth().length());
  const zenith=color(sky.zenithColor),horizon=color(sky.horizonColor),sunDir=vec3(sun.x,sun.y,sun.z),view=direction.negate();
  // Shade by height: the floor and the gaps sit in a darker, bluer layer, crowns take the sky.
  const under=mix(zenith,horizon,.3).mul(.3),skyLight=mix(zenith,horizon,.55).mul(.4),light=Math.min(1,Math.max(.25,sun.y*1.5));
  // Extinction per metre of cloud between a point and the sun; contrast 0.5 lets about 25 m
  // of cloud take the sun down to a third.
  const sigma=.04*(sea.contrast??.5)*2,g=.6,lobe=float(.12*(1-g*g)).div(float(1+g*g).sub(cosine.mul(2*g)).pow(1.5));
  // Light at a point of the deck (metres) with height h and gradient dh. The sun reaches it
  // through the domes on four steps toward the sun (Beer's law), and light scattered more than
  // once through less (a second, weaker octave), so shaded sides stay luminous; a wrapped
  // diffuse term turns sides from the sun softly; flanks seen edge-on against the sun glow
  // (the silver lining); and ambient light grows from the blue layer below to the crowns.
  // resolved is how much of the lobes a pixel sees: 1 in the relief near the camera, and far
  // out, where lobes are smaller than a pixel, the detail left, so shadowing fades to its mean.
  const shade=(point,h,dh,resolved)=>{
    const normal=vec3(dh.x.mul(-relief/size),1,dh.y.mul(-relief/size)).normalize();
    let path=float(0);
    for(const [d,w] of [[.35,.35],[.9,.55],[1.8,.9],[3.2,1.4]]){
      const at=point.xz.add(vec2(sun.x,sun.z).mul(d*size)).add(drift).div(size),rise=point.y.add(sun.y*d*size);
      path=path.add(smoothstep(0,6,deckField(at,coverage,towers,false).h.mul(relief).add(sea.height).sub(rise)).mul(w*size));
    }
    path=mix(float(.08*size),path,resolved);
    const sunlit=exp(path.mul(-sigma)),scattered=sunlit.mul(.65).add(exp(path.mul(-sigma*.25)).mul(.2));
    const facing=dot(normal,sunDir),wrap=facing.add(.6).div(1.6).clamp(0,1);
    const rim=float(1).sub(dot(normal,view).abs()).pow(3).mul(lobe).mul(sunlit).mul(1.5);
    const ambient=mix(under,skyLight,h.div(1.2).clamp(0,1).sqrt());
    return ambient.add(cloudLight.mul(scattered.mul(wrap).add(sunlit.mul(lobe)).add(rim).mul(light)));
  };
  // The far deck, at its tops; the relief near the camera takes its place below, and the
  // pixel is shaded once, from whichever it shows (a blend of both across the hand-over).
  const flat=deckField(q,coverage,towers,true),farH=mix(float(MEAN_TOP),flat.h,detail);
  const point=vec3(cameraPosition.x.add(direction.x.mul(reach)),farH.mul(relief).add(sea.height),cameraPosition.z.add(direction.z.mul(reach))).toVar();
  const height=farH.toVar(),gradient=flat.dh.mul(detail).toVar(),resolved=detail.toVar(),distance=reach.toVar();
  // Relief near the camera: march the ray down through the lobe layer, jittered per frame,
  // then refine the crossing twice by the secant.
  const t0=cameraPosition.y.sub(sea.height+top).div(slope).max(0);
  If(t0.lessThan(size*15),()=>{
    const t1=above.div(slope).min(t0.add(size*15)),start=frameNoise();
    const gap=t=>cameraPosition.y.sub(slope.mul(t)).sub(deckField(unit(t),coverage,towers,false).h.mul(relief).add(sea.height));
    const hit=t1.toVar(),found=float(0).toVar(),lastT=t0.toVar(),lastGap=gap(t0).toVar();
    Loop(CUMULUS_STEPS,({i})=>{
      If(found.equal(0),()=>{
        const t=mix(t0,t1,float(i).add(start).div(CUMULUS_STEPS)),now=gap(t);
        If(now.lessThan(0),()=>{
          const a=lastT.toVar(),b=t.toVar(),ga=lastGap.toVar(),gb=now.toVar();
          for(let k=0;k<2;k++){const m=a.add(b.sub(a).mul(ga.div(ga.sub(gb).max(1e-4)))),gm=gap(m);If(gm.lessThan(0),()=>{b.assign(m);gb.assign(gm);}).Else(()=>{a.assign(m);ga.assign(gm);});}
          hit.assign(a.add(b.sub(a).mul(ga.div(ga.sub(gb).max(1e-4)))));found.assign(1);
        });
        lastT.assign(t);lastGap.assign(now);
      });
    });
    If(found.equal(0).and(above.div(slope).lessThanEqual(t0.add(size*15))),()=>{hit.assign(t1);found.assign(1);});
    const field=deckField(unit(hit),coverage,towers,true),near=vec3(cameraPosition.x.add(direction.x.mul(hit)),cameraPosition.y.sub(slope.mul(hit)),cameraPosition.z.add(direction.z.mul(hit)));
    const weight=found.mul(smoothstep(size*15,size*6,hit));
    point.assign(mix(point,near,weight));height.assign(mix(height,field.h,weight));gradient.assign(mix(gradient,field.dh,weight));
    resolved.assign(mix(resolved,float(1),weight));distance.assign(mix(distance,hit,weight));
  });
  const deck=shade(point,height,gradient,resolved);
  // Clear air over the deck: per-channel distance haze toward the horizon colour, from
  // environment.aerial when set, else a 40 km visibility thinning above the deck.
  const air=resolveAerial(environment)??{...AERIAL_DEFAULTS,visibility:40000,base:sea.height,falloff:1000};
  const k=distance.mul(direction.y).div(air.falloff).clamp(-60,60),mean=select(k.abs().lessThan(1e-3),float(1).sub(k.mul(.5)),float(1).sub(exp(k.negate())).div(k));
  const transmittance=exp(vec3(...aerialWeights(air.blue)).mul(distance.mul(KOSCHMIEDER/air.visibility).mul(exp(cameraPosition.y.sub(air.base).div(-air.falloff))).mul(mean)).negate());
  const hazed=deck.mul(transmittance).add(horizon.mul(transmittance.oneMinus()));
  // Only a thin band at the horizon blends into it; from under the deck there is only haze.
  const visible=smoothstep(0,.004+(sea.haze??.3)*.05,down).mul(step(sea.height,cameraPosition.y));
  return mix(horizon,hazed,visible);
}
