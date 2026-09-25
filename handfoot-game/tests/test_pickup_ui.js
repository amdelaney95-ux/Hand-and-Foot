// Simulates the click-routing logic for hand cards while ui.pickupActive is true,
// mirroring the fixed code exactly, to prove the exact reported scenario now works:
// "enough points in hand INCLUDING the pickup to lay initial meld, but couldn't select
// the other hand cards to complete it."

let ui = { pickupActive:false, pickupNaturals:[], pickupExtra:[], selected:new Set() };

function routeClick(cardId){
  const pickupCommittedIds = new Set(ui.pickupExtra.flat());
  if(ui.pickupNaturals.includes(cardId)){
    return 'toggle-natural';
  } else if(pickupCommittedIds.has(cardId)){
    return 'locked-disabled';
  } else if(ui.pickupNaturals.length < 2){
    return 'toggle-natural';
  } else {
    return 'toggle-select';
  }
}
function confirmPickupNaturalPick(cardId){
  if(ui.pickupNaturals.includes(cardId)){ ui.pickupNaturals = ui.pickupNaturals.filter(x=>x!==cardId); }
  else if(ui.pickupNaturals.length<2){ ui.pickupNaturals.push(cardId); }
}
function toggleSelect(cardId){
  if(ui.selected.has(cardId)) ui.selected.delete(cardId); else ui.selected.add(cardId);
}
function click(cardId){
  const route = routeClick(cardId);
  if(route==='toggle-natural') confirmPickupNaturalPick(cardId);
  else if(route==='toggle-select') toggleSelect(cardId);
  return route;
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

// User's scenario: hand has 2 natural 10s to match discard, plus 4 Kings they want to
// ALSO stage as an extra meld to reach the initial-meld threshold together with the pickup.
ui.pickupActive = true;
const r1 = click('ten-A'); // pick first natural
assert(r1==='toggle-natural' && ui.pickupNaturals.includes('ten-A'), 'first click on a natural routes to pair-selection');
const r2 = click('ten-B'); // pick second natural
assert(r2==='toggle-natural' && ui.pickupNaturals.length===2, 'second click completes the pair');

// THE BUG: previously, clicking a THIRD card (e.g. a King, unrelated to the pair) did
// nothing useful because everything routed to confirmPickupNaturalPick, which ignores
// clicks once the pair is full. Now it should route to toggleSelect instead.
const r3 = click('king-1');
assert(r3==='toggle-select', 'clicking a 3rd card once the pair is complete now routes to toggleSelect (THE FIX)');
assert(ui.selected.has('king-1'), 'that card is now actually selected, ready to be staged as an extra meld');

const r4 = click('king-2');
const r5 = click('king-3');
const r6 = click('king-4');
assert(ui.selected.size===4, 'can keep selecting further cards (all 4 kings) toward the extra meld — this is exactly what was previously impossible');

// Clicking one of the already-chosen naturals again still lets you change your pair
const r7 = click('ten-A');
assert(r7==='toggle-natural' && !ui.pickupNaturals.includes('ten-A'), 'clicking an already-chosen natural still deselects it, preserving that flexibility');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
