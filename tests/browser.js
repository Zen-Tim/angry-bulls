// Real browser smoke test. Plays a level, screenshots every level, and fails
// loudly on any console or page error.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1050 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  // This sandbox blocks cdnjs, so serve Matter from node_modules instead.
  const matter = fs.readFileSync(__dirname + '/node_modules/matter-js/build/matter.min.js', 'utf8');
  await page.route('**/matter.min.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: matter }));

  await page.goto('file://' + __dirname + '/../index.html');
  await page.waitForTimeout(2500);

  const state = () => page.evaluate(() => ({
    bears: document.getElementById('left').textContent,
    shots: document.getElementById('shots').textContent,
    pnl: document.getElementById('pnl').textContent,
    best: document.getElementById('best').textContent,
    levels: [...document.querySelectorAll('.lvl .nm')].map(e => e.textContent),
    stars: [...document.querySelectorAll('.lvl .st')].map(e => e.textContent),
    banner: document.getElementById('banner').classList.contains('on')
  }));
  console.log('start   ', JSON.stringify(await state()));

  const box = await page.locator('#cv').boundingBox();
  const sx = box.x + box.width * 0.150, sy = box.y + box.height * (392 / 620);

  // Hold a full pull so the leverage meter is on screen for the screenshot.
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx - 108, sy - 46, { steps: 12 });
  await page.screenshot({ path: __dirname + '/shot-aiming-maxlev.png' });
  // And a partial pull, to check the meter reads something other than 100.
  await page.mouse.move(sx - 50, sy - 22, { steps: 8 });
  await page.screenshot({ path: __dirname + '/shot-aiming-partial.png' });
  await page.mouse.move(sx - 100, sy - 44, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(3500);
  console.log('1 shot  ', JSON.stringify(await state()));
  await page.screenshot({ path: __dirname + '/shot-after-1.png' });

  for (let i = 0; i < 6; i++) {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx - 100, sy - 20 - i * 10, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(2800);
  }
  await page.waitForTimeout(1500);
  console.log('spent   ', JSON.stringify(await state()));
  await page.screenshot({ path: __dirname + '/shot-level-end.png' });

  // Every level renders, and the saved best survives a reload.
  const n = await page.evaluate(() => document.querySelectorAll('#picker .lvl').length);
  for (let i = 0; i < n; i++) {
    await page.evaluate(k => document.querySelectorAll('#picker .lvl')[k].click(), i);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${__dirname}/shot-level-${i + 1}.png` });
    console.log(`level ${i + 1} `, JSON.stringify(await state()));
  }

  const stored = await page.evaluate(() => localStorage.getItem('angry-bulls-v2'));
  console.log('saved   ', stored);
  await page.reload();
  await page.waitForTimeout(2000);
  const afterReload = await page.evaluate(() => document.querySelector('.lvl .st').textContent);
  console.log('stars survive reload:', afterReload);

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console or page errors');
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})();
