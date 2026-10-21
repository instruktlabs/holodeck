import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readExampleManifest,readExamplePreview} from './example-bundle.mjs';
const examplesRoot=fileURLToPath(new URL('../examples',import.meta.url));
const builtinIds=['construct','courtyard','kinetic'];
export async function resolveExample(id,{directory=examplesRoot}={}){
 if(typeof id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(id))throw new Error('Choose a valid local example ID');
 if(builtinIds.includes(id)){
  const file=path.join(directory,`${id}.json`),template=JSON.parse(await readFile(file,'utf8'));return {id,title:template.title,description:template.intent,kind:'template',file};
 }
 try{const file=path.join(directory,id),manifest=await readExampleManifest(file);if(manifest.id!==id)throw new Error('Example directory and manifest ID differ');return {id,title:manifest.title,description:manifest.description,kind:'bundle',file,integrity:manifest.integrity,capabilities:manifest.capabilities,...(manifest.preview?{preview:manifest.preview}:{})};}
 catch(error){if(error.code==='ENOENT')throw new Error(`Unknown example ${id}. Choose construct, courtyard or kinetic, or an installed example bundle.`);throw error;}
}
export async function listExamples({directory=examplesRoot}={}){
 const examples=[];for(const id of builtinIds){const {file,...entry}=await resolveExample(id,{directory});examples.push(entry);}
 for(const entry of (await readdir(directory,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&!builtinIds.includes(entry.name)).sort((a,b)=>a.name.localeCompare(b.name))){
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(entry.name))continue;
  try{const {file,...metadata}=await resolveExample(entry.name,{directory});examples.push(metadata);}catch{/* Invalid or incomplete bundles are not advertised as installable. */}
 }
 return examples;
}
export async function loadExamplePreview(id,options){const entry=await resolveExample(id,options);return entry.kind==='bundle'?readExamplePreview(entry.file):null;}
