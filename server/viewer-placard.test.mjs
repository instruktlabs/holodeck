import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// What reading the source can pin of the placard's promise to leave the scene its input.
// `npm run probe:placard` walks it in a real browser, which is where the rest of that promise is kept.
const source=file=>readFile(fileURLToPath(new URL(`../src/viewer/${file}`,import.meta.url)),'utf8');
const placardRules=async()=>{
 const css=await source('viewer.css'),start=css.indexOf("/* A shelf world's placard");assert.ok(start>=0,'the placard block moved');
 return [...css.slice(start).replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,selector,body])=>({selector:selector.trim(),body}));
};

test('the placard passes pointers through, except on More, its links and its text when that has to scroll',async()=>{
 const rules=await placardRules(),plate=rules.find(rule=>rule.selector==='.scene-placard');
 assert.match(plate.body,/pointer-events:none/);
 assert.deepEqual(rules.filter(rule=>/pointer-events:auto/.test(rule.body)).map(rule=>rule.selector),['.scene-placard details>div.scrolls,#root:empty~.scene-placard details>div','.scene-placard summary','.scene-placard a']);
 // The class that lets More's text take the pointer goes by whether it really overflows, and its cap by what main.jsx measures.
 assert.ok((await source('main.jsx')).includes("more.classList.toggle('scrolls',more.scrollHeight>more.clientHeight+1)"));
 assert.match(rules.find(rule=>rule.selector==='.scene-placard details>div').body,/max-height:max\(54px,calc\(100dvh - var\(--rest\) - var\(--placard-head,130px\) - 88px\)\);overflow:auto/);
});

test('the placard shows on the overview only, and comes back closed',async()=>{
 const main=await source('main.jsx'),rules=await placardRules();
 assert.ok(main.includes('placard.hidden=inhabiting||hidden||menu;'),'walking, photo mode and the View menu must hide it');
 assert.ok(main.includes("if(inhabiting||hidden)placard.querySelector('details')?.removeAttribute('open');"),'leaving must close it');
 assert.ok(main.includes('const [inhabiting,setInhabiting]=useState(benchmarkEnabled)'),'benchmark captures start in the world, which hides it');
 // A display on the plate would override the `hidden` that main.jsx sets.
 for(const rule of rules.filter(rule=>/\.scene-placard$/.test(rule.selector)))assert.match(rule.body,/^(?![\s\S]*display:(?!none))/,rule.selector);
});

test('only the loader and the footer\'s details put the placard away, never a failed or script-less page',async()=>{
 const rules=await placardRules(),away=rules.filter(rule=>/\.scene-placard$/.test(rule.selector)&&/display:none/.test(rule.body)).map(rule=>rule.selector);
 assert.deepEqual(away,['body:has(.viewer-load):not(:has(.viewer-error)) .scene-placard','body:has(.viewer-footer details[open]) .scene-placard']);
 // The sentence collapses only where there is a scene to leave room for.
 const collapsed=rules.filter(rule=>/\.scene-placard[^,]*>p$/.test(rule.selector)&&/display:none/.test(rule.body)).map(rule=>rule.selector);
 assert.deepEqual(collapsed,['body:has(canvas) .scene-placard:not(:has(details[open]))>p']);
});

test('the placard keeps only Enter from the scene\'s keys',async()=>{
 const main=await source('main.jsx');
 assert.ok(main.includes("keep=e=>{if(e.code==='Enter')e.stopPropagation();}"),'only Enter may stop at the placard');
 assert.ok(main.includes("placard.addEventListener('keydown',keep)"),'Enter on More must stay with More');
 assert.equal(main.match(/stopPropagation/g).length,1);
});

test('the placard adds no compositing work',async()=>{
 for(const rule of await placardRules())assert.doesNotMatch(rule.body,/backdrop-filter|transition|animation|will-change|filter:/,rule.selector);
});
