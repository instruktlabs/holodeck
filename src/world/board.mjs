export const BOARD_WIDTH=1200, BOARD_HEIGHT=720;
export const referenceKind=r=>r.kind||'image';
export const cardLayout=(r,index)=>r.layout||{x:30+(index%3)*390,y:106+Math.floor((index%6)/3)*292,w:360,h:270};
export const boardPage=(r,index)=>r.page??Math.floor(index/6);
export const boardStyle=board=>({title:board?.title||'A feeling to build toward',theme:board?.theme||'linen'});
export const BOARD_THEMES={linen:{background:'#e9e3d4',card:'#faf6ec',ink:'#424c3f',muted:'#7e826d',accent:'#788763'},charcoal:{background:'#28312d',card:'#36403a',ink:'#e7e2d5',muted:'#abb5a4',accent:'#c3ab7e'},clay:{background:'#d8bda5',card:'#f0dfca',ink:'#554638',muted:'#8c715b',accent:'#8b6146'}};
