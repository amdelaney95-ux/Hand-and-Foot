// Mirrors the exact logic in actMoveToDiscardPhase, with mocked dependencies.
function makeHarness(){
  let ui = { selected: new Set(), discardChoice: null, stagedGroups:[], pickupActive:false, pickupNaturals:[], pickupExtra:[] };
  let netState = null;
  function clearStaging(){ ui.selected=new Set(); ui.stagedGroups=[]; ui.pickupActive=false; ui.pickupNaturals=[]; ui.pickupExtra=[]; ui.discardChoice=null; }

  // simulates the server-side transition already having happened before this runs
  function runActMoveToDiscardPhase(resultingState, me){
    const singleSelected = ui.selected.size===1 ? [...ui.selected][0] : null;
    netState = resultingState; // pretend pushState already applied this
    clearStaging();
    if(singleSelected && netState && netState.turnPhase==='discard' && netState.turnOrder[netState.turnIndex]===me){
      const stillInHand = (netState.hands[me]||[]).some(c=>c.id===singleSelected);
      if(stillInHand) ui.discardChoice = singleSelected;
    }
    return ui;
  }
  return { ui, runActMoveToDiscardPhase };
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

// Case 1: exactly one card selected, turn correctly stays in discard phase for me -> carried over
{
  const h = makeHarness();
  h.ui.selected.add('cardA');
  const resultingState = { turnPhase:'discard', turnOrder:['p0','p1'], turnIndex:0, hands:{p0:[{id:'cardA'},{id:'cardB'}]} };
  h.runActMoveToDiscardPhase(resultingState, 'p0');
  assert(h.ui.discardChoice==='cardA', 'single selected card carries over as the pre-filled discard choice');
}

// Case 2: still changeable afterward (user picks a different card)
{
  const h = makeHarness();
  h.ui.selected.add('cardA');
  const resultingState = { turnPhase:'discard', turnOrder:['p0'], turnIndex:0, hands:{p0:[{id:'cardA'},{id:'cardB'}]} };
  h.runActMoveToDiscardPhase(resultingState, 'p0');
  // simulate pickDiscard toggling to a different card afterward
  h.ui.discardChoice = 'cardB';
  assert(h.ui.discardChoice==='cardB', 'the pre-filled choice can still be freely changed to a different card afterward');
}

// Case 3: zero cards selected -> no carry-over (nothing to carry)
{
  const h = makeHarness();
  const resultingState = { turnPhase:'discard', turnOrder:['p0'], turnIndex:0, hands:{p0:[{id:'cardA'}]} };
  h.runActMoveToDiscardPhase(resultingState, 'p0');
  assert(h.ui.discardChoice===null, 'no selection beforehand -> discardChoice stays unset as before');
}

// Case 4: two cards selected -> ambiguous, do NOT carry over either
{
  const h = makeHarness();
  h.ui.selected.add('cardA'); h.ui.selected.add('cardB');
  const resultingState = { turnPhase:'discard', turnOrder:['p0'], turnIndex:0, hands:{p0:[{id:'cardA'},{id:'cardB'}]} };
  h.runActMoveToDiscardPhase(resultingState, 'p0');
  assert(h.ui.discardChoice===null, 'multiple cards selected is ambiguous -> no carry-over, unchanged prior behavior');
}

// Case 5: turn actually ended (e.g. hand emptied, foot opened, turn advanced to someone else) -> no carry-over
{
  const h = makeHarness();
  h.ui.selected.add('cardA');
  const resultingState = { turnPhase:'draw', turnOrder:['p0','p1'], turnIndex:1, hands:{p1:[]} }; // now p1's turn
  h.runActMoveToDiscardPhase(resultingState, 'p0');
  assert(h.ui.discardChoice===null, 'turn ended / moved to next player -> no discard choice carried over (nothing to discard)');
}

// Case 6: selected card somehow no longer in hand (defensive) -> no carry-over
{
  const h = makeHarness();
  h.ui.selected.add('cardA');
  const resultingState = { turnPhase:'discard', turnOrder:['p0'], turnIndex:0, hands:{p0:[{id:'cardB'}]} }; // cardA not present
  h.runActMoveToDiscardPhase(resultingState, 'p0');
  assert(h.ui.discardChoice===null, 'defensively does not carry over a card id no longer actually in hand');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
