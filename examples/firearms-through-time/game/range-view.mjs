import {stats,currentShots} from './range-session.mjs';

// One read model for the HUD and physical displays. It never changes the ledger.
export function rangeView(state,selection='current'){
 const index=selection==='current'?-1:Number(selection);
 const archive=Number.isInteger(index)&&index>=0?state.archives[index]:null;
 const rows=archive?.shots??(state.phase==='ready'?[]:currentShots(state));
 const lane=archive?.lane??state.lane;
 return {rows,lane,stats:stats(rows),archived:!!archive,
  stringId:archive?.stringId??(state.phase==='ready'?state.stringId+1:state.stringId),
  sheetId:archive?.sheetId??state.sheetId,activation:archive?.activation??state.activation,
  phase:state.phase,plateHits:new Set(rows.filter(s=>s.outcome==='hit'&&s.impact?.lane==='plates').map(s=>s.impact.plate)).size,
  key:[state.id,selection,state.shots.length,state.stringId,state.phase,state.sheetId,state.activation,state.archives.length,state.lane].join(':')};
}
