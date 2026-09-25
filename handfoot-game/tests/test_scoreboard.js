const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));
let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const c = (rank,suit)=>({id:'s'+Math.random(), rank, suit});

const players=[{id:'p0',name:'A'},{id:'p1',name:'B'}];
const state = newRoomState('SB1','p0','A');
state.players=players; state.turnOrder=['p0','p1'];
dealGame(state);

// ---- Hand 1: p0 goes out with a small clean canasta ----
state.melds['p0'] = [{rank:'7', cards:[c('7'),c('7'),c('7'),c('7'),c('7'),c('7'),c('7')], type:'clean', isCanasta:true}];
state.melds['p1'] = [];
state.hands['p0']=[]; state.feet['p0']=[]; state.footOpen['p0']=true; state.redThrees['p0']=[];
state.hands['p1']=[c('K')]; state.feet['p1']=[]; state.footOpen['p1']=true; state.redThrees['p1']=[];
scoreRoundEnd(state, 'p0');

assert(state.roundBreakdowns[1] !== undefined, 'roundBreakdowns[1] exists after hand 1 scores');
assert(state.roundBreakdowns[1]['p0'].total === 35+300, `hand 1 breakdown for p0 is correct (${state.roundBreakdowns[1]['p0'].total})`);
assert(state.scores['p0'][0] === 35+300, 'scores array still populated as before');

// ---- advance to hand 2, score it differently ----
goToNextHandOrEnd(state);
assert(state.round===2, 'advanced to round 2');
state.melds['p0'] = [];
state.melds['p1'] = [{rank:'9', cards:[c('9'),c('9'),c('9'),c('9'),c('9'),{id:'w',rank:'2',suit:'♣'},{id:'w2',rank:'JOKER',suit:null}], type:'dirty', isCanasta:true}];
state.hands['p1']=[]; state.feet['p1']=[]; state.footOpen['p1']=true; state.redThrees['p1']=[];
state.hands['p0']=[c('4')]; state.feet['p0']=[]; state.footOpen['p0']=true; state.redThrees['p0']=[];
scoreRoundEnd(state, 'p1');

assert(state.roundBreakdowns[1] !== undefined, 'hand 1 breakdown is STILL there after hand 2 scores (not overwritten)');
assert(state.roundBreakdowns[2] !== undefined, 'hand 2 breakdown now also exists');
assert(state.roundBreakdowns[1]['p0'].total === 335, 'hand 1 breakdown data is unchanged/still correct');
const expectedH2 = (5*10 + 20 + 50) + 100; // 5 naturals@10 + wild2(20) + joker(50), +100 dirty bonus
assert(state.roundBreakdowns[2]['p1'].total === expectedH2, `hand 2 breakdown for p1 is correct (${state.roundBreakdowns[2]['p1'].total} === ${expectedH2})`);

// ---- rankings ----
const rankings = computeRankingsTest(state);
function computeRankingsTest(s){
  const rows = s.turnOrder.map(pid=>{
    const rounds = s.scores[pid]||[null,null,null,null];
    const total = rounds.filter(v=>v!=null).reduce((a,b)=>a+b,0);
    return {pid, rounds, total};
  });
  rows.sort((a,b)=>b.total-a.total);
  let rank=0, prevTotal=null;
  rows.forEach((r,i)=>{ if(r.total!==prevTotal){ rank=i+1; prevTotal=r.total; } r.rank=r.rank; r.rank=rank; });
  return rows;
}
const r = computeRankingsTest(state);
assert(r[0].pid==='p0' && r[0].rank===1 && r[0].total===330, `p0 correctly ranked 1st with the higher total (330 vs p1's 210) (${JSON.stringify(r.map(x=>[x.pid,x.total,x.rank]))})`);
assert(r[1].pid==='p1' && r[1].rank===2 && r[1].total===210, 'p1 correctly ranked 2nd');

// ---- tie handling ----
state.scores['p0'] = [100, null, null, null];
state.scores['p1'] = [100, null, null, null];
const rTie = computeRankingsTest(state);
assert(rTie[0].rank===1 && rTie[1].rank===1, 'tied totals both get rank 1 (dense/competition ranking, no arbitrary tiebreak)');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
