const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'l'+Math.random(), rank, suit});

function freshState(){
  const players=[{id:'p0',name:'Al'},{id:'p1',name:'B'}];
  const state = newRoomState('LG1','p0','Al');
  state.players=players; state.turnOrder=['p0','p1'];
  dealGame(state);
  return state;
}

// ---- Starting a brand new meld logs "started a new X meld" ----
{
  const state = freshState();
  state.initialMeldMet['p0']=true;
  const nines = [c('9'),c('9'),c('9')];
  const spare = c('4');
  state.hands['p0'] = [...nines, spare];
  commitMeldGroupsNow(state, 'p0', [nines.map(x=>x.id)]);
  const last = state.log[state.log.length-1];
  assert(last.includes('started a new 9 meld'), `new meld logs correctly: "${last}"`);
  assert(!last.includes('added'), 'does not say "added" for a brand-new meld');
}

// ---- Adding to an existing meld logs "added N card(s) to their X meld" ----
{
  const state = freshState();
  state.initialMeldMet['p0']=true;
  state.melds['p0'] = [{rank:'K', cards:[c('K'),c('K'),c('K')], type:'clean', isCanasta:false}];
  const king = c('K'), spare = c('4');
  state.hands['p0'] = [king, spare];
  commitMeldGroupsNow(state, 'p0', [[king.id]]);
  const last = state.log[state.log.length-1];
  assert(last.includes('added 1 card to their K meld'), `addition logs correctly: "${last}"`);
  assert(!last.includes('started a new'), 'does not say "started a new" when adding to an existing meld');
}

// ---- Multiple groups in one action produce a combined, correctly distinguished message ----
{
  const state = freshState();
  state.initialMeldMet['p0']=true;
  state.melds['p0'] = [{rank:'K', cards:[c('K'),c('K'),c('K')], type:'clean', isCanasta:false}];
  const king = c('K'), sevens = [c('7'),c('7'),c('7')], spare = c('4');
  state.hands['p0'] = [king, ...sevens, spare];
  commitMeldGroupsNow(state, 'p0', [[king.id], sevens.map(x=>x.id)]);
  const last = state.log[state.log.length-1];
  assert(last.includes('added 1 card to their K meld') && last.includes('started a new 7 meld'),
    `combined action logs both correctly: "${last}"`);
}

// ---- Matched pickup: mandatory meld correctly distinguishes new vs existing ----
{
  const state = freshState();
  state.initialMeldMet['p0']=true;
  state.discardPile = [c('4'),c('J')]; // top = J
  const jacks = [c('J'), c('J')], spare = c('4');
  state.hands['p0'] = [...jacks, spare];
  matchedPickupCommit(state, 'p0', jacks.map(x=>x.id), []);
  let last = state.log[state.log.length-1];
  assert(last.includes('started a new J meld'), `pickup mandatory meld (brand new) logs correctly: "${last}"`);

  // now do it again where p0 already HAS a J meld -> should say "added"
  const state2 = freshState();
  state2.initialMeldMet['p0']=true;
  state2.melds['p0'] = [{rank:'J', cards:[c('J'),c('J'),c('J')], type:'clean', isCanasta:false}];
  state2.discardPile = [c('4'),c('J')];
  const jacks2 = [c('J'), c('J')], spare2 = c('4');
  state2.hands['p0'] = [...jacks2, spare2];
  matchedPickupCommit(state2, 'p0', jacks2.map(x=>x.id), []);
  last = state2.log[state2.log.length-1];
  assert(last.includes('added 3 card') && last.includes('their J meld'), `pickup mandatory meld (addition) logs correctly: "${last}"`);
}

// ---- confirmInitialMelds: unaffected, still uses its own summary phrasing ----
{
  const state = freshState();
  const kings = [c('K'),c('K'),c('K'),c('K'),c('K')], spare = c('4'); // 5*10=50, meets hand 1's threshold
  state.hands['p0'] = [...kings, spare];
  confirmInitialMelds(state, 'p0', [kings.map(x=>x.id)]);
  const last = state.log[state.log.length-1];
  assert(last.includes('laid their initial meld'), `confirmInitialMelds keeps its own summary phrasing: "${last}"`);
}

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
