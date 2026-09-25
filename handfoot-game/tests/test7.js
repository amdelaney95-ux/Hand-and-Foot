const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'p'+Math.random(), rank, suit});

function freshState(){
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('P1','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  return state;
}

// ---- exact user scenario: 8 cards in pile, pair of 10s, expect 1 card remaining ----
{
  const state = freshState();
  state.discardPile = [
    c('4','♠'), c('5','♥'), c('6','♦'), c('7','♣'), c('8','♠'), c('9','♥'), c('J','♦'), c('10','♣')
  ]; // 8 cards, top = 10♣
  state.hands['p0'] = [c('10','♠'), c('10','♥')];
  state.initialMeldMet['p0'] = true;
  const idsBefore = state.discardPile.length;
  assert(idsBefore===8, 'sanity: pile starts with 8 cards');

  const r = matchedPickupCommit(state, 'p0', [state.hands['p0'][0].id, state.hands['p0'][1].id], []);
  assert(r.ok, 'matched pickup on 8-card pile succeeds');
  assert(state.discardPile.length===1, `exactly 1 card remains in the discard pile (got ${state.discardPile.length})`);
  const tenMeld = state.melds['p0'].find(m=>m.rank==='10');
  assert(tenMeld.cards.length===3, 'mandatory meld has exactly 3 cards (2 naturals + top)');
  // hand should have gained (8-1)=7 total minus the 2 used in the meld = started with 2, ended with (2-2)+6 = 6
  assert(state.hands['p0'].length===6, `hand has the 6 additional picked-up cards (got ${state.hands['p0'].length})`);
}

// ---- exactly 7 in pile: whole pile taken, 0 remain (unchanged from before) ----
{
  const state = freshState();
  state.discardPile = [c('4','♠'),c('5','♥'),c('6','♦'),c('7','♣'),c('8','♠'),c('9','♥'),c('10','♣')]; // 7 total
  state.hands['p0'] = [c('10','♠'), c('10','♥')];
  state.initialMeldMet['p0'] = true;
  const r = matchedPickupCommit(state, 'p0', [state.hands['p0'][0].id, state.hands['p0'][1].id], []);
  assert(r.ok, 'pickup on exactly-7 pile succeeds');
  assert(state.discardPile.length===0, 'entire 7-card pile consumed, 0 remain');
}

// ---- large pile (12 cards): still caps total taken at 7, leaves 5 ----
{
  const state = freshState();
  state.discardPile = [c('3','♠'),c('4','♥'),c('5','♦'),c('6','♣'),c('7','♠'),c('8','♥'),c('9','♦'),c('J','♣'),c('Q','♠'),c('K','♥'),c('A','♦'),c('10','♣')]; // 12 total, top=10♣
  state.hands['p0'] = [c('10','♠'), c('10','♥')];
  state.initialMeldMet['p0'] = true;
  const r = matchedPickupCommit(state, 'p0', [state.hands['p0'][0].id, state.hands['p0'][1].id], []);
  assert(r.ok, 'pickup on 12-card pile succeeds');
  assert(state.discardPile.length===5, `12-card pile leaves 5 remaining after a 7-card cap (got ${state.discardPile.length})`);
}

// ---- small pile (2 cards): takes both, none remain ----
{
  const state = freshState();
  state.discardPile = [c('4','♠'), c('10','♣')]; // 2 total
  state.hands['p0'] = [c('10','♠'), c('10','♥')];
  state.initialMeldMet['p0'] = true;
  const r = matchedPickupCommit(state, 'p0', [state.hands['p0'][0].id, state.hands['p0'][1].id], []);
  assert(r.ok, 'pickup on 2-card pile succeeds');
  assert(state.discardPile.length===0, 'both cards taken (fewer than 7 available), none remain');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
