export const BOARD_WIDTH=1200, BOARD_HEIGHT=720;
export const referenceKind=r=>r.kind||'image';
export const cardLayout=(r,index)=>r.layout||{x:30+(index%3)*390,y:106+Math.floor((index%6)/3)*292,w:360,h:270};
export const boardPage=(r,index)=>r.page??Math.floor(index/6);
export const BOARD_PAGES=34;
// New cards take the first free grid slot from the current sheet onward, so
// one-at-a-time additions never stack on top of earlier cards.
const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
export function placeCards(existing,count,page=0){
  const taken=existing.map((r,i)=>({page:boardPage(r,i),...cardLayout(r,i)})),placed=[];
  for(let p=page;p<BOARD_PAGES&&placed.length<count;p++)for(let slot=0;slot<6&&placed.length<count;slot++){
    const layout=cardLayout({},slot);
    if(!taken.some(t=>t.page===p&&overlaps(t,layout))){taken.push({page:p,...layout});placed.push({page:p,layout});}
  }
  while(placed.length<count){const i=placed.length;placed.push({page,layout:{x:40+(i%3)*30,y:125+(i%3)*30,w:360,h:270}});}
  return placed;
}
export const boardStyle=board=>({title:board?.title||'A feeling to build toward',theme:board?.theme||'linen'});
// Identity of what the physical board paints. A new empty pin list must not count
// as a change, or the cove redraws and blanks the pictures on every interface update.
export function boardPaintKey(board,references=[],pins=[]){
 const style=boardStyle(board);
 const cards=(references||[]).map((r,i)=>{const layout=cardLayout(r,i);return [r.id,boardPage(r,i),layout.x,layout.y,layout.w,layout.h,r.kind||'',r.file||'',r.title||'',r.notes||'',r.group||'',r.status||''].join('\u001f');}).join('\u001e');
 return [style.title,style.theme,board?.page||0,(pins||[]).join('\u001f'),cards].join('\0');
}
export const BOARD_THEMES={linen:{background:'#e9e3d4',card:'#faf6ec',ink:'#424c3f',muted:'#7e826d',accent:'#788763'},charcoal:{background:'#28312d',card:'#36403a',ink:'#e7e2d5',muted:'#abb5a4',accent:'#c3ab7e'},clay:{background:'#d8bda5',card:'#f0dfca',ink:'#554638',muted:'#8c715b',accent:'#8b6146'}};
