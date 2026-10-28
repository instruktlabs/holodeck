import path from 'node:path';
import {realpathSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// A trusted local launch setting. Never selected by scene JSON or a remote asset.
export function clientExtension(value){
 const fallback=fileURLToPath(new URL('../src/world/no-client-extension.jsx',import.meta.url));
 if(!value)return {entry:fallback,root:null};
 if(!path.isAbsolute(value))throw new Error('HOLODECK_CLIENT_EXTENSION must be an absolute local module path');
 const entry=realpathSync(value);if(!statSync(entry).isFile()||! /\.[cm]?[jt]sx?$/.test(entry))throw new Error('Client extension must be a JavaScript or TypeScript module');
 return {entry,root:path.dirname(entry)};
}
