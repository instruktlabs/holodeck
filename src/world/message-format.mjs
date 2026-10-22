// A small, conservative reader for the Markdown that agents commonly reply with.
// It returns plain data; rendering builds React elements, never raw HTML.
const TABLE_RULE=/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;
const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
export function inlineSpans(text){
  const spans=[],re=/(\*\*([^*]+)\*\*|`([^`]+)`)/g;let last=0,m;
  while((m=re.exec(text))){if(m.index>last)spans.push({text:text.slice(last,m.index)});spans.push(m[2]!==undefined?{text:m[2],strong:true}:{text:m[3],code:true});last=re.lastIndex;}
  if(last<text.length)spans.push({text:text.slice(last)});
  return spans;
}
export function messageBlocks(source=''){
  const lines=String(source).replace(/\r\n?/g,'\n').split('\n'),blocks=[];let i=0;
  while(i<lines.length){
    const line=lines[i];
    if(!line.trim()){i++;continue;}
    const heading=line.match(/^(#{1,4})\s+(.*)$/);
    if(heading){blocks.push({type:'heading',level:heading[1].length,text:heading[2]});i++;continue;}
    if(line.trim().startsWith('|')&&TABLE_RULE.test(lines[i+1]?.trim()||'')){
      const head=cells(line),rows=[];i+=2;
      while(i<lines.length&&lines[i].trim().startsWith('|')){rows.push(cells(lines[i]));i++;}
      blocks.push({type:'table',head,rows});continue;
    }
    const item=/^\s*(?:[-*]|\d+[.)])\s+/;
    if(item.test(line)){
      const ordered=/^\s*\d/.test(line),items=[];
      while(i<lines.length&&item.test(lines[i])){items.push(lines[i].replace(item,''));i++;while(i<lines.length&&/^\s{2,}\S/.test(lines[i])&&!item.test(lines[i])){items[items.length-1]+=` ${lines[i].trim()}`;i++;}}
      blocks.push({type:'list',ordered,items});continue;
    }
    const para=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!/^(#{1,4})\s/.test(lines[i])&&!item.test(lines[i])&&!lines[i].trim().startsWith('|'))para.push(lines[i++]);
    blocks.push({type:'paragraph',text:para.join('\n')});
  }
  return blocks;
}
