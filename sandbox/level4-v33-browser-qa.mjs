import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4183';
const outDir = process.env.QA_OUT_DIR || path.resolve('..', 'ych_rehab_qa_artifacts', 'v33-browser');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

const poses = {
  flex: { shoulder:{x:.45,y:.30}, elbow:{x:.45,y:.48}, wrist:{x:.58,y:.48}, otherShoulder:{x:.60,y:.30} },
  reach: { shoulder:{x:.45,y:.30}, elbow:{x:.54,y:.35}, wrist:{x:.74,y:.36}, otherShoulder:{x:.60,y:.30} },
  outward: { shoulder:{x:.45,y:.30}, elbow:{x:.34,y:.33}, wrist:{x:.14,y:.29}, otherShoulder:{x:.60,y:.30} },
};
const results = [];
for (const [name, viewport] of Object.entries({
  ipad_landscape: { width:1180, height:820 },
  ipad_portrait: { width:820, height:1180 },
})) {
  const context = await browser.newContext({ viewport, serviceWorkers:'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(baseUrl, { waitUntil:'domcontentloaded' });
  const state = await page.evaluate((poses) => {
    window.__qa.startGame({level:'4',theme:'wipewindow',affectedSide:'left',duration:300});
    window.__qa.setLevel4Pose(poses.flex);
    window.__qa.level4ManualCapture('flexed');
    window.__qa.setLevel4Pose(poses.reach);
    window.__qa.level4ManualCapture('extended');
    window.__qa.setLevel4Pose(poses.outward);
    window.__qa.level4ManualCapture('horizontal');
    return {
      reach: window.__qa.level4ReachState(),
      label: document.getElementById('level4SelectedArmLabel')?.innerText,
      bar: document.getElementById('level4CalibBar')?.getBoundingClientRect().toJSON(),
      stage: document.querySelector('.game-stage')?.getBoundingClientRect().toJSON(),
    };
  }, poses);
  const screenshot = path.join(outDir, `level4-handsfree-${name}.png`);
  await page.screenshot({ path:screenshot, fullPage:false });
  results.push({
    name, viewport, screenshot, errors,
    selectedArmLabel: state.label,
    calibrated: state.reach.calibrated,
    gameReady: state.reach.gameReady,
    horizontalReady: state.reach.abductionCalibrated,
    panelInsideStage: state.bar && state.stage && state.bar.bottom <= state.stage.bottom + 1,
  });
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir,'level4-handsfree-browser-qa.json'), JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
