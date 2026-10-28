import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('package.json','utf8'));
if(!manifest.files?.length)throw new Error('Distribution requires an explicit files allowlist');
const candidates=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/(^|\/)(evidence|private|research-private|world-research|\.holodeck|node_modules)(\/|$)|(^|\/)\.env/;
for(const file of candidates){
 if(forbidden.test(file))throw new Error(`Private/local path in source candidate: ${file}`);
 if(/\.(md|json|jsx?|mjs|css|html|ya?ml)$/.test(file)&&file!=='package-lock.json'){
  const text=await readFile(file,'utf8');
  if(/[A-Z]:[\\/](?:Users|home)[\\/]/i.test(text))throw new Error(`Machine-specific path in ${file}`);
 }
}
if(!process.env.npm_execpath)throw new Error('Run through npm run check:distribution');
// npm 11 prints an array of pack results; npm 12 prints them keyed by package name.
const packed=JSON.parse(execFileSync(process.execPath,[process.env.npm_execpath,'pack','--dry-run','--json','--ignore-scripts'],{encoding:'utf8',maxBuffer:8*1024*1024}));
const [pack]=Array.isArray(packed)?packed:Object.values(packed);
for(const {path:file} of pack.files){if(forbidden.test(file)||file.endsWith('.test.mjs')||file.startsWith('scripts/')&&file!=='scripts/prepare-runtime.mjs')throw new Error(`Unexpected package file: ${file}`);}
for(const file of ['bin/holodeck.mjs','examples/courtyard/example.json','examples/crescent-cove/example.json','examples/kinetic.json','examples/tidemark/example.json','examples/tidemark/world/world.json','examples/tidemark/preview.png','src/world/runtime.mjs','skills/holodeck-author-world/SKILL.md','skills/holodeck-export-unity/SKILL.md'])if(!pack.files.some(f=>f.path===file))throw new Error(`Missing package file: ${file}`);
console.log(`Checked ${candidates.length} source candidates and ${pack.files.length} package files (${pack.unpackedSize} bytes unpacked). No private/local artifact paths found. Source and license review remain separate.`);
