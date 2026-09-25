function formatElapsed(ms){
  const totalSec = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(totalSec/60);
  const sec = totalSec%60;
  return `${m}:${sec<10?'0':''}${sec}`;
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

assert(formatElapsed(0)==='0:00', 'zero elapsed formats as 0:00');
assert(formatElapsed(5000)==='0:05', '5 seconds formats as 0:05');
assert(formatElapsed(65000)==='1:05', '65 seconds formats as 1:05');
assert(formatElapsed(600000)==='10:00', '10 minutes formats as 10:00');
assert(formatElapsed(-500)==='0:00', 'negative/clock-skew elapsed clamps to 0:00, no crash or negative display');

// ---- Chime trigger diff logic ----
let ui = { lastKnownActivePid:null, lastKnownTotalRedThrees:null };
const me = { id:'p0' };
let chimesPlayed = [];
function playTurnChime(){ chimesPlayed.push('turn'); }
function playRedThreeChime(){ chimesPlayed.push('red3'); }

function checkForTurnStartChime(s){
  if(!s || s.phase!=='playing') return;
  const activePid = s.turnOrder[s.turnIndex];
  if(ui.lastKnownActivePid !== null && activePid===me.id && ui.lastKnownActivePid!==me.id){
    playTurnChime();
  }
  ui.lastKnownActivePid = activePid;
}
function checkForRedThreeChime(s){
  if(!s) return;
  const total = s.turnOrder.reduce((sum,pid)=>sum+((s.redThrees[pid]||[]).length), 0);
  if(ui.lastKnownTotalRedThrees !== null && total > ui.lastKnownTotalRedThrees){
    playRedThreeChime();
  }
  ui.lastKnownTotalRedThrees = total;
}

// First observation (page just loaded): establishes baseline, no chime even though it's already my turn
let s = { phase:'playing', turnOrder:['p0','p1'], turnIndex:0, redThrees:{p0:[],p1:[]} };
checkForTurnStartChime(s);
checkForRedThreeChime(s);
assert(chimesPlayed.length===0, 'no chime fires on initial page load, even if it happens to already be my turn');

// Turn passes to p1, then back to p0 -> chime fires exactly once, on the transition TO me
s.turnIndex = 1; // now p1's turn
checkForTurnStartChime(s);
assert(chimesPlayed.length===0, 'no chime when turn moves to someone else');
s.turnIndex = 0; // back to p0
checkForTurnStartChime(s);
assert(chimesPlayed.length===1 && chimesPlayed[0]==='turn', 'turn chime fires exactly once when it becomes my turn again');

// polling again with no change -> no duplicate chime
checkForTurnStartChime(s);
assert(chimesPlayed.length===1, 'no duplicate chime on repeated polls with no actual change');

// Someone draws a red 3 (opponent) -> chime fires for everyone watching, including me
s.redThrees.p1.push({id:'r1'});
checkForRedThreeChime(s);
assert(chimesPlayed.length===2 && chimesPlayed[1]==='red3', 'red-3 chime fires when an opponent draws one (detected via poll)');

// I draw one too -> fires again (correctly incremental, not double-counting the prior one)
s.redThrees.p0.push({id:'r2'});
checkForRedThreeChime(s);
assert(chimesPlayed.length===3 && chimesPlayed[2]==='red3', 'red-3 chime fires again for a second, separate red 3');

// New round resets the underlying count lower -> no bogus chime on the way down
s.redThrees = {p0:[], p1:[]};
checkForRedThreeChime(s);
assert(chimesPlayed.length===3, 'dropping back to 0 at a new hand does not itself trigger a chime');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
