// Shared harness core for Angry Bulls.
//
// Everything about the physics comes out of index.html's marked block, and
// everything about building and stepping a world lives here. test.js and
// diag.js both require this file, so there is exactly one copy of the rules.
const fs = require('fs');
const path = require('path');
const M = require('matter-js');

const HTML = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(HTML, 'utf8').split('/*LEVELS_START*/')[1].split('/*LEVELS_END*/')[0];
const MOD = new Function(src + `
return {LEVELS,CW,CH,GT,PW,PH,BH,BEAR_R,SIGN_W,SIGN_H,PHYS,damageAt,bearDamage,contactLoad,
        edgeSpecs,maxScore,starCuts,blockPay,PAY_BEAR,PAY_BLOCK,PAY_SIGN,PAY_SHOT};`)();

const { CW, CH, GT, BEAR_R, PHYS, damageAt, bearDamage, contactLoad, edgeSpecs, blockPay,
        PAY_BEAR, PAY_SHOT } = MOD;
const START = PHYS.sling;
const opts = (base, extra) => Object.assign({}, base, extra);

function makeWorld(L) {
  const engine = M.Engine.create();
  engine.gravity.y = PHYS.gravity;
  engine.enableSleeping = PHYS.sleeping;
  engine.positionIterations = PHYS.positionIterations;
  engine.velocityIterations = PHYS.velocityIterations;
  engine.constraintIterations = PHYS.constraintIterations;

  const st = { engine, blocks: [], bears: [], bulls: [], broken: 0, killed: 0, earned: 0 };

  // Same walls the game builds. Without them a bear rolls off the board alive.
  const parts = edgeSpecs().map(e =>
    M.Bodies.rectangle(e.x, e.y, e.w, e.h, opts(PHYS.ground, { isStatic: true })));

  L.blocks.forEach(spec => {
    const b = M.Bodies.rectangle(spec.x, spec.y, spec.w, spec.h, opts(PHYS.candle, { label: 'candle' }));
    b.hp = spec.t === 's' ? PHYS.hpSign : (spec.h > spec.w ? PHYS.hpPost : PHYS.hpBeam);
    b.pay = blockPay(spec);
    b.home = { x: spec.x, y: spec.y };
    st.blocks.push(b); parts.push(b);
  });
  L.bears.forEach(spec => {
    const b = M.Bodies.circle(spec.x, spec.y, BEAR_R, opts(PHYS.bear, { label: 'bear' }));
    M.Body.setInertia(b, Infinity);
    b.hp = PHYS.bearHp; b.load = 0;
    b.home = { x: spec.x, y: spec.y };
    st.bears.push(b); parts.push(b);
  });
  M.Composite.add(engine.world, parts);

  M.Events.on(engine, 'collisionStart', e => {
    e.pairs.forEach(p => {
      const v = Math.hypot(p.bodyA.velocity.x - p.bodyB.velocity.x, p.bodyA.velocity.y - p.bodyB.velocity.y);
      [[p.bodyA, p.bodyB], [p.bodyB, p.bodyA]].forEach(([b, o]) => {
        if (b.label === 'bear' && st.bears.includes(b)) {
          b.hp -= bearDamage(v, o.mass);
          if (b.hp <= 0) killBear(st, b);
          return;
        }
        if (b.label === 'candle' && v > PHYS.breakAt && st.blocks.includes(b)) {
          b.hp -= damageAt(v);
          if (b.hp <= 0) breakBlock(st, b);
        }
      });
    });
  });
  M.Events.on(engine, 'collisionActive', e => {
    e.pairs.forEach(p => {
      [[p.bodyA, p.bodyB], [p.bodyB, p.bodyA]].forEach(([b, o]) => {
        if (b.label !== 'bear' || o.isStatic) return;
        if (o.position.y < b.position.y) b.load += contactLoad(p);
      });
    });
  });
  return st;
}

function killBear(st, b) {
  M.Composite.remove(st.engine.world, b);
  st.bears = st.bears.filter(x => x !== b);
  st.killed++; st.earned += PAY_BEAR;
}
function breakBlock(st, b) {
  M.Composite.remove(st.engine.world, b);
  st.blocks = st.blocks.filter(x => x !== b);
  st.broken++; st.earned += b.pay;
}

function step(st, n) {
  for (let i = 0; i < n; i++) {
    M.Engine.update(st.engine, 1000 / 60);
    for (let j = st.bears.length - 1; j >= 0; j--) {
      const br = st.bears[j];
      if (br.position.y > CH + 60) { killBear(st, br); continue; }
      if (br.load > PHYS.crushLoad) br.hp -= (br.load - PHYS.crushLoad) * PHYS.crushRate;
      br.load = 0;
      if (br.hp <= 0) killBear(st, br);
    }
    for (let k = st.blocks.length - 1; k >= 0; k--) {
      const c = st.blocks[k];
      if (c.position.y > CH + 120 || Math.abs(c.position.x - CW / 2) > CW) {
        M.Composite.remove(st.engine.world, c); st.blocks.splice(k, 1);
      }
    }
  }
}

