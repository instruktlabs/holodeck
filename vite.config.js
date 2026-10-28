import { createLogger, defineConfig, searchForWorkspaceRoot } from 'vite';
import {clientExtension} from './server/client-extension.mjs';
import { holodeckHostPlugin } from './server/host.mjs';
// @pmndrs/glyph ships source maps that point at files it does not publish. Vite
// reports each one; drop only those so real warnings stay visible.
const logger=createLogger(),noise=message=>message.includes('@pmndrs/glyph')&&/source ?map/i.test(message);
const warn=logger.warn,warnOnce=logger.warnOnce,error=logger.error;
logger.warn=(message,options)=>{if(!noise(message))warn(message,options);};
logger.warnOnce=(message,options)=>{if(!noise(message))warnOnce(message,options);};
logger.error=(message,options)=>{if(!noise(message))error(message,options);};
const extension=clientExtension(process.env.HOLODECK_CLIENT_EXTENSION);
export default defineConfig({
  customLogger:logger,
  plugins:[holodeckHostPlugin()],
  server: { fs:{allow:[searchForWorkspaceRoot(process.cwd()),...(extension.root?[extension.root]:[])]}, watch: { ignored: ['**/evidence/**', '**/private/**', '**/research-private/**'] } },
  resolve: {alias:{'@holodeck/client-extension':extension.entry}, dedupe: ['three', 'react', 'react-dom','@react-three/fiber'] },
  optimizeDeps: { exclude: ['@pmndrs/glyph'] },
  worker: { format: 'es' },
  build: { rollupOptions: { input: { main: 'index.html', design: 'design.html', walkthrough: 'walkthrough.html', prototype: 'prototype.html' } } },
});
