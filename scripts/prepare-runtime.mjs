import { mkdir, copyFile } from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url),dist=path.dirname(require.resolve('onnxruntime-web'));
const output=fileURLToPath(new URL('../public/runtime/',import.meta.url));
await mkdir(output,{recursive:true});
for(const suffix of ['wasm','mjs'])await copyFile(path.join(dist,`ort-wasm-simd-threaded.asyncify.${suffix}`),path.join(output,`ort-wasm-simd-threaded.asyncify.${suffix}`));