function fire(st, g) {
  const bull = M.Bodies.circle(START.x, START.y, PHYS.bullR, opts(PHYS.bull, { label: 'bull' }));
  M.Composite.add(st.engine.world, bull);
  M.Body.setVelocity(bull, { x: g.vx, y: g.vy });
  st.bulls.push(bull);
}

// Rebuild from scratch and replay a fixed list of shots. Deterministic.
function replay(L, shots) {
  const st = makeWorld(L);
  step(st, 180);
  shots.forEach(g => { fire(st, g); step(st, 260); });
  step(st, 160);
  return st;
}

// Negative angles matter: the sling sits well above the ground, so the only way
// to reach anything at ground level is to pull upward and shoot downward.
// Pull is expressed as a fraction of maxPull so retuning the sling cannot
// silently collapse this sweep to a single value.
function aimGrid(angleStep = 4, pullSteps = 6) {
  const out = [];
  for (let a = -26; a <= 72; a += angleStep) {
    for (let i = 0; i < pullSteps; i++) {
      const pull = PHYS.maxPull * (0.5 + 0.5 * i / (pullSteps - 1));
      const r = a * Math.PI / 180;
      out.push({ vx: Math.cos(r) * pull * PHYS.power, vy: -Math.sin(r) * pull * PHYS.power, a, pull });
    }
  }
  return out;
}

// A greedy player: sweep the grid, take the best shot, repeat. A lower bound on
// what a human can do, and the check that proves a level is finishable at all.
function greedy(L, grid = aimGrid()) {
  const chosen = [];
  for (let shot = 0; shot < L.shots; shot++) {
    let pick = null;
    grid.forEach(g => {
      const st = replay(L, chosen.concat([g]));
      if (!pick || st.earned > pick.earned) pick = { g, earned: st.earned, killed: st.killed };
    });
    chosen.push(pick.g);
    if (pick.killed >= L.bears.length) break;
  }
  const st = replay(L, chosen);
  const cleared = st.bears.length === 0;
  const bonus = cleared ? (L.shots - chosen.length) * PAY_SHOT : 0;
  return { cleared, shotsUsed: chosen.length, killed: st.killed, broken: st.broken,
           total: st.earned + bonus, st, chosen };
}

// Nothing can hover when sleeping is off, because gravity is applied every
// tick. So: let the collapse finish, snapshot, run on, and see whether anything
// above the ground dropped. A real floater falls hundreds of pixels.
function floatTest(st, settle = 900, extra = 300) {
  step(st, settle);
  const watch = st.blocks.concat(st.bears).filter(b => b.bounds.max.y < GT - 8);
  const before = watch.map(b => ({ b, x: b.position.x, y: b.position.y }));
  step(st, extra);
  let worst = 0, fall = 0, drifted = 0;
  before.forEach(o => {
    const d = Math.hypot(o.b.position.x - o.x, o.b.position.y - o.y);
    if (d > 2) drifted++;
    worst = Math.max(worst, d);
    fall = Math.max(fall, o.b.position.y - o.y);
  });
  return { airborne: watch.length, drifted, worst, fall };
}

function settleTest(L) {
  const st = makeWorld(L);
  step(st, 900); // 15 simulated seconds
  let maxD = 0, maxR = 0, bearD = 0, minBearHp = PHYS.bearHp;
  st.blocks.forEach(b => {
    maxD = Math.max(maxD, Math.hypot(b.position.x - b.home.x, b.position.y - b.home.y));
    maxR = Math.max(maxR, Math.abs(b.angle) * 180 / Math.PI);
  });
  st.bears.forEach(b => {
    bearD = Math.max(bearD, Math.hypot(b.position.x - b.home.x, b.position.y - b.home.y));
    minBearHp = Math.min(minBearHp, b.hp);
  });
  return { maxD, maxR, bearD, minBearHp,
           bearsLost: L.bears.length - st.bears.length,
           blocksLost: L.blocks.length - st.blocks.length };
}

// Nothing may end up outside the visible board. This is the wall check.
function offBoard(st) {
  const out = [];
  st.blocks.concat(st.bears).forEach(b => {
    if (b.bounds.max.x < 0 || b.bounds.min.x > CW || b.bounds.min.y > CH) {
      out.push({ label: b.label, x: Math.round(b.position.x), y: Math.round(b.position.y) });
    }
  });
  return out;
}

module.exports = { M, MOD, makeWorld, step, fire, replay, aimGrid, greedy,
                   floatTest, settleTest, offBoard, START, opts };
