import { createLogger, defineConfig } from 'vite';
import { holodeckHostPlugin } from './server/host.mjs';
// @pmndrs/glyph ships source maps that point at files it does not publish. Vite
// reports each one; drop only those so real warnings stay visible.
const logger=createLogger(),noise=message=>message.includes('@pmndrs/glyph')&&/source ?map/i.test(message);
const warn=logger.warn,warnOnce=logger.warnOnce,error=logger.error;
logger.warn=(message,options)=>{if(!noise(message))warn(message,options);};
logger.warnOnce=(message,options)=>{if(!noise(message))warnOnce(message,options);};
logger.error=(message,options)=>{if(!noise(message))error(message,options);};
export default defineConfig({
  customLogger:logger,
  plugins:[holodeckHostPlugin()],
  server: { watch: { ignored: ['**/evidence/**', '**/private/**', '**/research-private/**'] } },
  resolve: { dedupe: ['three', 'react', 'react-dom'] },
  optimizeDeps: { exclude: ['@pmndrs/glyph'] },
  worker: { format: 'es' },
  build: { rollupOptions: { input: { main: 'index.html', design: 'design.html', walkthrough: 'walkthrough.html', prototype: 'prototype.html' } } },
});
