const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  // This container's egress blocks cdnjs, so serve Matter from node_modules.
  const matter = require('fs').readFileSync(__dirname + '/node_modules/matter-js/build/matter.min.js', 'utf8');
  await page.route('**/matter.min.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: matter }));

  await page.goto('file://' + __dirname + '/../index.html');
  await page.waitForTimeout(2500);

  const state = () => page.evaluate(() => ({
    bears: document.getElementById('left').textContent,
    shots: document.getElementById('shots').textContent,
    pnl: document.getElementById('pnl').textContent,
    best: document.getElementById('best').textContent,
    tip: document.getElementById('tip').textContent.slice(0, 40),
    levels: [...document.querySelectorAll('.lvl .nm')].map(e => e.textContent),
    stars: [...document.querySelectorAll('.lvl .st')].map(e => e.textContent),
    banner: document.getElementById('banner').classList.contains('on')
  }));
  console.log('start   ', JSON.stringify(await state()));
  await page.screenshot({ path: 'shot-1-start.png' });

  // Take a shot: drag the bull back and up so it launches down and to the right.
  const box = await page.locator('#cv').boundingBox();
  const sx = box.x + box.width * 0.150, sy = box.y + box.height * (392 / 620);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx - 95, sy - 42, { steps: 12 });
  await page.screenshot({ path: 'shot-2-aiming.png' });
  await page.mouse.up();
  await page.waitForTimeout(3500);
  console.log('1 shot  ', JSON.stringify(await state()));
  await page.screenshot({ path: 'shot-3-after.png' });

  // Fire the rest so the level ends one way or the other.
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx - 100, sy - 20 - i * 10, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(2800);
  }
  await page.waitForTimeout(1500);
  console.log('spent   ', JSON.stringify(await state()));
  await page.screenshot({ path: 'shot-4-end.png' });

  // Level select and persistence.
  await page.evaluate(() => document.querySelectorAll('#picker .lvl')[1].click());
  await page.waitForTimeout(1500);
  console.log('level 2 ', JSON.stringify(await state()));
  await page.screenshot({ path: 'shot-5-level2.png' });
  await page.evaluate(() => document.querySelectorAll('#picker .lvl')[2].click());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'shot-6-level3.png' });
  console.log('level 3 ', JSON.stringify(await state()));

  const stored = await page.evaluate(() => localStorage.getItem('angry-bulls-v2'));
  console.log('saved   ', stored);
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console or page errors');
  await browser.close();
})();
