const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'w'+Math.random(), rank, suit});
const two = (suit)=>({id:'w'+Math.random(), rank:'2', suit});
const jkr = ()=>({id:'w'+Math.random(), rank:'JOKER', suit:null});

// ---- wild canasta validation ----
{
  const wilds3 = [two('♠'), two('♥'), jkr()];
  const v = validateMeldGroup(wilds3);
  assert(v.ok && v.rank==='WILD', 'a group of only 2s/Jokers validates as a WILD meld');

  const mixedBad = [two('♠'), c('7','♠'), two('♥')]; // 1 natural, 2 wilds -> ratio fails
  const v2 = validateMeldGroup(mixedBad);
  assert(!v2.ok, 'mixed group with wilds >= naturals still rejected as before');

  const zeroCards = [];
  const v3 = validateMeldGroup(zeroCards);
  assert(!v3.ok, 'empty selection rejected');
}

// ---- wild canasta application: type=clean, isCanasta at 7, scoring bonus 1500 ----
{
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('W1','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);

  const sevenWilds = [two('♠'),two('♥'),two('♦'),two('♣'),jkr(),jkr(),two('♠')]; // 5 twos + 2 jokers = 7
  applyMeldToBoard(state, 'p0', sevenWilds);
  const m = state.melds['p0'].find(x=>x.rank==='WILD');
  assert(!!m, 'wild meld created on board');
  assert(m.cards.length===7, 'wild meld has 7 cards');
  assert(m.isCanasta===true, 'wild meld with 7 cards flagged as canasta');
  assert(m.type==='clean', "wild canasta type is 'clean' per house rule");

  // canastaReqsMet: a WILD canasta alone should satisfy the 'clean' side (still needs a dirty elsewhere)
  assert(canastaReqsMet(state,'p0')===false, 'wild canasta alone is not enough to go out (still need a dirty canasta)');
  state.melds['p0'].push({rank:'9', cards:[c('9','♠'),c('9','♥'),c('9','♦'),c('9','♣'),c('9','♠'),{id:'x1',rank:'2',suit:'♣'},{id:'x2',rank:'2',suit:'♦'}], type:'dirty', isCanasta:true});
  assert(canastaReqsMet(state,'p0')===true, 'wild (clean) canasta + separate dirty canasta satisfies going-out requirement');

  // scoring: 5 twos (20 each=100) + 2 jokers (50 each=100) = 200 face value + 1500 bonus = 1700 for the wild meld
  state.hands['p0']=[]; state.feet['p0']=[]; state.footOpen['p0']=true; state.redThrees['p0']=[];
  state.hands['p1']=[]; state.feet['p1']=[]; state.footOpen['p1']=true; state.redThrees['p1']=[]; state.melds['p1']=[];
  scoreRoundEnd(state, 'p0');
  const naturalMeldValue = 5*10 + 2*20; // nine-meld: 5 naturals@10 + 2 wild twos@20
  const wildMeldValue = 5*20 + 2*50; // 5 twos + 2 jokers
  const expected = wildMeldValue + 1500 + naturalMeldValue + 100; // +100 dirty canasta bonus
  assert(state.scores['p0'][0]===expected, `wild canasta scored correctly (${state.scores['p0'][0]} === ${expected})`);
}

// ---- new wild meld still needs >=3 cards to start ----
{
  const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
  const state = newRoomState('W2','p0','A');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  state.hands['p0'] = [two('♠'), two('♥')]; // only 2 wilds
  const r = tryAddMeldGroup(state, 'p0', [state.hands['p0'][0].id, state.hands['p0'][1].id]);
  assert(!r.ok, 'starting a new wild meld with only 2 cards is rejected (needs 3 minimum, same as any new meld)');
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
