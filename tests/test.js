// Headless audit for Angry Bulls. Four checks per level, PASS or FAIL.
// Everything it knows about the game comes from index.html via world.js.
const { MOD, makeWorld, step, greedy, floatTest, settleTest, offBoard } = require('./world');
const { LEVELS, PHYS, GT, BEAR_R, maxScore, starCuts } = MOD;

/* --- crush rules, tested on their own before any level is judged ---------- */
// A bear on open ground with beams placed above it. beamGap is how far above
// the bear each beam starts, so gap 0 means already resting on it.
function crushScene(count, beamGap, seconds) {
  const bearY = GT - BEAR_R, BH = 24, BW = 174;
  const blocks = [];
  for (let i = 0; i < count; i++) {
    blocks.push({ x: 500, y: bearY - BEAR_R - BH / 2 - beamGap - i * BH, w: BW, h: BH, t: 'r' });
  }
  const st = makeWorld({ id: 'crush', name: 'crush', shots: 1, blocks, bears: [{ x: 500, y: bearY }] });
  step(st, Math.round(seconds * 60));
  return { alive: st.bears.length > 0, hp: st.bears.length ? st.bears[0].hp : 0 };
}
function crushChecks() {
  let bad = 0;
  const cases = [
    ['one beam dropped a storey onto a bear kills it',
      () => !crushScene(1, 74, 3).alive],
    ['one beam already resting on a bear does NOT kill it',
      () => crushScene(1, 0, 12).alive],
    ['a bear buried under four beams is crushed within 5s',
      () => !crushScene(4, 0, 5).alive],
    ['a bear with nothing on it is never hurt',
      () => { const r = crushScene(0, 0, 15); return r.alive && r.hp >= PHYS.bearHp; }]
  ];
  console.log('crush rules');
  cases.forEach(([name, fn]) => {
    const ok = fn();
    if (!ok) bad++;
    console.log(`   [${ok ? 'PASS' : 'FAIL'}] ${name}`);
  });
  console.log('');
  return bad;
}

const only = process.argv[2] ? parseInt(process.argv[2], 10) : null;
console.log('ANGRY BULLS - headless audit\n');
let fail = crushChecks();

LEVELS.forEach((L, i) => {
  if (only !== null && i !== only) return;
  const max = maxScore(L), cuts = starCuts(L);
  const signs = L.blocks.filter(b => b.t === 's').length;
  console.log(`${i + 1}. ${L.name}   blocks ${L.blocks.length}${signs ? ` (${signs} signs)` : ''}, bears ${L.bears.length}, shots ${L.shots}`);
  console.log(`   max score ${max}, stars at ${cuts.join(' / ')}`);

  // 1. Does the level stand still when nobody touches it, and does the crush
  //    rule leave the bears alone until something actually lands on them?
  const s = settleTest(L);
  const settleOk = s.maxD < 6 && s.maxR < 2 && s.bearsLost === 0 && s.blocksLost === 0
                && s.minBearHp > PHYS.bearHp * 0.98;
  console.log(`   [${settleOk ? 'PASS' : 'FAIL'}] stands still 15s: drift ${s.maxD.toFixed(2)}px, rot ${s.maxR.toFixed(2)}deg, bear drift ${s.bearD.toFixed(2)}px, weakest bear ${s.minBearHp.toFixed(0)}/${PHYS.bearHp} hp, nothing lost`);
  if (!settleOk) fail++;

  const g = greedy(L);

  // 2. Nothing may finish outside the visible board. This is the wall check.
  const gone = offBoard(g.st);
  const wallsOk = gone.length === 0;
  console.log(`   [${wallsOk ? 'PASS' : 'FAIL'}] nothing off the board after play: ${gone.length} bodies outside the canvas` + (gone.length ? ' <-- ' + JSON.stringify(gone.slice(0, 4)) : ''));
  if (!wallsOk) fail++;

  // 3. Nothing left hovering once the collapse has finished.
  const f = floatTest(g.st);
  const floatOk = f.fall < 8;
  console.log(`   [${floatOk ? 'PASS' : 'FAIL'}] no floaters: ${f.airborne} bodies above ground, given 5 more seconds the worst fall is ${f.fall.toFixed(2)}px (any drift ${f.worst.toFixed(2)}px)`);
  if (!floatOk) fail++;

  // 4. Can the level actually be finished with the shots it gives you?
  const stars = g.total >= cuts[2] ? 3 : g.total >= cuts[1] ? 2 : g.total >= cuts[0] ? 1 : 0;
  console.log(`   [${g.cleared ? 'PASS' : 'FAIL'}] clearable: ${g.cleared ? 'yes' : 'NO'} in ${g.shotsUsed}/${L.shots} shots, bears ${g.killed}/${L.bears.length}, blocks broken ${g.broken}, greedy score ${g.total} (${(100 * g.total / max).toFixed(0)}% of max, ${stars} stars)`);
  if (!g.cleared) fail++;
  console.log('');
});

console.log(fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
