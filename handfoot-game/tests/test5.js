const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'r'+Math.random(), rank, suit});
const two = ()=>({id:'r'+Math.random(), rank:'2', suit:'♠'});
const jkr = ()=>({id:'r'+Math.random(), rank:'JOKER', suit:null});

function freshState(){
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('R','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  return state;
}

// ---- eligibleWildTargets ----
{
  const state = freshState();
  state.melds['p0'] = [
    {rank:'7', cards:[c('7','♠'),c('7','♥'),c('7','♦'),c('7','♣')], type:'clean', isCanasta:false}, // 4 naturals, room for 3 more
    {rank:'9', cards:[c('9','♠'),c('9','♥'),c('9','♦'),{id:'w0',rank:'2',suit:'♣'}], type:'dirty', isCanasta:false}, // 3 nat + 1 wild, room for 3 more, adding wilds must keep nat>wild
  ];
  const targets1 = eligibleWildTargets(state, 'p0', 1);
  assert(targets1.some(m=>m.rank==='7'), '7s meld is eligible for 1 wild (has room, stays natural-majority)');
  assert(targets1.some(m=>m.rank==='9'), '9s meld eligible for 1 wild (3 nat vs 2 wild after add, still majority)');

  const targets3 = eligibleWildTargets(state, 'p0', 3);
  assert(targets3.some(m=>m.rank==='7'), '7s meld eligible for 3 wilds (4 nat vs 3 wild, still majority, fills to 7)');
  assert(!targets3.some(m=>m.rank==='9'), '9s meld NOT eligible for 3 wilds (3 nat vs 4 wild would flip majority)');

  const targets5 = eligibleWildTargets(state, 'p0', 5);
  assert(targets5.length===0, 'no meld eligible for 5 wilds (would overflow past 7 or break ratio everywhere)');
}

// ---- redirecting a loose wild group into an existing meld via tryAddMeldGroup/commitMeldGroupsNow ----
{
  const state = freshState();
  state.melds['p0'] = [
    {rank:'7', cards:[c('7','♠'),c('7','♥'),c('7','♦'),c('7','♣')], type:'clean', isCanasta:false},
  ];
  state.hands['p0'] = [two(), two()];
  const ids = state.hands['p0'].map(x=>x.id);

  const rDefault = tryAddMeldGroup(state, 'p0', ids); // no targetRank -> should try WILD (fails, needs 3 to start new wild meld)
  assert(!rDefault.ok, 'without a redirect, 2 loose wilds cannot start a brand-new WILD meld (needs 3 minimum)');

  const rRedirect = tryAddMeldGroup(state, 'p0', ids, '7');
  assert(rRedirect.ok && rRedirect.rank==='7', 'redirecting those same 2 wilds into the existing 7s meld succeeds');

  const res = commitMeldGroupsNow(state, 'p0', [{ids, targetRank:'7'}]);
  assert(res.ok, 'commitMeldGroupsNow applies the redirect successfully');
  const sevenMeld = state.melds['p0'].find(m=>m.rank==='7');
  assert(sevenMeld.cards.length===6, '7s meld grew from 4 to 6 cards');
  assert(sevenMeld.type==='dirty', '7s meld is now dirty (naturals still outnumber the 2 added wilds: 4 nat vs 2 wild)');
  assert(!state.hands['p0'].some(c=>ids.includes(c.id)), 'both wild cards removed from hand (hand may have refilled from foot since it hit 0)');
  assert((state.melds['p0'].find(m=>m.rank==='WILD'))===undefined, 'no separate WILD meld was created — cards went to the 7s pile as intended');
}

// ---- redirect rejected if it would break the natural-majority rule ----
{
  const state = freshState();
  state.melds['p0'] = [
    {rank:'9', cards:[c('9','♠'),c('9','♥'),c('9','♦')], type:'clean', isCanasta:false}, // 3 naturals only
  ];
  state.hands['p0'] = [two(), two(), two()]; // 3 wilds - would tie 3v3, not allowed
  const ids = state.hands['p0'].map(x=>x.id);
  const r = tryAddMeldGroup(state, 'p0', ids, '9');
  assert(!r.ok, 'redirect rejected when it would leave wilds >= naturals in the target meld');
}

// ---- default (no redirect) behavior still works exactly as before: 3+ loose wilds start a WILD meld ----
{
  const state = freshState();
  state.hands['p0'] = [two(), two(), jkr()];
  const ids = state.hands['p0'].map(x=>x.id);
  const res = commitMeldGroupsNow(state, 'p0', [ids]); // no targetRank
  assert(res.ok, 'default routing (no targetRank) still starts a fresh WILD meld with 3 loose wilds');
  assert(state.melds['p0'].find(m=>m.rank==='WILD').cards.length===3, 'WILD meld has the 3 cards');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
