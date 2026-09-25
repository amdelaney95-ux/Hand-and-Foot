function esc(s){ return String(s); }
function isWild(c){ return c.rank==='2' || c.rank==='JOKER'; }
function meldRankLabel(rank){ return rank==='WILD' ? '★ Wild' : rank; }

function renderOppMeldChip(m){
  const label = esc(meldRankLabel(m.rank));
  if(m.isCanasta){
    if(m.rank==='WILD'){
      return `<span class="rankchip done" style="color:var(--brass-bright)">${label} ${m.cards.length}</span>`;
    }
    const cls = m.type==='clean' ? 'canasta-clean' : 'canasta-dirty';
    const glyph = m.type==='clean' ? '♥' : '♠';
    return `<span class="rankchip ${cls}">${label} ${m.cards.length}<span class="cap-glyph">${glyph}</span></span>`;
  }
  const wildCount = m.cards.filter(isWild).length;
  const wildTag = wildCount>0 ? `<span class="wild-tag">●${wildCount}</span>` : '';
  return `<span class="rankchip ${m.type||''}">${label} ${m.cards.length}${wildTag}</span>`;
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }
const c=(rank,suit)=>({rank,suit});

// Completed clean canasta -> red fill, heart glyph
let m = {rank:'7', type:'clean', isCanasta:true, cards:[c('7'),c('7'),c('7'),c('7'),c('7'),c('7'),c('7')]};
let out = renderOppMeldChip(m);
assert(out.includes('canasta-clean') && out.includes('♥') && !out.includes('♠'), `clean canasta: red fill + heart glyph (${out})`);

// Completed dirty canasta -> black fill, spade glyph
m = {rank:'9', type:'dirty', isCanasta:true, cards:[c('9'),c('9'),c('9'),c('9'),c('9'),{rank:'2'},{rank:'2'}]};
out = renderOppMeldChip(m);
assert(out.includes('canasta-dirty') && out.includes('♠') && !out.includes('♥'), `dirty canasta: black fill + spade glyph (${out})`);

// Completed wild canasta -> keeps its own gold badge, no red/black
m = {rank:'WILD', type:'clean', isCanasta:true, cards:[{rank:'2'},{rank:'2'},{rank:'2'},{rank:'2'},{rank:'2'},{rank:'2'},{rank:'2'}]};
out = renderOppMeldChip(m);
assert(!out.includes('canasta-clean') && !out.includes('canasta-dirty') && out.includes('★ Wild'), `wild canasta keeps its distinct gold treatment, not red/black (${out})`);

// In-progress, no wilds -> plain chip, no wild tag
m = {rank:'K', type:'clean', isCanasta:false, cards:[c('K'),c('K'),c('K')]};
out = renderOppMeldChip(m);
assert(!out.includes('wild-tag') && !out.includes('canasta-'), `in-progress natural-only meld: plain chip, no markers (${out})`);

// In-progress WITH wilds -> muted wild-count tag, NOT the bold completion colors
m = {rank:'Q', type:'dirty', isCanasta:false, cards:[c('Q'),c('Q'),{rank:'JOKER'}]};
out = renderOppMeldChip(m);
assert(out.includes('wild-tag') && out.includes('●1') && !out.includes('canasta-dirty'), `in-progress meld with 1 wild: muted "●1" tag, does NOT look like a finished canasta (${out})`);

// In-progress with 2 wilds -> count reflects actual wild count
m = {rank:'J', type:'dirty', isCanasta:false, cards:[c('J'),c('J'),c('J'),{rank:'2'},{rank:'2'}]};
out = renderOppMeldChip(m);
assert(out.includes('●2'), `in-progress meld correctly counts multiple wilds (${out})`);

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
