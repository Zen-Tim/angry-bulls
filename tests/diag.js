// Detailed solver diagnostics: which shots the greedy player picks and which
// bears survive. Use this when test.js reports a level is not clearable.
const { MOD, greedy, aimGrid } = require('./world');
const { LEVELS } = MOD;

const only = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const grid = aimGrid(4, 6);

LEVELS.forEach((L, i) => {
  if (only !== null && i !== only) return;
  const g = greedy(L, grid);
  console.log(`\n${i + 1}. ${L.name}: cleared=${g.cleared} shots=${g.shotsUsed}/${L.shots} killed=${g.killed}/${L.bears.length} broken=${g.broken} score=${g.total}`);
  console.log('   aims: ' + g.chosen.map(c => `${c.a}deg/${Math.round(c.pull)}`).join('  '));
  if (g.st.bears.length) {
    console.log('   survivors (start -> end, hp): ' + g.st.bears.map(b =>
      `${b.home.x},${b.home.y} -> ${Math.round(b.position.x)},${Math.round(b.position.y)} hp ${b.hp.toFixed(0)}`).join('   '));
  }
});
