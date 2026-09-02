import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(root,'index.html'),'utf8');
const pageUrl=pathToFileURL(path.join(root,'index.html')).href;
let browser;

before(async()=>{
  const {chromium}=await import('playwright');
  browser=await chromium.launch();
});
after(async()=>{ await browser?.close(); });

async function scenario(fn){
  const context=await browser.newContext({viewport:{width:1180,height:820}});
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
  await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
  try{
    return await page.evaluate(fn);
  }finally{
    await context.close();
  }
}

test('chopstick source contract uses index-fingertip dwell rather than open-close detection',()=>{
  assert.match(html,/chopsticks:\{[\s\S]{0,500}gameType:'dwell'/);
  assert.match(html,/function isLevel6ToolGestureTask\(\)\{ return isLevel6\(\) && !isLevel6Chopsticks\(\); \}/);
  assert.match(html,/食指尖/);
});

test('index-fingertip dwell picks up even when the hand starts partly closed',async()=>{
  const result=await scenario(()=>{
    window.__qa.startGame({
      level:'67',level6Task:'chopsticks',duration:60,
      affectedSide:'right',dwellMs:200,
    });
    const initial=window.__qa.state();
    const item=initial.items[0];
    window.__qa.snapCursor();
    window.__qa.setHandAt(item.x,item.y,true,true);
    window.advanceTime(1200);
    return {initial,after:window.__qa.state()};
  });
  assert.equal(result.initial.gameType,'dwell');
  assert.notEqual(result.after.held,null,
    'hand open-close range is not required for chopstick pickup');
  assert.equal(result.after.grabCount,1);
});

test('index-fingertip dwell releases on the matching target without calibration',async()=>{
  const result=await scenario(()=>{
    window.__qa.startGame({
      level:'67',level6Task:'chopsticks',duration:60,
      affectedSide:'left',dwellMs:200,
    });
    const initial=window.__qa.state();
    const item=initial.items[0];
    const target=initial.targets.find(candidate=>
      candidate.type===item.targetType||candidate.type==='dimsum_plate');
    window.__qa.snapCursor();
    window.__qa.setHandAt(item.x,item.y,false,true);
    window.advanceTime(700);
    const picked=window.__qa.state();
    window.__qa.snapCursor();
    window.__qa.setHandAt(target.x,target.y,true,true);
    window.advanceTime(700);
    return {picked,placed:window.__qa.state()};
  });
  assert.notEqual(result.picked.held,null);
  assert.equal(result.placed.held,null);
  assert.equal(result.placed.correctCount,1);
});
