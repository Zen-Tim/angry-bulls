# Angry Bulls

A slingshot physics game. Fire the bull at towers built from candlesticks and knock out the bears.

Live: https://angry-bulls-zentim888s-projects.vercel.app

## What it is

One self-contained HTML file. No build step, no package install. Open `index.html` in a browser and it runs.
The only external dependency is the Matter.js physics library, loaded from a public CDN.

Towers are built from candlestick blocks — green blocks are bull bars, red blocks are bear bars.
The design intent is that each level is a recognisable chart pattern (double top, head and shoulders,
bull flag), so a trader reads the shape before reading the level name.

## Controls

Drag the bull back from the sling and release. Six shots, five bears.
Hitting the base of an upright collapses the tower, which clears more bears than aiming at one directly.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole game — markup, styles, physics, and character art |

## Physics notes

Tall stacks fall over on their own under Matter.js defaults. Three settings keep them standing,
all verified by running the level headless for 15 simulated seconds with no shot fired:

- Solver passes raised to 40 position / 16 velocity / 6 constraint. The default of 6 position passes
  cannot resolve a six-storey stack and the error compounds until it topples.
- Blocks use bounce 0, friction 0.9, static friction 1.2, and allowed overlap 0.005. The defaults let
  blocks micro-bounce and slide.
- Sleeping is on, so settled blocks stop being simulated until something hits them.

Bears have their rotation locked (`setInertia(body, Infinity)`). They are circles resting on flat beams,
so without the lock they roll off unaided. They still get knocked around when hit.

Measured drift over 15 seconds with nothing touching the level: blocks move 3.8 px and rotate 0.1 degrees,
which is first-second settling and is not visible.

Also worth knowing: two solid bodies placed overlapping will throw the whole level apart. An earlier version
put the middle hut's beam 18 px inside a tower beam and the level exploded on load.

## Deploying

The Vercel project is `angry-bulls` under the team `zentim888's projects`.

Vercel Authentication must stay disabled on the project or visitors get a login wall
(Settings, Deployment Protection).

## Version history

- v1.1 — stability fix: solver settings, towers respaced to 470 and 800, bear rotation locked
- v1.0 — first playable: six-storey towers, sprite caching for the bull and bear art

## Ideas not yet built

- Level select, with one level per chart pattern
- A level editor so layouts are placed by clicking rather than by editing coordinates
- Camera pan for levels wider than one screen
- Blocks that break rather than only topple
