import { chromium } from 'playwright';
import fs from 'node:fs';

const baseUrl = 'http://127.0.0.1:4173';
const outDir = '/home/user/workspace/ych_rehab_qa_artifacts/v65-level6-tripod-pinch-all-games';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

for (const viewport of [
  { name: 'portrait', width: 820, height: 1180 },
  { name: 'landscape', width: 1180, height: 820 },
]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__qa && window.YCHLanguage);

  await page.evaluate(() => window.__qa.selectLevel('67'));
  const catalog = await page.locator('#activityGrid .activity-card').evaluateAll(cards =>
    cards.map(card => ({
      theme: card.dataset.theme,
      text: card.textContent.trim(),
      difficultyNode: !!card.querySelector('.ac-meta'),
    })));
  await page.screenshot({ path: `${outDir}/${viewport.name}-catalog.png` });

  const setupChecks = [];
  for (const theme of ['flowers','chopstick_dimsum','peg_laundry','cards','mahjong','cooking']) {
    await page.locator(`#activityGrid [data-theme="${theme}"]`).click();
    await page.waitForSelector('#screen-start.active');
    setupChecks.push(await page.evaluate(() => ({
      title: document.getElementById('settingsTitle').textContent.trim(),
      context: document.getElementById('settingsContext').textContent.trim(),
      targetCardHidden: document.getElementById('shoulderTargetCard').hidden,
      duplicateTaskPicker: !!document.getElementById('level67ToolCard'),
    })));
    if (theme === 'chopstick_dimsum') {
      await page.screenshot({ path: `${outDir}/${viewport.name}-chopstick-setup.png` });
    }
    await page.locator('#btnBackToLibrary').click();
    await page.waitForSelector('#screen-library.active');
  }

  const flow = await page.evaluate(() => {
    const send = (gesture, count, extra = {}) => {
      for (let index = 0; index < count; index++) {
        window.__qa.setLevel6ToolFrame({
          gesture, stepMs: 120, poseMissing:['shoulder','elbow','wrist'], ...extra,
        });
      }
      return window.__qa.level6ToolState();
    };
    window.__qa.startGame({
      level:'67', level6Task:'chopsticks', duration:60, affectedSide:'right',
    });
    const layout = window.__qa.level67Layout();
    const pair = layout.items.map(item => ({
      item, target:layout.targets.find(target => target.type === item.type),
    })).find(value => value.target);
    const at = point => ({nx:point.x/layout.canvas.width, ny:point.y/layout.canvas.height});
    const prepared = send('open', 5, at(pair.item));
    const picked = send('closed', 5, {...at(pair.item), apertures:{index:.10,middle:.15}});
    return {prepared,picked,target:pair.target,layout};
  });
  await page.screenshot({ path: `${outDir}/${viewport.name}-game-held.png` });
  const released = await page.evaluate(target => {
    const layout=window.__qa.level67Layout();
    const at={nx:target.x/layout.canvas.width,ny:target.y/layout.canvas.height};
    for(let i=0;i<30;i++) window.__qa.setLevel6ToolFrame({
      gesture:'closed',stepMs:120,poseMissing:['shoulder','elbow','wrist'],
      apertures:{index:.10,middle:.15},...at,
    });
    for(let i=0;i<8;i++) window.__qa.setLevel6ToolFrame({
      gesture:'open',stepMs:120,poseMissing:['shoulder','elbow','wrist'],...at,
    });
    return window.__qa.level6ToolState();
  }, flow.target);
  await page.screenshot({ path: `${outDir}/${viewport.name}-game-released.png` });

  const fit = await page.evaluate(() => ({
    viewport:{width:innerWidth,height:innerHeight},
    scrollWidth:document.documentElement.scrollWidth,
    scrollHeight:document.documentElement.scrollHeight,
    horizontalOverflow:document.documentElement.scrollWidth > document.documentElement.clientWidth,
    gameCanvas:document.getElementById('gameCanvas').getBoundingClientRect().toJSON(),
    rest:document.querySelector('[data-testid="button-game-rest"]').getBoundingClientRect().toJSON(),
    stop:document.querySelector('[data-testid="button-game-stop"]').getBoundingClientRect().toJSON(),
  }));
  report.push({viewport,catalog,setupChecks,flow,released,fit,errors});
  await context.close();
}

await browser.close();
fs.writeFileSync(`${outDir}/qa-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map(row => ({
  viewport:row.viewport.name,
  catalog:row.catalog.map(card => card.theme),
  allPinchCopy:row.setupChecks.every(check =>
    !/肩屈曲|手肘|抬高手臂/.test(check.context) && check.targetCardHidden && !check.duplicateTaskPicker),
  prepared:row.flow.prepared.handOpenPrep,
  picked:row.flow.picked.grabCount,
  releasedScore:row.released.correctCount,
  horizontalOverflow:row.fit.horizontalOverflow,
  errors:row.errors,
})), null, 2));
