import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),template=await readFile(new URL('materials/catalog-editor.template.html',root),'utf8'),data=JSON.parse(await readFile(new URL('materials/catalog.json',root),'utf8'));
await writeFile(new URL('materials/catalog.html',root),template.replace('__CATALOG__',JSON.stringify(data).replaceAll('<','\\u003c')));
console.log('Built local material fieldbook');
