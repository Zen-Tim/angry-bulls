# Angry Bulls

A slingshot physics game. Fire the bull at candlestick chart patterns and knock out the bears.

Live: https://angry-bulls-zentim888s-projects.vercel.app

## What it is

One self-contained HTML file. No build step, no package install. Open `index.html` in a browser and it runs.
The only external dependency is the Matter.js physics library, loaded from a public CDN.

Every structure is built from candlestick blocks, green for bull bars and red for bear bars, and the levels
are chart patterns: double top, head and shoulders, bull flag, plus a row of funded-account shops. A trader
should read the shape before reading the level name.

## Controls

Drag the bull back from the sling and let go. The dotted line shows where the shot will land and stops at
the first thing it would hit. A leverage meter fills as you pull; a full pull is 100 percent leverage. Six
shots per level.

The sling sits well above the ground, so anything at ground level can only be reached by pulling *up* and
shooting *down*. That is the main skill in the game.

## Scoring

Score is trading profit and loss, in dollars.

| Event | Pays |
| --- | --- |
| Bear knocked out | $2,500 |
| Candle block destroyed | $400 |
| Prop firm shop sign destroyed | $5,000 |
| Each unused shot, on a clear | $3,000 |

Stars are set as a fraction of each level's theoretical maximum: 50 percent for one star, 68 percent for
two, 82 percent for three. Three stars means clearing the level with shots to spare, not just clearing it.
Best score and best star count per level are kept in browser local storage.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole game: markup, styles, level data, physics, and character art |
| `tests/world.js` | The one place a test world is built and stepped. Reads all the rules out of `index.html` |
| `tests/test.js` | Headless audit. Crush rules, stability, walls, floating bodies, and clearability |
| `tests/browser.js` | Real browser smoke test through Playwright. Plays a level, screenshots every level, checks for console errors |

`index.html` contains one marked region, between `/*LEVELS_START*/` and `/*LEVELS_END*/`, holding the level
geometry, the physics constants and the scoring rules. That region uses no browser globals, so the test
harness evaluates the same text the game runs. There is no second copy of the numbers to keep in sync.

## Physics notes

### The board is walled

The ground used to be 2,400 px wide against a 1,000 px canvas. A bear knocked sideways could roll off the
visible board, sit there alive, and never be hit again, which made the level impossible to clear. The ground
is now exactly canvas width and there are static walls just outside each edge. `tests/test.js` checks after
every playthrough that no body has ended up outside the canvas.

### Bears take damage, they do not die on a speed threshold

The old rule killed a bear on one relative speed above 4.5, which meant a heavy beam dropping onto a bear
from a storey up did nothing at all, because the beam is slow. Bears now have 100 hit points and take
`(speed - 2.2) x mass x 2.4` per impact, with the other body's mass capped at 30. The cap matters: the ground
is static, so Matter reports its mass as Infinity, and without the cap every landing would do infinite damage.

That covers impacts. It does not cover a bear pinned at the bottom of a pile, which takes almost no impacts
and would sit there alive and unreachable forever. So resting weight drains it as well, above a threshold set
so a single beam lying on a bear is safe but a pile is not.

The load is measured from the solver's own resting `normalImpulse`, not by adding up the masses of the bodies
in contact. That distinction is the whole thing: a bear under a vertical stack of four beams touches only one
of them, so counting contact masses saw 10.9 of a 43.4 stack and the bear survived. Matter's resting impulse
is mass x gravity x gravityScale x delta squared, so dividing an impulse by that constant converts it back
into the mass actually bearing down, whole stack included.

Four crush rules are unit-tested on their own before any level is judged: a beam dropped a storey kills, a
beam already resting does not, a bear under four beams dies within five seconds, and a bear with nothing on
it is never hurt.

### Sleeping is off, and must stay off

v1.2 ran with `engine.enableSleeping = true`. A sleeping body in Matter.js only wakes when a force is
applied to it, when a moving body collides with it, or when its own motion crosses the wake threshold.
Knock the support out from under a sleeping body and none of those three things happen, so it never wakes
and it hangs in mid air. That is what produced the towers floating in clear sky with rubble underneath.

Sleeping is now off, so gravity is applied to everything on every tick and nothing can hover. Stability
comes from geometry and solver settings instead.

### Geometry does the work

Every structure is post and beam. Each storey is two uprights with a beam across them, and the beam is
exactly as wide as the outer edges of the two uprights, so each beam end is carried directly by an upright
rather than cantilevered. Spans shrink on the way up, so every upright lands well inside the beam below it.

Measured over 15 simulated seconds with nothing touching the level: worst block drift 4.1 px and worst
rotation 0.25 degrees. That is first second settling.

