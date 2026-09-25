const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }

const c = (rank,suit)=>({id:'z'+Math.random(), rank, suit});

// ---- discard-first sequential draw ----
{
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('D1','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  state.discardPile = [c('9','♠')];
  const handBefore = state.hands['p0'].length;

  const r1 = drawDiscardFirst(state,'p0');
  assert(r1.ok, 'drawDiscardFirst succeeds and takes just the discard card');
  assert(state.hands['p0'].length===handBefore+1, 'hand grew by exactly 1 (not 2) after discard-first draw');
  assert(state.discardPile.length===0, 'discard pile is now empty (top card taken)');
  assert(state.pendingSecondDraw===true && state.pendingSecondDrawSource==='discard', 'pending state correctly flags discard as the source');
  assert(state.turnPhase==='draw', 'still in draw phase, not jumped to meld');

  // attempting to "complete" with another discard pickup should be rejected
  state.discardPile = [c('K','♦')]; // simulate something new appearing (shouldn't happen in reality, just testing the guard)
  const rBad = completeDrawSecondDiscard(state, 'p0');
  assert(!rBad.ok, 'cannot take a second discard card after already taking one this turn');

  const r2 = completeDrawSecondStock(state, 'p0');
  assert(r2.ok, 'completing with a stock draw succeeds');
  assert(state.turnPhase==='meld' && state.turnHasDrawn, 'turn correctly advances to meld only after the stock draw completes it');
  assert(state.pendingSecondDrawSource===null, 'pendingSecondDrawSource cleared after completing');
}

// ---- discard-first blocked by black-3 freeze, and blocked when already drawn ----
{
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('D2','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  state.discardPile = [c('9','♠'), c('3','♠')]; // top is black 3
  const r = drawDiscardFirst(state, 'p0');
  assert(!r.ok, 'drawDiscardFirst blocked when pile frozen by black 3');

  const state2 = newRoomState('D3','p0','A');
  state2.players=players; state2.turnOrder=['p0','p1'];
  dealGame(state2);
  state2.discardPile=[c('9','♠')];
  drawTwoStock(state2,'p0'); // already drew this turn
  const r2 = drawDiscardFirst(state2,'p0');
  assert(!r2.ok, 'drawDiscardFirst blocked if the turn already has a completed draw');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
