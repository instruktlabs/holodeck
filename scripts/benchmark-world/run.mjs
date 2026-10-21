import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {hostname,release} from 'node:os';
import {execFileSync} from 'node:child_process';
import {verifyExport,validateScenarios,summarize,assertHardware,assertObservation,sha256} from './benchmark-core.mjs';
import {hostSample,ownedPids,interval,admission,reserve} from './host-guard.mjs';
const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1]||args[i+1].startsWith('--')||options[args[i].slice(2)])throw Error('Use unique --name value arguments');options[args[i].slice(2)]=args[i+1];}
for(const name of ['export','manifest-sha256','revision','scenarios','out','chrome','vendor','reservation','playwright-module'])if(!options[name])throw Error(`Required --${name}`);
const allowed=['export','manifest-sha256','revision','scenarios','out','chrome','vendor','reservation','playwright-module','backend'];if(Object.keys(options).some(k=>!allowed.includes(k)))throw Error('Unknown option');
if(!process.env.DISPLAY||process.env.DISPLAY.startsWith(':99'))throw Error('An explicitly selected real headed display is required');
const backends=options.backend==='both'||!options.backend?['webgpu','webgl']:[options.backend];if(backends.some(b=>!['webgpu','webgl'].includes(b)))throw Error('Invalid backend');
const artifact=await verifyExport(options.export,options['manifest-sha256']);if(artifact.revision!==Number(options.revision))throw Error('Expected accepted revision mismatch');
const scenarioBytes=await readFile(options.scenarios),scenarios=validateScenarios(JSON.parse(scenarioBytes)),out=path.resolve(options.out);await mkdir(out);
const save=(file,value)=>writeFile(path.join(out,file),JSON.stringify(value,null,2)+'\n');
const releaseReservation=reserve(options.reservation),runs=[];let server,context,monitor,deadline,interrupted=false,previous,snapshots=[],guardErrors=[],admitted;
const close=async()=>{clearInterval(monitor);clearTimeout(deadline);await context?.close().catch(()=>{});context=null;if(server?.listening)await new Promise(r=>server.close(r));};
const stop=()=>{interrupted=true;context?.close().catch(()=>{});};process.on('SIGTERM',stop);process.on('SIGINT',stop);
try{
 admitted=await admission();await save('admission-before.json',admitted);if(!admitted.passed)throw Error('Quiet admission failed: '+admitted.reasons.join('; '));
 const display=execFileSync('xrandr',['--current'],{encoding:'utf8',timeout:5000});await writeFile(path.join(out,'display.txt'),display);if(!/\bconnected\b[^\n]*1920x1080/.test(display))throw Error('Actual connected 1920x1080 display evidence required');
 deadline=setTimeout(stop,950000);
 const desktop=admitted.samples[1].processes.filter(p=>['kwin_wayland','Xwayland'].includes(p.name));
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.woff2':'font/woff2'};
 server=http.createServer((req,res)=>{try{const parsed=new URL(req.url,'http://localhost');const file=decodeURIComponent(parsed.pathname).replace(/^\//,'')||'index.html';if(req.method==='GET'&&file==='favicon.ico'&&!artifact.files.has(file)){res.writeHead(204).end();return;}if(req.method!=='GET'||!artifact.files.has(file)){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(artifact.files.get(file));}catch{res.writeHead(400).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const {chromium}=await import(pathToFileURL(path.resolve(options['playwright-module'])).href);if(!chromium)throw Error('The selected module must export Playwright chromium');
 const flags=['--ozone-platform=x11','--enable-features=Vulkan','--start-fullscreen','--no-first-run','--no-default-browser-check','--disable-extensions'];
 const poll=()=>{try{const next=hostSample(),owned=ownedPids(next),ignored=new Set(owned);for(const d of desktop)if(next.processes.some(p=>p.pid===d.pid&&p.start===d.start))ignored.add(d.pid);const delta=interval(previous,next,ignored);snapshots.push({snapshot:next,activity:delta});previous=next;if(delta.foreignBusyCores>.5)guardErrors.push(`Unrelated CPU ${delta.foreignBusyCores.toFixed(3)} cores`);if(!Number.isFinite(next.temp)||next.temp>=85||!Number.isFinite(next.availableMemory)||next.availableMemory<2e9)guardErrors.push('Temperature or memory telemetry unavailable or limit exceeded');}catch(e){guardErrors.push(String(e));}};
 for(const backend of backends)for(const scenario of scenarios){
  if(interrupted)throw Error('Interrupted or total deadline exceeded');
  const id=`${backend}-${scenario.id}`,profile=path.join(out,`profile-${id}`),errors=[],consoleWarnings=[];snapshots=[];guardErrors=[];
  let errorCount=0;const recordError=value=>{errorCount++;if(errors.length<200)errors.push(String(value).slice(0,2048));};
  previous=hostSample();monitor=setInterval(poll,5000);
  const launchStarted=performance.now();
  context=await chromium.launchPersistentContext(profile,{executablePath:options.chrome,headless:false,args:flags,viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block',timeout:30000});
  if(interrupted)throw Error('Interrupted while browser launch was pending');
  const browserLaunchMs=performance.now()-launchStarted,browserVersion=context.browser()?.version()??'unavailable';
  await context.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(origin+'/')){recordError('External request blocked: '+new URL(url).origin);return route.abort();}return route.continue();});
  const page=context.pages()[0]??await context.newPage();page.on('pageerror',recordError);page.on('console',message=>{if(message.type()==='error')recordError(message.text());else if(message.type()==='warning'&&consoleWarnings.length<100)consoleWarnings.push(message.text().slice(0,2048));});
  await page.addInitScript(value=>{window.holodeckBenchmarkScenario=value;},scenario);
  const started=performance.now();await page.goto(`${origin}/?benchmark=1${backend==='webgl'?'&backend=webgl':''}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.holodeckBenchmark?.status().ready,{},{timeout:60000});
  const coldReadyMs=performance.now()-started;
  const initial=await page.evaluate(()=>window.holodeckBenchmark.status());await save(`${id}-startup.json`,{initial,browserVersion,browserLaunchMs,coldReadyMs,errors,consoleWarnings});if(initial.protocol!=='holodeck-benchmark-v1'||initial.revision!==artifact.revision||initial.scenario?.id!==scenario.id)throw Error('Viewer protocol/revision/scenario mismatch');assertHardware(initial.proof,backend,options.vendor);
  assertObservation(initial,scenario);
  await page.waitForTimeout(10000);
  let measured;try{measured=await page.evaluate(()=>window.holodeckBenchmark.sample(60000));}finally{clearInterval(monitor);poll();}
  const final=await page.evaluate(()=>window.holodeckBenchmark.status());assertHardware(final.proof,backend,options.vendor);assertObservation(final,scenario);assertObservation(measured,scenario);
  await page.screenshot({path:path.join(out,`${id}.png`)});
  const navigation=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(x=>x.toJSON()),resources:performance.getEntriesByType('resource').map(x=>({name:new URL(x.name).pathname,duration:x.duration,transferSize:x.transferSize,encodedBodySize:x.encodedBodySize})),heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null}));
  const report={id,backend,scenario,browserVersion,browserLaunchMs,coldReadyMs,initial,final,navigation,measured,summary:Object.fromEntries(['intervalMs','cpuFrameSpanMs','drawCalls','triangles'].map(k=>[k,summarize(measured.rows.map(r=>r[k]))])),overBudget:{over16_7:measured.rows.filter(r=>r.intervalMs>16.7).length,over33_4:measured.rows.filter(r=>r.intervalMs>33.4).length},host:snapshots,guardErrors,errors,errorCount,consoleWarnings};
  await save(`${id}.json`,report);runs.push({id,coldReadyMs,summary:report.summary,errors,guardErrors});
  await context.close();context=null;
  // Only this freshly created browser profile is removed; reports and captures remain.
  if(path.dirname(profile)!==out||!path.basename(profile).startsWith('profile-'))throw Error('Unsafe owned profile path');await rm(profile,{recursive:true,force:true});
  if(errors.length||measured.errors.length||guardErrors.length)throw Error(`Run ${id} rejected; raw evidence retained`);
 }
 await save('summary.json',{format:'holodeck-performance-v1',revision:artifact.revision,manifestSha256:artifact.manifestSha256,scenarioSha256:sha256(scenarioBytes),host:hostname(),kernel:release(),display:process.env.DISPLAY,flags,resolution:[1920,1080],dpr:1,runs,limits:['Cold means a fresh browser profile; OS, driver and localhost file buffers may be warm.','Fixed views with active scene behavior; no input traversal, multiple clients or server API load.','Frame intervals and JS callback-span timing are not GPU timestamps.','Draw and triangle totals include rendered passes; they are not unique source geometry.','Host process counters cover stable PID/start pairs; short-lived activity and per-process GPU utilization are not fully attributed.','The panel refresh caps observed frame rate; screenshot capture occurs after measurement.']});
}catch(error){await save('failed.json',{error:String(error.stack??error),runs,guardErrors,host:snapshots});process.exitCode=1;}
finally{await close();try{const samples=[hostSample()];await new Promise(r=>setTimeout(r,5000));samples.push(hostSample());await save('admission-after.json',{samples,activity:interval(...samples),scope:'After owned browser/server cleanup; rolling load may remain elevated'});}catch{}releaseReservation();process.off('SIGTERM',stop);process.off('SIGINT',stop);}
