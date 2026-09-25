const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'u'+Math.random(), rank, suit});

function freshState(){
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('U1','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  return state;
}

// ---- Core case: undo reverses the phase flip and nothing else ----
{
  const state = freshState();
  drawTwoStock(state, 'p0'); // -> turnPhase = 'meld'
  assert(state.turnPhase==='meld', 'sanity: in meld phase after drawing');
  const handSnapshot = JSON.stringify(state.hands['p0']);
  const meldsSnapshot = JSON.stringify(state.melds['p0']);
  const drawPileSnapshot = state.drawPile.length;

  const r1 = afterMeldCheckAndAdvance(state, 'p0'); // simulates clicking "Skip melding -> discard"
  assert(state.turnPhase==='discard', 'entered discard phase (misclick scenario)');

  const r2 = undoToMeldPhase(state, 'p0');
  assert(r2.ok, 'undo succeeds');
  assert(state.turnPhase==='meld', 'back in meld phase');
  assert(JSON.stringify(state.hands['p0'])===handSnapshot, 'hand is byte-for-byte unchanged by the round trip');
  assert(JSON.stringify(state.melds['p0'])===meldsSnapshot, 'melds unchanged');
  assert(state.drawPile.length===drawPileSnapshot, 'draw pile unchanged');
  assert(state.turnIndex===0 && state.turnOrder[state.turnIndex]==='p0', 'still the same players turn, nothing advanced');
}

// ---- Safety boundary 1: cannot undo once a real discard has actually happened ----
{
  const state = freshState();
  drawTwoStock(state, 'p0');
  afterMeldCheckAndAdvance(state, 'p0'); // -> discard phase
  const cardToDiscard = state.hands['p0'][0].id;
  performDiscard(state, 'p0', cardToDiscard); // actually discards -> turn ends, advances to p1
  assert(state.turnOrder[state.turnIndex]==='p1', 'turn correctly advanced to p1 after the real discard');

  const r = undoToMeldPhase(state, 'p0');
  assert(!r.ok, 'undo correctly rejected once a real discard has already happened and the turn moved on');
}

// ---- Safety boundary 2: cannot undo when not actually in discard phase ----
{
  const state = freshState();
  drawTwoStock(state, 'p0'); // meld phase, never entered discard
  const r = undoToMeldPhase(state, 'p0');
  assert(!r.ok, 'undo rejected when not currently in discard phase (nothing to undo)');
}

// ---- Safety boundary 3: cannot undo on someone else's turn ----
{
  const state = freshState();
  drawTwoStock(state, 'p0');
  afterMeldCheckAndAdvance(state, 'p0'); // p0 is in discard phase
  const r = undoToMeldPhase(state, 'p1'); // p1 tries to undo p0's phase
  assert(!r.ok, 'a different player cannot undo — rejected as not their turn');
  assert(state.turnPhase==='discard', "p0's phase is unaffected by p1's rejected attempt");
}

// ---- Repeatable: can toggle meld <-> discard multiple times without side effects ----
{
  const state = freshState();
  drawTwoStock(state, 'p0');
  const handSnapshot = JSON.stringify(state.hands['p0']);
  for(let i=0;i<3;i++){
    afterMeldCheckAndAdvance(state, 'p0');
    undoToMeldPhase(state, 'p0');
  }
  assert(state.turnPhase==='meld', 'ends back in meld phase after several toggles');
  assert(JSON.stringify(state.hands['p0'])===handSnapshot, 'hand still unchanged after repeated toggling (no exploitable side effect)');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
