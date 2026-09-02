# Angry Bulls

A slingshot physics game. Fire the bull at candlestick chart patterns and knock out the bears.

Live: https://angry-bulls-zentim888s-projects.vercel.app

## What it is

One self-contained HTML file. No build step, no package install. Open `index.html` in a browser and it runs.
The only external dependency is the Matter.js physics library, loaded from a public CDN.

Every structure is built from candlestick blocks, green for bull bars and red for bear bars, and every level
is a chart pattern: double top, head and shoulders, bull flag. A trader should read the shape before
reading the level name.

## Controls

Drag the bull back from the sling and let go. The dotted line shows where the shot will land and stops at
the first thing it would hit. Six shots per level.

The sling sits well above the ground, so anything at ground level can only be reached by pulling *up* and
shooting *down*. That is the main skill in the game.

## Scoring

Score is trading profit and loss, in dollars.

| Event | Pays |
| --- | --- |
| Bear knocked out | $2,500 |
| Candle block destroyed | $400 |
| Each unused shot, on a clear | $3,000 |

Stars are set as a fraction of each level's theoretical maximum: 50 percent for one star, 68 percent for
two, 82 percent for three. Three stars means clearing the level with shots to spare, not just clearing it.
Best score and best star count per level are kept in browser local storage.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole game: markup, styles, level data, physics, and character art |
| `tests/test.js` | Headless audit. Stability, floating bodies, and whether each level can actually be cleared |
| `tests/browser.js` | Real browser smoke test through Playwright. Plays a level, screenshots it, checks for console errors |

`index.html` contains one marked region, between `/*LEVELS_START*/` and `/*LEVELS_END*/`, holding the level
geometry, the physics constants and the scoring rules. That region uses no browser globals, so the test
harness evaluates the same text the game runs. There is no second copy of the numbers to keep in sync.

## Physics notes

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

`test.js` runs three checks per level and prints PASS or FAIL:

1. **Stands still.** Build the level, run 15 simulated seconds, and confirm nothing drifts, rotates or
   falls off.
2. **No floaters.** Play the level out, let the collapse finish for 15 seconds, then run 5 more and
   measure the worst downward movement. Anything hovering would drop hundreds of pixels. Current worst
   across all three levels: 0.95 px.
3. **Clearable.** A greedy solver sweeps launch angles from minus 26 to plus 72 degrees and a range of
   pull lengths, takes the best shot each turn, and reports whether the level can be finished within the
   shots given. All three levels currently clear in 3 to 5 shots out of 6.

Check 3 is the one that catches design mistakes. It found that ground level bears were unreachable until
the solver was allowed to try downward shots, and it caught the sling being retuned without the harness
following.

`browser.js` serves Matter.js from `node_modules` rather than the CDN, because this sandbox blocks cdnjs.

## Deploying

Edits go to GitHub, GitHub deploys to Vercel. The Vercel project is `angry-bulls` under the team
`zentim888's projects`, linked to `Zen-Tim/angry-bulls` on branch `main`.

Vercel Authentication must stay disabled on the project or visitors get a login wall
(Settings, Deployment Protection).

## Version history

- v2.0, 2026-09-02 — sleeping turned off and the floating tower bug killed; structures rebuilt as post and
  beam; blocks now break rather than only topple; P&L scoring with star ratings and saved best scores;
  three chart pattern levels with a level picker; the bull now follows the drag and the aim preview stops
  at the first obstacle; headless and browser test harnesses added
- v1.2 — launch fix: the waiting bull was falling asleep on the sling, so the release did nothing
- v1.1 — stability fix: solver settings, towers respaced to 470 and 800, bear rotation locked
- v1.0 — first playable: six storey towers, sprite caching for the bull and bear art

## Ideas not yet built

- **Phase 2: sound.** Trading floor pit noise under the level, and the NYSE opening bell to start it.
- More chart patterns: wedge, range, triple top, cup and handle
- A level editor so layouts are placed by clicking rather than by editing coordinates
- Camera pan for levels wider than one screen
- Different bull types with special abilities, the way Angry Birds does