### Solver settings

- 16 position, 10 velocity, 4 constraint iterations. v1.2 used 40 position passes, which was expensive and
  was compensating for slop, not for geometry.
- Slop back to the Matter default of 0.05. v1.2 used 0.005, ten times tighter than default, which makes
  resting contacts stiff and jittery rather than stable.
- Blocks: bounce 0, friction 0.85, static friction 1.1.
- Bears have rotation locked with `setInertia(body, Infinity)`. They are circles resting on flat beams, so
  without the lock they roll off unaided. They still get knocked around when hit.

### The bull

`Body.setStatic(body, false)` is what un-freezes a body. Assigning `body.isStatic = false` directly leaves
the inverse mass at zero, so the body takes a velocity and ignores it.

The bull is created with `sleepThreshold: Infinity` as belt and braces, left over from the v1.2 fix.

### Aim preview

Matter integrates velocity as `v = v * (1 - frictionAir) + gravity * gravityScale * delta^2`. The dotted
preview has to damp and drop the same way or it lies to the player. The constants `DAMP = 0.988` and
`GDROP = 0.278` were fitted against the engine itself by the harness, not guessed. Mean error over 34
steps: 0.04 px.

## Tests

```
cd tests
npm install
node test.js       # headless audit, about 90 seconds
node browser.js    # real browser, writes screenshots into tests/
```

`test.js` first unit-tests the four crush rules, then runs four checks per level and prints PASS or FAIL:

1. **Stands still.** Build the level, run 15 simulated seconds, and confirm nothing drifts, rotates or
   falls off.
2. **Nothing off the board.** After a full playthrough, no body may sit outside the canvas. This is the
   wall check.
3. **No floaters.** Let the collapse finish for 15 seconds, then run 5 more and measure the worst downward
   movement. Anything hovering would drop hundreds of pixels. Current worst across all four levels: 0.03 px.
4. **Clearable.** A greedy solver sweeps launch angles from minus 26 to plus 72 degrees and a range of pull
   lengths, takes the best shot each turn, and reports whether the level can be finished within the shots
   given. All four levels currently clear in 3 to 5 shots out of 6, scoring 2 stars.

Check 4 is the one that catches design mistakes. It found that ground level bears were unreachable until the
solver was allowed to try downward shots, and it caught the sling being retuned without the harness
following. Pull ranges in the sweep are fractions of `PHYS.maxPull` for that reason: a hardcoded range once
collapsed to a single value when the pull was shortened, and the audit went green on one aim.

`browser.js` serves Matter.js from `node_modules` rather than the CDN, because this sandbox blocks cdnjs.

## Deploying

Edits go to GitHub, GitHub deploys to Vercel. The Vercel project is `angry-bulls` under the team
`zentim888's projects`, linked to `Zen-Tim/angry-bulls` on branch `main`.

Vercel Authentication must stay disabled on the project or visitors get a login wall
(Settings, Deployment Protection).

## Version history

- v2.1, 2026-09-04 - walls on the board so nothing rolls off alive; bears take damage and get crushed by
  falling and resting weight instead of dying on a speed threshold; a leverage meter on the sling that reads
  100 percent at full pull; a fourth level, Prop Firm Row, with destructible shop signs worth $5,000 each;
  the two test harnesses folded onto one shared world builder
- v2.0, 2026-09-02 — sleeping turned off and the floating tower bug killed; structures rebuilt as post and
  beam; blocks now break rather than only topple; P&L scoring with star ratings and saved best scores;
  three chart pattern levels with a level picker; the bull now follows the drag and the aim preview stops
  at the first obstacle; headless and browser test harnesses added
- v1.2 — launch fix: the waiting bull was falling asleep on the sling, so the release did nothing
- v1.1 — stability fix: solver settings, towers respaced to 470 and 800, bear rotation locked
- v1.0 — first playable: six storey towers, sprite caching for the bull and bear art

## A note on the prop firm level

The three shop signs read APEKS, TOPSTUMBLE and FTM-NO. They are parodies of the funded-account model with
original marks drawn in the game's own style, not the names or branding of any real firm. Keep it that way:
real trademarks in a game whose point is destroying them is not a fight worth having on a site that carries
the Zen Trading Tech name.

## Ideas not yet built

- **Phase 2: sound.** Trading floor pit noise under the level, and the NYSE opening bell to start it.
- More chart patterns: wedge, range, triple top, cup and handle
- A level editor so layouts are placed by clicking rather than by editing coordinates
- Camera pan for levels wider than one screen
- Different bull types with special abilities, the way Angry Birds does
