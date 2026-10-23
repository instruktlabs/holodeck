import React,{useMemo,useState} from 'react';
import {diffProposal,summarizeProposal} from './proposal-diff.mjs';

// The proposal card's review: a few summary lines, grouped detail on demand,
// and the raw JSON last. Plain lists and tables; styling stays minimal.
const MAX_IDS=24;
const idList=list=>list.length>MAX_IDS?`${list.slice(0,MAX_IDS).join(', ')} and ${list.length-MAX_IDS} more`:list.join(', ');
const text=value=>typeof value==='string'?value:JSON.stringify(value);

export function ProposalReview({accepted,proposal}){
  const diff=useMemo(()=>diffProposal(accepted,proposal.world),[accepted,proposal]);
  const [raw,setRaw]=useState(false);
  const {placements,assets,settings}=diff.scene,board=diff.board;
  return <div className="proposal-review">
    <ul className="proposal-summary">{summarizeProposal(diff).map(line=><li key={line}>{line}</li>)}</ul>
    <details><summary>Show details</summary>
      {placements.groups.length>0&&<div className="proposal-scroll"><table>
        <caption>Placements by asset</caption>
        <thead><tr><th>Asset</th><th>Added</th><th>Removed</th><th>Moved</th><th>Changed</th></tr></thead>
        <tbody>{placements.groups.map(g=><tr key={g.key} title={[g.added.length&&`Added: ${idList(g.added)}`,g.removed.length&&`Removed: ${idList(g.removed)}`,g.moved.length&&`Moved: ${idList(g.moved)}`,g.changed.length&&`Changed: ${idList(g.changed.map(c=>`${c.id} (${c.fields.join(', ')})`))}`].filter(Boolean).join('\n')}>
          <td>{g.key}</td><td>{g.added.length||''}</td><td>{g.removed.length||''}</td><td>{g.moved.length||''}</td><td>{g.changed.length||''}</td>
        </tr>)}</tbody>
      </table></div>}
      {(assets.added.length>0||assets.removed.length>0||assets.changed.length>0)&&<p><b>Assets</b>{assets.added.length>0&&<><br/>Added: {idList(assets.added)}</>}{assets.removed.length>0&&<><br/>Removed: {idList(assets.removed)}</>}{assets.changed.length>0&&<><br/>Changed: {idList(assets.changed.map(a=>`${a.id} (${a.fields.join(', ')})`))}</>}</p>}
      {settings.length>0&&<p><b>Scene settings</b>{settings.map(s=><React.Fragment key={s.field}><br/>{s.field}: {[...(s.appearance?.length?[`appearance: ${s.appearance.join(', ')}`]:[]),...(s.stamps?[`stamps +${s.stamps.added} −${s.stamps.removed} ~${s.stamps.changed}`]:[]),...s.keys.filter(k=>!(k==='appearance'&&s.appearance)&&!(k==='stamps'&&s.stamps))].join('; ')||'changed'}</React.Fragment>)}</p>}
      {diff.bible.length>0&&<div className="proposal-scroll"><table>
        <caption>Bible</caption>
        <thead><tr><th>Field</th><th>Accepted</th><th>Proposed</th></tr></thead>
        <tbody>{diff.bible.map(f=><tr key={f.field}><td>{f.field}</td>{f.added?<td colSpan={2}>{f.removed.map(line=><div key={`-${line}`}>− {line}</div>)}{f.added.map(line=><div key={`+${line}`}>+ {line}</div>)}</td>:<><td>{text(f.before)}</td><td>{text(f.after)}</td></>}</tr>)}</tbody>
      </table></div>}
      {(board.added.length+board.removed.length+board.moved.length+board.changed.length)>0&&<p><b>Mood board cards</b>
        {board.added.length>0&&<><br/>Added: {board.added.map(c=>c.title||c.id).join(', ')}</>}
        {board.removed.length>0&&<><br/>Removed: {board.removed.map(c=>c.title||c.id).join(', ')}</>}
        {board.moved.length>0&&<><br/>Moved: {board.moved.map(c=>c.title||c.id).join(', ')}</>}
        {board.changed.length>0&&<><br/>Edited: {board.changed.map(c=>`${c.title||c.id} (${c.fields.join(', ')})`).join(', ')}</>}
      </p>}
      <details onToggle={e=>setRaw(e.currentTarget.open)}><summary>Raw proposal JSON</summary>{raw&&<pre>{JSON.stringify({scene:proposal.world.scene,bible:proposal.world.bible,references:proposal.world.references},null,2)}</pre>}</details>
    </details>
  </div>;
}
