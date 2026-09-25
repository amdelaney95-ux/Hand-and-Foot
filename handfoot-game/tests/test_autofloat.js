const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'af'+Math.random(), rank, suit});

function freshState(){
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'},{id:'p2',name:'C'}];
  const state = newRoomState('AF1','p0','A');
  state.players=players; state.turnOrder=['p0','p1','p2'];
  dealGame(state);
  return state;
}

// ---- via matched pickup: melding the mandatory pair empties hand while floating -> auto-ends ----
{
  const state = freshState();
  state.turnIndex = 0;
  state.melds['p0'] = [{rank:'K', cards:[c('K'),c('K'),c('K')], type:'clean', isCanasta:false}]; // no canasta yet
  state.initialMeldMet['p0'] = true;
  state.footOpen['p0'] = true;
  state.feet['p0'] = [];
  state.discardPile = [c('K')]; // just the top card — mandatory meld consumes it, nothing extra comes to hand
  const naturals = [c('K'), c('K')];
  state.hands['p0'] = naturals; // exactly the 2 cards used for the mandatory meld, nothing else
  const res = matchedPickupCommit(state, 'p0', naturals.map(x=>x.id), []);
  assert(res.ok, 'pickup succeeds');
  // hand should now hold whatever remained of the discard pile (0 extra cards here, pile had exactly 2)
  assert(state.hands['p0'].length===0, 'hand ends up empty (pile had nothing left beyond the mandatory 2+top)');
  assert(state.turnIndex===1, 'turn auto-advances to p1 rather than leaving p0 stuck floating');
}

// ---- via confirmInitialMelds path: cannot happen (melds always empty at that point), sanity check unaffected ----
{
  const state = freshState();
  const kings = [c('K'),c('K'),c('K'),c('K'),c('K')]; // exactly 50, meets hand 1 threshold, empties whole hand
  state.hands['p0'] = kings;
  state.footOpen['p0'] = false; // hasn't opened foot yet this round
  state.turnIndex = 0;
  const res = confirmInitialMelds(state, 'p0', [kings.map(x=>x.id)]);
  assert(res.ok, 'initial meld succeeds');
  // hand emptied but foot NOT yet open -> should open foot and CONTINUE the turn, not end it
  assert(state.footOpen['p0']===true, 'foot opened as a result of emptying the original hand');
  assert(state.turnIndex===0, 'turn does NOT auto-end here — opening the foot correctly continues the turn, per existing behavior');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
