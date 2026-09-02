// Headless test harness for Angry Bulls.
// Reads level data straight out of index.html so there is one source of truth.
const fs = require('fs');
const path = require('path');
const M = require('matter-js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.split('/*LEVELS_START*/')[1].split('/*LEVELS_END*/')[0];
const MOD = new Function(src + '\nreturn {LEVELS,GT,PW,PH,BH,BEAR_R,PHYS,damageAt,maxScore,starCuts,PAY_BEAR,PAY_BLOCK,PAY_SHOT};')();
const { LEVELS, GT, BEAR_R, PHYS, damageAt, PAY_BEAR, PAY_BLOCK, PAY_SHOT } = MOD;
const opts = (base, extra) => Object.assign({}, base, extra);

const W = 1000, H = 620;
const START = { x: 150, y: 392 }, MAXPULL = PHYS.maxPull, POWER = PHYS.power;

function makeWorld(L) {
  const engine = M.Engine.create();
  engine.gravity.y = PHYS.gravity;
  engine.enableSleeping = PHYS.sleeping;
  engine.positionIterations = PHYS.positionIterations;
  engine.velocityIterations = PHYS.velocityIterations;
  engine.constraintIterations = PHYS.constraintIterations;

  const state = { engine, blocks: [], bears: [], bulls: [], broken: 0, killed: 0 };
  const parts = [
    M.Bodies.rectangle(500, GT + 16, 2400, 32, opts(PHYS.ground, { isStatic: true })),
    M.Bodies.rectangle(START.x, GT - 74, 22, 148, opts(PHYS.ground, { isStatic: true }))
  ];
  L.blocks.forEach(s => {
    const b = M.Bodies.rectangle(s.x, s.y, s.w, s.h, opts(PHYS.candle, { label: 'candle' }));
    b.hp = s.h > s.w ? PHYS.hpPost : PHYS.hpBeam;
    b.home = { x: s.x, y: s.y };
    state.blocks.push(b); parts.push(b);
  });
  L.bears.forEach(s => {
    const b = M.Bodies.circle(s.x, s.y, BEAR_R, opts(PHYS.bear, { label: 'bear' }));
    M.Body.setInertia(b, Infinity);
    b.home = { x: s.x, y: s.y };
    state.bears.push(b); parts.push(b);
  });
  M.Composite.add(engine.world, parts);

  // Same damage rules as the game.
  M.Events.on(engine, 'collisionStart', e => {
    e.pairs.forEach(p => {
      const v = Math.hypot(p.bodyA.velocity.x - p.bodyB.velocity.x, p.bodyA.velocity.y - p.bodyB.velocity.y);
      [p.bodyA, p.bodyB].forEach(b => {
        if (b.label === 'bear' && v > PHYS.bearKO && state.bears.includes(b)) {
          M.Composite.remove(engine.world, b);
          state.bears = state.bears.filter(x => x !== b);
          state.killed++;
        }
        if (b.label === 'candle' && v > PHYS.breakAt && state.blocks.includes(b)) {
          b.hp -= damageAt(v);
          if (b.hp <= 0) {
            M.Composite.remove(engine.world, b);
            state.blocks = state.blocks.filter(x => x !== b);
            state.broken++;
          }
        }
      });
    });
  });
  return state;
}

function step(st, n) {
  for (let i = 0; i < n; i++) {
    M.Engine.update(st.engine, 1000 / 60);
    for (let j = st.bears.length - 1; j >= 0; j--) {
      if (st.bears[j].position.y > H + 60) {
        M.Composite.remove(st.engine.world, st.bears[j]);
        st.bears.splice(j, 1); st.killed++;
      }
    }
    for (let k = st.blocks.length - 1; k >= 0; k--) {
      const c = st.blocks[k];
      if (c.position.y > H + 120 || c.position.x > W + 200 || c.position.x < -200) {
        M.Composite.remove(st.engine.world, c); st.blocks.splice(k, 1);
      }
    }
  }
}

function fire(st, vx, vy) {
  const bull = M.Bodies.circle(START.x, START.y, PHYS.bullR, opts(PHYS.bull, { label: 'bull' }));
  M.Composite.add(st.engine.world, bull);
  M.Body.setVelocity(bull, { x: vx, y: vy });
  st.bulls.push(bull);
}

// A body cannot hover when sleeping is off: gravity is applied every tick, so
// anything unsupported falls. Definitive float test = let it rest, snapshot,
// run on, and see whether anything above the ground moved.
function floatTest(st, extra = 300) {
  step(st, 900);   // give the collapse a full 15s to finish before judging
  const watch = st.blocks.concat(st.bears).filter(b => b.bounds.max.y < GT - 8);
  const before = watch.map(b => ({ b, x: b.position.x, y: b.position.y }));
  step(st, extra);
  let worst = 0, fall = 0, count = 0;
  before.forEach(o => {
    const d = Math.hypot(o.b.position.x - o.x, o.b.position.y - o.y);
    if (d > 2) count++;
    worst = Math.max(worst, d);
    fall = Math.max(fall, o.b.position.y - o.y);   // downward only
  });
  return { airborne: watch.length, drifted: count, worst, fall };
}

function toppled(st, L) {
  let n = 0;
  st.blocks.forEach(b => {
    if (Math.hypot(b.position.x - b.home.x, b.position.y - b.home.y) > 25) n++;
  });
  return n + (L.blocks.length - st.blocks.length);
}

/* --- test 1: does the level stand still when nobody touches it --- */
function settleTest(L) {
  const st = makeWorld(L);
  step(st, 900); // 15 simulated seconds
  let maxD = 0, maxR = 0, bearD = 0;
  st.blocks.forEach(b => {
    maxD = Math.max(maxD, Math.hypot(b.position.x - b.home.x, b.position.y - b.home.y));
    maxR = Math.max(maxR, Math.abs(b.angle) * 180 / Math.PI);
  });
  st.bears.forEach(b => { bearD = Math.max(bearD, Math.hypot(b.position.x - b.home.x, b.position.y - b.home.y)); });
  return { maxD, maxR, bearD, bearsLost: L.bears.length - st.bears.length, blocksLost: L.blocks.length - st.blocks.length };
}

/* --- test 2: greedy playthrough, can a player clear it in the shots given --- */
// Sweep pull angles and lengths the way a player would, take the best shot each
// turn, and keep going. This is a lower bound on what a human can do.
function aimGrid() {
  const out = [];
  // Negative angles matter: the sling sits well above the ground, so the only
  // way to reach anything at ground level is to pull upward and shoot downward.
  for (let a = -26; a <= 72; a += 4) {        // degrees from horizontal
    for (let pull = MAXPULL * 0.5; pull <= MAXPULL + 0.01; pull += MAXPULL * 0.1) {
      const r = a * Math.PI / 180;
      out.push({ vx: Math.cos(r) * pull * POWER, vy: -Math.sin(r) * pull * POWER, a, pull });
    }
  }
  return out;
}
function snapshot(L, shotsTaken) { return { L, shotsTaken }; }

function replay(L, shots) {
  // Rebuild from scratch and replay a fixed list of shots. Deterministic.
  const st = makeWorld(L);
  step(st, 180);
  shots.forEach(s => { fire(st, s.vx, s.vy); step(st, 260); });
  step(st, 160);
  return st;
}

function greedy(L) {
  const grid = aimGrid();
  const chosen = [];
  let bestScore = 0;
  for (let shot = 0; shot < L.shots; shot++) {
    let pick = null;
    grid.forEach(g => {
      const st = replay(L, chosen.concat([g]));
      const s = st.killed * PAY_BEAR + st.broken * PAY_BLOCK;
      if (!pick || s > pick.s) pick = { g, s, killed: st.killed, broken: st.broken };
    });
    chosen.push(pick.g);
    bestScore = pick.s;
    if (pick.killed >= L.bears.length) break;
  }
  const st = replay(L, chosen);
  const shotsUsed = chosen.length;
  const cleared = st.bears.length === 0;
  const bonus = cleared ? (L.shots - shotsUsed) * PAY_SHOT : 0;
  const total = st.killed * PAY_BEAR + st.broken * PAY_BLOCK + bonus;
  return { cleared, shotsUsed, killed: st.killed, broken: st.broken, total, st, chosen };
}

/* --- run --- */
console.log('ANGRY BULLS - headless audit\n');
let fail = 0;
LEVELS.forEach((L, i) => {
  const max = MOD.maxScore(L), cuts = MOD.starCuts(L);
  console.log(`${i + 1}. ${L.name}   blocks ${L.blocks.length}, bears ${L.bears.length}, shots ${L.shots}`);
  console.log(`   max score ${max}, stars at ${cuts.join(' / ')}`);

  const s = settleTest(L);
  const settleOk = s.maxD < 6 && s.maxR < 2 && s.bearsLost === 0 && s.blocksLost === 0;
  console.log(`   [${settleOk ? 'PASS' : 'FAIL'}] stands still 15s: drift ${s.maxD.toFixed(2)}px, rot ${s.maxR.toFixed(2)}deg, bear drift ${s.bearD.toFixed(2)}px, nothing lost`);
  if (!settleOk) fail++;

  const g = greedy(L);
  const f = floatTest(g.st);
  const floatOk = f.fall < 8;
  console.log(`   [${floatOk ? 'PASS' : 'FAIL'}] no floaters after play: ${f.airborne} bodies above ground, given 5 more seconds the worst fall is ${f.fall.toFixed(2)}px (any drift ${f.worst.toFixed(2)}px, ${f.drifted} bodies still creeping)`);
  if (!floatOk) fail++;

  const clearOk = g.cleared;
  console.log(`   [${clearOk ? 'PASS' : 'FAIL'}] clearable: ${g.cleared ? 'yes' : 'NO'} in ${g.shotsUsed}/${L.shots} shots, bears ${g.killed}/${L.bears.length}, blocks broken ${g.broken}, greedy score ${g.total} (${(100 * g.total / max).toFixed(0)}% of max, ${g.total >= cuts[2] ? 3 : g.total >= cuts[1] ? 2 : g.total >= cuts[0] ? 1 : 0} stars)`);
  if (!clearOk) fail++;
  console.log('');
});
console.log(fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`);
