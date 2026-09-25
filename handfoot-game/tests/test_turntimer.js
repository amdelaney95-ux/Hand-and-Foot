const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }

function freshState(){
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('TT1','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  return state;
}

// turnStartedAt set on deal
{
  const before = Date.now();
  const state = freshState();
  assert(typeof state.turnStartedAt === 'number', 'turnStartedAt is set after dealGame');
  assert(state.turnStartedAt >= before, 'turnStartedAt is a recent timestamp');
}

// turnStartedAt resets on advanceTurn
{
  const state = freshState();
  const firstStart = state.turnStartedAt;
  // simulate some time passing
  state.turnStartedAt -= 5000;
  advanceTurn(state);
  assert(state.turnStartedAt > (firstStart - 5000), 'turnStartedAt is refreshed to a new timestamp on advanceTurn');
  assert(Date.now() - state.turnStartedAt < 1000, 'new turnStartedAt is essentially "now"');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
