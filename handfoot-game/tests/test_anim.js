// Minimal stand-alone test of the pure logic (no DOM needed).
let renderCallCount = 0;
function render(){ renderCallCount++; }

let ui = {
  drawAnimation:null, dealAnimation:null,
  lastSeenPhase:null, lastSeenRound:null,
};
const DRAW_ANIM_MS = 1500;
const DEAL_ANIM_MS = 2400;

function checkForDealTransition(s){
  if(!s) return;
  const freshDeal = s.phase==='playing' && (ui.lastSeenPhase!=='playing' || ui.lastSeenRound!==s.round);
  if(freshDeal){
    ui.dealAnimation = {startedAt: Date.now()};
  }
  ui.lastSeenPhase = s.phase;
  ui.lastSeenRound = s.round;
  return freshDeal;
}
function renderDrawOverlay(){
  if(!ui.drawAnimation) return '';
  const elapsed = Date.now() - ui.drawAnimation.startedAt;
  if(elapsed > DRAW_ANIM_MS) return '';
  return `<div class="draw-overlay">shown</div>`;
}
function renderDealOverlay(s){
  if(!ui.dealAnimation) return '';
  const elapsed = Date.now() - ui.dealAnimation.startedAt;
  if(elapsed > DEAL_ANIM_MS) return '';
  return `<div class="deal-overlay">shown</div>`;
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

// 1. Lobby -> playing triggers exactly once
let s = {phase:'lobby', round:1};
let fired = checkForDealTransition(s);
assert(!fired, 'no trigger while still in lobby');

s = {phase:'playing', round:1};
fired = checkForDealTransition(s);
assert(fired===true, 'transition from lobby to playing triggers the deal animation');
assert(renderDealOverlay(s).includes('shown'), 'deal overlay renders immediately after trigger');

// 2. Repeated polls in the SAME phase/round do NOT re-trigger
fired = checkForDealTransition(s);
assert(fired===false, 'polling again with same phase/round does not re-trigger');
fired = checkForDealTransition(s);
assert(fired===false, 'still no re-trigger on a third identical poll');

// 3. Round change DOES trigger again (hand 2 dealt)
ui.dealAnimation = null; // simulate it having expired from hand 1
s = {phase:'roundEnd', round:1};
checkForDealTransition(s);
s = {phase:'playing', round:2};
fired = checkForDealTransition(s);
assert(fired===true, 'round advancing to hand 2 triggers a fresh deal animation');

// 4. Overlay expires after its duration even without an explicit clear
ui.dealAnimation = {startedAt: Date.now() - (DEAL_ANIM_MS + 500)}; // simulate time having passed
assert(renderDealOverlay(s)==='', 'deal overlay stops rendering once elapsed time exceeds its duration, even if never explicitly nulled');

ui.drawAnimation = {startedAt: Date.now() - (DRAW_ANIM_MS + 500), cards:[{id:'x'}]};
assert(renderDrawOverlay()==='', 'draw overlay likewise expires on its own via elapsed-time check');

// 5. A fresh, non-expired animation still renders
ui.drawAnimation = {startedAt: Date.now(), cards:[{id:'x'}]};
assert(renderDrawOverlay().includes('shown'), 'a just-started draw overlay renders normally');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
