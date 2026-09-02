import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pageUrl=pathToFileURL(path.join(root,'index.html')).href;
let browser;

before(async()=>{
  const {chromium}=await import('playwright');
  browser=await chromium.launch();
});
after(async()=>{ await browser?.close(); });

async function withPage(fn){
  const context=await browser.newContext({viewport:{width:820,height:1180}});
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
  await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
  try{
    return await page.evaluate(fn);
  }finally{
    await context.close();
  }
}

test('public Level 5 cursor follows the latest hand frame directly',async()=>{
  const result=await withPage(()=>{
    window.__qa.startGame({
      level:'5',theme:'dimsum',duration:60,affectedSide:'right',
    });
    window.__qa.setHandAt(120,240,false,true);
    window.advanceTime(80);
    const first=window.__qa.state().cursor;
    window.__qa.setHandAt(700,900,false,true);
    window.advanceTime(40);
    const second=window.__qa.state().cursor;
    return {first,second};
  });
  assert.ok(Math.abs(result.first.x-120)<1&&Math.abs(result.first.y-240)<1);
  assert.ok(Math.abs(result.second.x-700)<1&&Math.abs(result.second.y-900)<1,
    'latest Level 5 frame is not delayed by median or EMA filtering');
});

test('public chopstick game uses affected index-finger dwell with no open-close gate',async()=>{
  const result=await withPage(()=>{
    window.__qa.startGame({
      level:'67',level6Task:'chopsticks',duration:60,
      affectedSide:'right',dwellMs:200,
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
    window.__qa.setHandAt(target.x,target.y,false,true);
    window.advanceTime(700);
    return {gameType:initial.gameType,picked,placed:window.__qa.state()};
  });
  assert.equal(result.gameType,'dwell');
  assert.notEqual(result.picked.held,null,'index-finger dwell picks up the dim sum');
  assert.equal(result.placed.held,null,'index-finger dwell on the target releases it');
  assert.equal(result.placed.correctCount,1);
});
