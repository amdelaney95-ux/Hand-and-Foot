const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'o'+Math.random(), rank, suit});

function freshState(){
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('O1','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  return state;
}

// ---- overflow onto a completed canasta ----
{
  const state = freshState();
  state.melds['p0'] = [
    {rank:'9', cards:[c('9','♠'),c('9','♥'),c('9','♦'),c('9','♣'),{id:'w1',rank:'2',suit:'♠'},{id:'w2',rank:'2',suit:'♥'},{id:'w3',rank:'JOKER',suit:null}], type:'dirty', isCanasta:true}, // exactly 7, dirty, complete
  ];
  state.hands['p0'] = [c('9','♦')]; // one more natural 9
  const ids = [state.hands['p0'][0].id];
  const r = tryAddMeldGroup(state, 'p0', ids);
  assert(r.ok, 'adding a single natural 9 to an already-complete 7/7 dirty canasta is now allowed');

  const res = commitMeldGroupsNow(state, 'p0', [ids]);
  assert(res.ok, 'commit succeeds');
  const nineMeld = state.melds['p0'].find(m=>m.rank==='9');
  assert(state.melds['p0'].filter(m=>m.rank==='9').length===1, 'still only ONE meld group for rank 9 (no duplicate second pile created)');
  assert(nineMeld.cards.length===8, 'meld grew to 8 cards (7 + 1 overflow)');
  assert(nineMeld.isCanasta===true, 'still flagged as canasta');
  assert(nineMeld.type==='dirty', 'type unchanged (still dirty, ratio still holds: 5 naturals vs 3 wilds after add)');
  assert(!state.hands['p0'].some(c=>ids.includes(c.id)), 'card removed from hand (hand may have refilled from foot since it hit 0)');
}

// ---- scoring: overflow card adds only its face value, not a second bonus ----
{
  const state = freshState();
  state.melds['p0'] = [
    {rank:'7', cards:[c('7','♠'),c('7','♥'),c('7','♦'),c('7','♣'),c('7','♠'),c('7','♥'),c('7','♦'),c('7','♣')], type:'clean', isCanasta:true}, // 8 natural 7s (7 + 1 overflow)
  ];
  state.hands['p0']=[]; state.feet['p0']=[]; state.footOpen['p0']=true; state.redThrees['p0']=[];
  state.hands['p1']=[]; state.feet['p1']=[]; state.footOpen['p1']=true; state.redThrees['p1']=[]; state.melds['p1']=[];
  scoreRoundEnd(state,'p0');
  const expected = 8*5 + 300; // 8 sevens at 5pts each + ONE clean canasta bonus (not doubled)
  assert(state.scores['p0'][0]===expected, `overflow scores correctly: 8 sevens + single 300 bonus (${state.scores['p0'][0]} === ${expected})`);
}

// ---- wild redirect onto an already-complete canasta still respects the ratio rule ----
{
  const state = freshState();
  state.melds['p0'] = [
    {rank:'K', cards:[c('K','♠'),c('K','♥'),c('K','♦'),c('K','♣'),c('K','♠'),{id:'w1',rank:'2',suit:'♠'},{id:'w2',rank:'JOKER',suit:null}], type:'dirty', isCanasta:true}, // 5 nat + 2 wild = 7
  ];
  state.hands['p0'] = [{id:'w3',rank:'2',suit:'♥'}]; // 1 more wild -> would make 5 nat vs 3 wild, still natural-majority, should be allowed
  const ids=[state.hands['p0'][0].id];
  const r1 = tryAddMeldGroup(state,'p0',ids,'K');
  assert(r1.ok, 'redirecting 1 more wild onto the completed K canasta is allowed (5 nat > 3 wild)');

  const state2 = freshState();
  state2.melds['p0'] = [
    {rank:'Q', cards:[c('Q','♠'),c('Q','♥'),c('Q','♦'),c('Q','♣'),{id:'w1',rank:'2',suit:'♠'},{id:'w2',rank:'2',suit:'♥'},{id:'w3',rank:'JOKER',suit:null}], type:'dirty', isCanasta:true}, // 4 nat + 3 wild = 7
  ];
  state2.hands['p0'] = [{id:'w4',rank:'2',suit:'♦'}]; // would make 4 nat vs 4 wild -> tie, not allowed
  const ids2=[state2.hands['p0'][0].id];
  const r2 = tryAddMeldGroup(state2,'p0',ids2,'Q');
  assert(!r2.ok, 'redirect onto a completed canasta still rejected if it would break the natural-majority rule');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
