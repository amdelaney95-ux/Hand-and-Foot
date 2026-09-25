// opponentTurnOrder lives in the RENDERING section of handfoot.html, not the engine section,
// so tests/extract-engine.py doesn't pick it up and the engine suites never touch it.
// This mirrors it exactly and tests it directly.

function opponentTurnOrder(turnOrder, myId){
  const i = turnOrder.indexOf(myId);
  if(i < 0) return turnOrder.slice();
  return turnOrder.slice(i+1).concat(turnOrder.slice(0, i));
}

let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);

// ---- The documented example: [A, me, B, C] -> [B, C, A] ----
{
  const out = opponentTurnOrder(['A','me','B','C'], 'me');
  assert(eq(out, ['B','C','A']), `documented case wraps correctly (got ${JSON.stringify(out)})`);
  assert(!out.includes('me'), 'excludes yourself');
  assert(out.length === 3, 'returns exactly the other players, no duplicates or omissions');
}

// ---- You are first in turn order ----
{
  const out = opponentTurnOrder(['me','A','B','C'], 'me');
  assert(eq(out, ['A','B','C']), `first seat needs no wrap (got ${JSON.stringify(out)})`);
}

// ---- You are last in turn order (full wrap) ----
{
  const out = opponentTurnOrder(['A','B','C','me'], 'me');
  assert(eq(out, ['A','B','C']), `last seat wraps all the way around (got ${JSON.stringify(out)})`);
}

// ---- Two players ----
{
  const out = opponentTurnOrder(['me','A'], 'me');
  assert(eq(out, ['A']), 'two-player game returns the single opponent');
  const out2 = opponentTurnOrder(['A','me'], 'me');
  assert(eq(out2, ['A']), 'two-player game, other seat order, same result');
}

// ---- Max table size, every seat position produces a valid ordering ----
{
  const order = ['p0','p1','p2','p3','p4','p5'];
  for(const myId of order){
    const out = opponentTurnOrder(order, myId);
    assert(out.length === 5, `6-player table, seated at ${myId}: exactly 5 opponents returned`);
    assert(!out.includes(myId), `6-player table, seated at ${myId}: self excluded`);
    assert(new Set(out).size === 5, `6-player table, seated at ${myId}: no duplicates`);
    // the first entry must be the player immediately after you, wrapping
    const expectedNext = order[(order.indexOf(myId)+1) % order.length];
    assert(out[0] === expectedNext, `6-player table, seated at ${myId}: first chip is the next player (${expectedNext})`);
  }
}

// ---- Anchored to YOU, not the active player: result is stable all hand long ----
{
  const order = ['A','me','B','C'];
  const first = opponentTurnOrder(order, 'me');
  // whoever's turn it is has no bearing on this function — it takes no active-player argument
  for(let i=0;i<10;i++){
    assert(eq(opponentTurnOrder(order, 'me'), first), 'ordering is stable across repeated calls (chips never reshuffle mid-hand)');
    if(i>0) break; // one repeat is enough to make the point without spamming output
  }
}

// ---- Defensive: not in turn order (spectator / pre-deal) returns the list untouched ----
{
  const order = ['A','B','C'];
  const out = opponentTurnOrder(order, 'someone-else');
  assert(eq(out, ['A','B','C']), 'unknown id returns turnOrder unchanged rather than mangling it via indexOf -1');
  assert(out !== order, 'returns a copy, not the original array reference (no accidental mutation of shared state)');
}

// ---- Empty turn order (pre-deal lobby) ----
{
  const out = opponentTurnOrder([], 'me');
  assert(eq(out, []), 'empty turn order returns empty, no crash');
  assert((out[0] || null) === null, 'nextPid resolves to null when there are no opponents (guards the discard prompt)');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
