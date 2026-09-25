const RANK_ORDER = {'3':0,'4':1,'5':2,'6':3,'7':4,'8':5,'9':6,'10':7,'J':8,'Q':9,'K':10,'A':11,'2':12,'JOKER':13};
function meldSortValue(rank){ return rank==='WILD' ? 99 : (RANK_ORDER[rank] ?? 50); }
function sortMelds(melds){ return [...melds].sort((a,b)=>meldSortValue(a.rank)-meldSortValue(b.rank)); }
let ui = { meldOrder: null, meldPickedRank: null };
function getDisplayMelds(melds){
  if(!ui.meldOrder || ui.meldOrder.length===0) return sortMelds(melds);
  const byRank = new Map(melds.map(m=>[m.rank,m]));
  const ordered = [];
  const seen = new Set();
  for(const r of ui.meldOrder){
    if(byRank.has(r)){ ordered.push(byRank.get(r)); seen.add(r); }
  }
  const leftover = melds.filter(m=>!seen.has(m.rank));
  return ordered.concat(sortMelds(leftover));
}
function pickOrPlaceMeld(melds, rank){
  if(ui.meldPickedRank === null){
    ui.meldPickedRank = rank;
  } else if(ui.meldPickedRank === rank){
    ui.meldPickedRank = null;
  } else {
    let order = getDisplayMelds(melds).map(m=>m.rank);
    order = order.filter(r=>r!==ui.meldPickedRank);
    const targetIdx = order.indexOf(rank);
    order.splice(targetIdx, 0, ui.meldPickedRank);
    ui.meldOrder = order;
    ui.meldPickedRank = null;
  }
}
function dropPickedMeldAtEnd(melds){
  if(ui.meldPickedRank === null) return;
  let order = getDisplayMelds(melds).map(m=>m.rank);
  order = order.filter(r=>r!==ui.meldPickedRank);
  order.push(ui.meldPickedRank);
  ui.meldOrder = order;
  ui.meldPickedRank = null;
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

// Melds started out of order (K first, then 7, then Q, then WILD)
const melds = [
  {rank:'K', cards:[]}, {rank:'7', cards:[]}, {rank:'Q', cards:[]}, {rank:'WILD', cards:[]}, {rank:'A', cards:[]}
];

// Default: ascending, WILD last
let disp = getDisplayMelds(melds).map(m=>m.rank);
assert(JSON.stringify(disp)===JSON.stringify(['7','Q','K','A','WILD']), `default is ascending rank order with WILD last (got ${disp})`);

// Reorder: pick up K, place before 7 -> K moves to front
pickOrPlaceMeld(melds, 'K');
pickOrPlaceMeld(melds, '7');
disp = getDisplayMelds(melds).map(m=>m.rank);
assert(JSON.stringify(disp)===JSON.stringify(['K','7','Q','A','WILD']), `custom order after moving K before 7 (got ${disp})`);

// Cancel by tapping the same meld twice
pickOrPlaceMeld(melds, 'Q');
pickOrPlaceMeld(melds, 'Q');
assert(ui.meldPickedRank===null, 'tapping the same meld twice cancels the pickup');
disp = getDisplayMelds(melds).map(m=>m.rank);
assert(JSON.stringify(disp)===JSON.stringify(['K','7','Q','A','WILD']), 'order unchanged after a cancelled pickup');

// Drop at end
pickOrPlaceMeld(melds, '7');
dropPickedMeldAtEnd(melds);
disp = getDisplayMelds(melds).map(m=>m.rank);
assert(JSON.stringify(disp)===JSON.stringify(['K','Q','A','WILD','7']), `dropping at end moves 7 to the last slot (got ${disp})`);

// A brand new meld (rank '9' just started) appends in default sorted position among leftovers
const meldsPlusNew = melds.concat([{rank:'9', cards:[]}]);
disp = getDisplayMelds(meldsPlusNew).map(m=>m.rank);
assert(JSON.stringify(disp)===JSON.stringify(['K','Q','A','WILD','7','9']), `new meld appended after existing custom order (got ${disp})`);

// Sort resets to default
ui.meldOrder = null;
disp = getDisplayMelds(melds).map(m=>m.rank);
assert(JSON.stringify(disp)===JSON.stringify(['7','Q','K','A','WILD']), 'sorting resets to default ascending order');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
