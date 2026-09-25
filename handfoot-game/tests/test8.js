const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'m'+Math.random(), rank, suit});

function freshState(){
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('M1','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  return state;
}

// ---- exact user scenario: meld entire hand away, foot auto-opens, turn continues ----
{
  const state = freshState();
  state.melds['p0'] = [
    {rank:'7', cards:[c('7','♠'),c('7','♥'),c('7','♦'),c('7','♣'),c('7','♠'),c('7','♥')], type:'clean', isCanasta:false}, // 6/7
  ];
  state.initialMeldMet['p0'] = true;
  state.turnPhase = 'meld';
  state.hands['p0'] = [c('7','♦')]; // exactly 1 card left, completes the 7s to a canasta
  state.feet['p0'] = [c('K','♠'), c('Q','♥'), c('J','♦')]; // arbitrary foot (would be 13 in a real game)
  state.footOpen['p0'] = false;
  const originalFootSize = state.feet['p0'].length;

  const ids = [state.hands['p0'][0].id];
  const res = commitMeldGroupsNow(state, 'p0', [ids]);
  assert(res.ok, 'melding the last hand card succeeds');
  assert(state.footOpen['p0']===true, 'foot automatically opened the instant hand hit 0 via melding (no extra click needed)');
  assert(state.hands['p0'].length===originalFootSize, `hand now holds the foot's cards (${state.hands['p0'].length} === ${originalFootSize})`);
  assert(state.turnPhase==='meld', 'turn phase stays "meld" — turn is NOT ended, player can keep playing');
  assert(state.phase!=='roundEnd', 'round has not ended (they have not gone out yet, just opened their foot)');
}

// ---- discarding your last card still ends the turn immediately, even though foot also opens ----
{
  const state = freshState();
  state.turnOrder=['p0','p1'];
  state.hands['p0'] = [c('4','♠')];
  state.feet['p0'] = [c('K','♠'), c('Q','♥')];
  state.footOpen['p0'] = false;
  state.turnIndex = 0;
  state.turnPhase = 'discard';
  const cardId = state.hands['p0'][0].id;
  const res = performDiscard(state, 'p0', cardId);
  assert(res.ok, 'discard succeeds');
  assert(state.footOpen['p0']===true, 'foot still opens after discarding the last hand card');
  assert(state.turnIndex===1, 'but the turn correctly ADVANCES to the next player (discard always ends the turn)');
}

// ---- going out entirely through melding, without ever discarding ----
{
  const state = freshState();
  // p0 already has a clean AND dirty canasta banked from earlier turns
  state.melds['p0'] = [
    {rank:'7', cards:[c('7','♠'),c('7','♥'),c('7','♦'),c('7','♣'),c('7','♠'),c('7','♥'),c('7','♦')], type:'clean', isCanasta:true},
    {rank:'9', cards:[c('9','♠'),c('9','♥'),c('9','♦'),c('9','♣'),c('9','♠'),{id:'w1',rank:'2',suit:'♣'},{id:'w2',rank:'2',suit:'♦'}], type:'dirty', isCanasta:true},
  ];
  state.initialMeldMet['p0'] = true;
  state.footOpen['p0'] = true; // already played through hand once this turn
  state.feet['p0'] = [];
  state.hands['p0'] = [c('K','♠'), c('K','♥'), c('K','♦')]; // last 3 cards, about to meld them all away
  const ids = state.hands['p0'].map(x=>x.id);
  const res = commitMeldGroupsNow(state, 'p0', [ids]);
  assert(res.ok, 'melding the final 3 cards succeeds');
  assert(state.hands['p0'].length===0, 'hand is now empty');
  assert(state.phase==='roundEnd', 'round ends immediately — went out via pure melding, no discard involved');
  assert(state.wentOutPlayer==='p0', 'p0 correctly recorded as having gone out');
}

// ---- melding to empty with foot already open but NOT qualified to go out: turn auto-ends (floating) ----
{
  const state = freshState();
  state.turnOrder = ['p0','p1'];
  state.melds['p0'] = [
    {rank:'9', cards:[c('9','♠'),c('9','♥'),c('9','♦')], type:'clean', isCanasta:false}, // no canasta yet
  ];
  state.initialMeldMet['p0'] = true;
  state.footOpen['p0'] = true;
  state.feet['p0'] = [];
  state.hands['p0'] = [c('9','♣')];
  state.turnIndex = 0;
  state.turnPhase = 'meld';
  const ids = [state.hands['p0'][0].id];
  const res = commitMeldGroupsNow(state, 'p0', [ids]);
  assert(res.ok, 'melding succeeds');
  assert(state.hands['p0'].length===0, 'hand is empty');
  assert(state.phase!=='roundEnd', 'round does NOT end — no clean+dirty canasta yet, so no valid going-out');
  assert(state.turnIndex===1, 'turn automatically advances to the next player — no "skip melding -> discard" click needed while floating with nothing to play');
  assert(state.turnPhase==='draw', "next player's turn correctly starts in the draw phase");
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
