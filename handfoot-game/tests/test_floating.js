const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'f'+Math.random(), rank, suit});

function freshState(){
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('FL1','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  return state;
}

// Case 1: 0 cards, foot open, no canasta reqs met -> floating
{
  const state = freshState();
  state.hands['p0'] = [];
  state.footOpen['p0'] = true;
  state.melds['p0'] = [];
  assert(isFloating(state,'p0')===true, 'true positive: 0 hand, foot open, no canastas -> floating');
}

// Case 2: 0 cards but foot NOT yet opened -> not floating (they just have an empty hand mid-turn, foot still to come)
{
  const state = freshState();
  state.hands['p0'] = [];
  state.footOpen['p0'] = false;
  state.melds['p0'] = [];
  assert(isFloating(state,'p0')===false, 'not floating: hand empty but foot not opened yet');
}

// Case 3: 0 cards, foot open, but DOES meet canasta reqs -> not floating (they've actually gone out, round should be ending, not "floating")
{
  const state = freshState();
  state.hands['p0'] = [];
  state.footOpen['p0'] = true;
  state.melds['p0'] = [
    {rank:'7', cards:[c('7'),c('7'),c('7'),c('7'),c('7'),c('7'),c('7')], type:'clean', isCanasta:true},
    {rank:'9', cards:[c('9'),c('9'),c('9'),c('9'),c('9'),{id:'w',rank:'2',suit:'♣'},{id:'w2',rank:'2',suit:'♦'}], type:'dirty', isCanasta:true},
  ];
  assert(isFloating(state,'p0')===false, 'not floating: 0 cards + foot open BUT canasta reqs already met (this is actually a valid go-out, not floating)');
}

// Case 4: has cards in hand -> never floating regardless of foot/canasta status
{
  const state = freshState();
  state.hands['p0'] = [c('4')];
  state.footOpen['p0'] = true;
  state.melds['p0'] = [];
  assert(isFloating(state,'p0')===false, 'not floating: still has a card in hand');
}

// Case 5: only 1 of the 2 required canasta types present (e.g. only clean, no dirty) -> still floating
{
  const state = freshState();
  state.hands['p0'] = [];
  state.footOpen['p0'] = true;
  state.melds['p0'] = [
    {rank:'7', cards:[c('7'),c('7'),c('7'),c('7'),c('7'),c('7'),c('7')], type:'clean', isCanasta:true},
  ];
  assert(isFloating(state,'p0')===true, 'still floating: has a clean canasta but no dirty one yet, requirement not fully met');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
