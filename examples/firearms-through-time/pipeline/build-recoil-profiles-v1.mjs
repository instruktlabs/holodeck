// Build game/recoil-profiles-v1.json (docs/recoil-v1.md). Physical inputs are Estimates from the cited service loads and only size each
// gun's kick against the others; the hold gains, patterns, variation and recovery are gameplay tuning. Run with --check to verify only.
import {readFile,writeFile} from 'node:fs/promises';
const ID='recoil-profiles-v1',GR=.06479891,FPS=.3048,round=(v,n=6)=>Number(v.toFixed(n));
const field=(revision,value,units,provenanceClass,{refs=[],scope,uncertainty=null,reason=null,note}={})=>({value,units,provenanceClass,referenceIds:refs,configurationScope:scope,uncertainty,tuningReason:reason,approvedBy:null,revision,...note&&{note}});
const references={
 'm1911-wikipedia':{title:'M1911 pistol (Wikipedia infobox)',url:'https://en.wikipedia.org/wiki/M1911_pistol',supports:'39 oz (1,100 g) empty, with magazine'},
 'sierra-45acp':{title:'Sierra .45 Auto (ACP) load data',url:'https://sierrabullets.com/content/load-data/handgun/451/45-auto-(ACP).pdf',supports:'230 gr FMJ at about 810–850 ft/s from about 5 gr of powder'},
 'henry-44-wikipedia':{title:'.44 Henry (Wikipedia)',url:'https://en.wikipedia.org/wiki/.44_Henry',supports:'200 gr bullet at about 1,125 ft/s over 26–28 gr of black powder'},
 'winchester-rifle-wikipedia':{title:'Winchester rifle (Wikipedia infobox)',url:'https://en.wikipedia.org/wiki/Winchester_rifle',supports:'9.5 lb (4.3 kg) for the rifle family; not specific to the Model 1866'},
 'winchester-1866-listing':{title:'Winchester Model 1866 retail listing (weak: modern reproduction, search snippet)',url:'https://gun.deals/catalog/209936/winchester-model-1866',supports:'7–8 lb for a modern reproduction'},
 '303-canadiansoldiers':{title:'.303 British ammunition (canadiansoldiers.com)',url:'https://www.canadiansoldiers.com/weapons/ammunition/303.htm',supports:'Mark VII 174 gr bullet at 2,440 ft/s'},
 '303-ssusa':{title:'Last cartridge of an empire: .303 British (SSUSA)',url:'https://ssusa.org/content/last-cartridge-of-an-empire-303-british',supports:'Mark VII ball and its cordite charge'},
 '303-rmr-museum':{title:'.303 bullets (Royal Montreal Regiment Museum)',url:'https://hub.catalogit.app/royal-montreal-regiment-museum/folder/entry/.303-bullets',supports:'about 37 gr of cordite in Mark VII ball'},
 'no4-mccord':{title:'Lee-Enfield No. 4 Mk I (McCord Stewart Museum)',url:'https://collections.musee-mccord-stewart.ca/en/objects/details/431071',supports:'4.1 kg'},
 'm4-wikipedia':{title:'M4 carbine (Wikipedia infobox)',url:'https://en.wikipedia.org/wiki/M4_carbine',supports:'6.43 lb (2.92 kg) empty; 7.75 lb (3.52 kg) with a loaded 30-round magazine and sling; 2,887 ft/s (880 m/s) with M855; 700–970 rounds/min cyclic'},
 '556-wikipedia':{title:'5.56×45mm NATO (Wikipedia)',url:'https://en.wikipedia.org/wiki/5.56%C3%9745mm_NATO',supports:'M855 4.02 g (62 gr); case capacity 1.85 cm3 (28.5 gr H2O); V4 bullet velocity 866 m/s at 360 mm and 878 m/s at 390 mm barrels'},
 'brown-bess-wikipedia':{title:'Brown Bess (Wikipedia)',url:'https://en.wikipedia.org/wiki/Brown_Bess',supports:'ball 1.3 oz (37 g, derived); powder 8.9–10.7 g, of which 0.65 g primed the pan; the common 1,500 ft/s figure rests on incorrectly executed tests; 3.95–4.59 kg across the family'},
 'historyofwar-brown-bess':{title:'Brown Bess (historyofwar.org, P. Antill 2006)',url:'https://www.historyofwar.org/articles/weapons_brown_bess.html',supports:'one ounce lead ball; .71 in projectile in a .75 in bore'},
 'revwar-brown-bess':{title:'Brown Bess (Revolutionary War Journal; weak: search snippet)',url:'https://revolutionarywarjournal.com/brown-bess-2/',supports:'a smooth-bore ball leaves at about 1,000 ft/s on average'},
};
const holds={
 'two-hand-pistol':{gain:.72,reason:'A handgun pivots at the wrists with no shoulder behind it, so it turns the aim more per joule than a shouldered rifle.'},
 shoulder:{gain:.52,reason:'Shouldered long gun: the stock and the shooter\'s mass absorb more of the impulse.'},
};
// Pattern rows are [pitch, yaw] multiples of the base kick for consecutive shots of a string; past the last row the last row repeats.
const guns={
 pistol:{configuration:'1911-style pistol, virtual .45 ACP 230 gr ball profile',hold:'two-hand-pistol',
  bullet:[230,'gr',['sierra-45acp'],0],velocity:[830,'ft/s',['sierra-45acp'],20],charge:[5,'gr',['sierra-45acp'],.8],mass:[1.10,'kg',['m1911-wikipedia'],.05],
  pattern:[[1,.10],[1.06,.16],[1.10,.05],[1.12,-.10],[1.14,-.16],[1.15,-.04],[1.16,.12]],
  shape:'Climbs and drifts right, swings left mid-magazine, then back right.',recovery:.12,rise:.02,residual:.12,resetAfter:.6,cycle:.22},
 rifle1866:{configuration:'1866 sporting-form lever rifle, virtual .44 Henry 200 gr black-powder profile',hold:'shoulder',
  bullet:[200,'gr',['henry-44-wikipedia'],0],velocity:[1125,'ft/s',['henry-44-wikipedia'],50],charge:[27,'gr',['henry-44-wikipedia'],1],mass:[4.0,'kg',['winchester-rifle-wikipedia','winchester-1866-listing'],.5],
  pattern:[[1,.08],[1.05,.18],[1.08,.26],[1.10,.14],[1.12,-.04],[1.12,-.14]],
  shape:'A gentle climb that walks right as the lever is worked, then eases back left.',recovery:.2,rise:.03,residual:.25,resetAfter:1.6,cycle:.95},
 boltNo4:{configuration:'Lee-Enfield No.4 Mk I* bolt rifle, virtual .303 Mk VII 174 gr cordite profile',hold:'shoulder',
  bullet:[174,'gr',['303-canadiansoldiers'],0],velocity:[2440,'ft/s',['303-canadiansoldiers','303-ssusa'],40],charge:[37,'gr',['303-rmr-museum','303-ssusa'],2],mass:[4.1,'kg',['no4-mccord'],.1],
  pattern:[[1,.12],[1.04,.20],[1.08,.24],[1.10,.16],[1.12,.04],[1.13,-.08],[1.14,-.16],[1.14,-.20],[1.15,-.10],[1.15,.04]],
  shape:'The stoutest kick of the cartridge rifles: climbs up and right through the first charger, then back left through the second.',recovery:.24,rise:.035,residual:.2,resetAfter:2,cycle:1.25},
 // Round v14 (docs/m4-1742-v14.md). A fifth tuple entry is a note on the figure's basis.
 carbineM4:{configuration:'Colt M4 carbine (R0977), virtual 5.56x45mm M855 62 gr profile from the 14.5 in barrel',hold:'shoulder',
  bullet:[62,'gr',['556-wikipedia'],1,'M855, 4.02 g; a Belgian listing gives 61 gr'],velocity:[2887,'ft/s',['m4-wikipedia','556-wikipedia'],40,'M855 from the M4; the V4 barrel table interpolates to about 869 m/s at 368 mm'],
  charge:[26,'gr',['556-wikipedia'],2,'Estimated fill of the 28.5 gr H2O case capacity; no published M855 charge mass was found'],mass:[3.4,'kg',['m4-wikipedia'],.12,'Between 2.92 kg empty and 3.52 kg with a loaded magazine and sling; the game gun carries a loaded magazine and no sling'],
  pattern:[[.80,.04],[.84,.08],[.88,.12],[.91,.16],[.93,.19],[.95,.21],[.95,.21],[.95,.17],[.94,.10],[.93,0],[.92,-.10],[.91,-.19],[.90,-.26],[.90,-.30],[.90,-.31],
   [.90,-.29],[.90,-.23],[.90,-.14],[.90,-.03],[.90,.08],[.90,.17],[.90,.24],[.90,.28],[.90,.28],[.90,.24],[.90,.17],[.90,.08],[.90,-.03],[.90,-.12],[.90,-.18]],
  shape:'Bursts climb and drift right through the first ten rounds, swing left mid-magazine, then come back right. Rows below 1 stand for the straight-line stock, which lifts the muzzle less per joule than the dropped-stock rifles.',recovery:.12,rise:.02,residual:.22,resetAfter:.5,cycle:.075},
 flintlock1742:{configuration:'Pattern 1742 Land Service musket, virtual .75 bore paper-cartridge round-ball load',hold:'shoulder',
  bullet:[505,'gr',['brown-bess-wikipedia','historyofwar-brown-bess'],68,'Midpoint of one ounce and 1.3 oz (32.7 g); a pure-lead .71 in ball weighs about 34.8 g'],velocity:[1000,'ft/s',['revwar-brown-bess','brown-bess-wikipedia'],150,'Smooth-bore ball; weak source, and Wikipedia rejects the common 1,500 ft/s'],
  charge:[141,'gr',['brown-bess-wikipedia'],15,'Main charge: 8.9–10.7 g in the cartridge less 0.65 g primed into the pan (midpoint 9.15 g)'],mass:[4.6,'kg',['brown-bess-wikipedia'],.2,'Top of the family range (3.95–4.59 kg); the Long Land is the longest pattern'],
  pattern:[[1,.14]],
  shape:'One heavy shot per load: a big climb with a kick to the right.',recovery:.3,rise:.04,residual:.3,resetAfter:3,cycle:10.6},
};
const GAS=[1.5,.25],VARIATION={pitchScale:.06,yawScale:.05};
const profiles={};
for(const [id,g] of Object.entries(guns)){
 const revision=`${ID}:${id}:1`,est=(v,units,refs,unc,note)=>field(revision,v,units,'estimated',{refs,scope:g.configuration,uncertainty:unc,note}),tune=(v,units,reason,unc=null)=>field(revision,v,units,'gameplay-tuned',{scope:g.configuration,reason,uncertainty:unc});
 const bullet=g.bullet[0]*GR/1000,velocity=g.velocity[0]*FPS,charge=g.charge[0]*GR/1000,mass=g.mass[0],impulse=bullet*velocity+charge*GAS[0]*velocity,speed=impulse/mass,energy=mass*speed**2/2,hold=holds[g.hold],base=hold.gain*Math.sqrt(energy);
 profiles[id]={revision,configuration:g.configuration,
  physics:{
   projectileMass:est(round(bullet*1000,4),'g',g.bullet[2],g.bullet[3],`${g.bullet[0]} gr${g.bullet[4]?'; '+g.bullet[4]:''}`),
   muzzleVelocity:est(round(velocity,2),'m/s',g.velocity[2],round(g.velocity[3]*FPS,1),`${g.velocity[0]} ft/s${g.velocity[4]?'; '+g.velocity[4]:''}`),
   chargeMass:est(round(charge*1000,4),'g',g.charge[2],round(g.charge[3]*GR,3),`${g.charge[0]} gr${g.charge[4]?'; '+g.charge[4]:''}`),
   gasVelocityFactor:field(revision,GAS[0],'x muzzle velocity','estimated',{scope:g.configuration,uncertainty:GAS[1],note:'Engineering rule of thumb for the propellant gas leaving the muzzle; no measured source.'}),
   gunMass:est(mass,'kg',g.mass[2],g.mass[3],g.mass[4]),
   impulse:field(revision,round(impulse,5),'N*s','estimated',{scope:g.configuration,note:'projectile mass x velocity + charge mass x gas factor x velocity'}),
   recoilVelocity:field(revision,round(speed,5),'m/s','estimated',{scope:g.configuration,note:'impulse / gun mass'}),
   freeRecoilEnergy:field(revision,round(energy,5),'J','estimated',{scope:g.configuration,note:'gun mass x recoil velocity^2 / 2'}),
  },
  response:{
   hold:g.hold,
   holdGain:tune(hold.gain,'deg/sqrt(J)',hold.reason),
   baseKick:tune(round(base,6),'deg','Hold gain x sqrt(free recoil energy): sized from the cartridge and the gun\'s mass.'),
   pattern:tune(g.pattern,'[pitch, yaw] x base kick',`Learnable string for consecutive shots (explicit gameplay choice, not a historical spray). ${g.shape}`),
   variation:{pitchScale:tune(VARIATION.pitchScale,'fraction of row pitch','Slight seeded scatter, bounded to +/- this fraction.'),yawScale:tune(VARIATION.yawScale,'x base kick','Slight seeded sideways scatter, bounded to +/- this much.')},
   recovery:tune(g.recovery,'s','Time constant for the recoverable part of each kick to return.'),
   rise:tune(g.rise,'s','Time constant for the aim to rise into each kick, so the view never snaps.'),
   residual:tune(g.residual,'fraction of kick','Share of each kick that stays: the player pulls it back with the mouse.'),
   resetAfter:tune(g.resetAfter,'s',`A shot this long after the previous one starts the pattern again (the action allows one shot per ${g.cycle} s).`),
  },
 };
}
const out={schemaVersion:1,id:ID,scope:'Entertainment game model. The physical inputs are Estimates from cited public figures for each service load; they size the guns\' kicks relative to each other. Hold gains, patterns, variation and recovery are gameplay tuning, not measured, calibrated or historical recoil.',
 units:{angle:'deg (pitch up and yaw right are positive)',time:'s',mass:'g or kg as labelled',impulse:'N*s',energy:'J'},
 model:{
  resolution:'A shot travels along the aim at the moment the trigger is accepted; its kick applies after it.',
  kick:'pitch = baseKick x row[0] x (1 + pitchScale x a); yaw = baseKick x (row[1] + yawScale x b); a and b are uniform in [-1, 1) from the shot\'s seed',
  aim:'Each kick adds (1 - residual) x kick to the recovering part and the rest to where the aim settles. The aim rises into the kick with the rise time constant while the recovering part decays with the recovery time constant; the host turns its look by the change.',
  pattern:'Consecutive shots step through the rows; a shot resetAfter or more after the previous one, or the first shot, uses row 0.',
  seed:{hash:'FNV-1a 32-bit over UTF-8',prng:'mulberry32',sessionSeed:'fnv1a32(sessionId) as an unsigned decimal',key:'<sessionSeed>|<shotId>|<profile revision>|<channel>',channel:'weapon-response',draws:['a (pitch scale)','b (yaw offset)']},
 },
 references,profiles};
const file='game/recoil-profiles-v1.json',text=JSON.stringify(out,null,1)+'\n',current=await readFile(file,'utf8').catch(()=>null);
if(current!==text){if(process.argv.includes('--check'))throw Error(file+' is stale');await writeFile(file,text);}
for(const [id,p] of Object.entries(profiles))console.log(id,`impulse ${p.physics.impulse.value} N*s, recoil ${p.physics.recoilVelocity.value} m/s, ${p.physics.freeRecoilEnergy.value} J, base kick ${p.response.baseKick.value} deg`);
