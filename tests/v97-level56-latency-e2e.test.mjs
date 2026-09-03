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

async function withPage(viewport,fn){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
  await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
  try{
    return await page.evaluate(fn);
  }finally{
    await context.close();
  }
}

test('Level 6 chopsticks follows each latest hand frame immediately without Pose',async()=>{
  const result=await withPage({width:1180,height:820},()=>{
    window.__qa.startGame({
      level:'67',level6Task:'chopsticks',duration:60,
      affectedSide:'right',dwellMs:200,
    });
    const canvas=window.__qa.level67Layout().canvas;
    window.__qa.setLevel6ToolFrame({
      nx:.30,ny:.35,gesture:'open',handSide:'right',generation:1,
      poseMissing:['shoulder','elbow','wrist'],
    });
    const first=window.__qa.level6ToolState();
    window.__qa.setLevel6ToolFrame({
      nx:.70,ny:.65,gesture:'closed',handSide:'right',generation:2,
      poseMissing:['shoulder','elbow','wrist'],
    });
    const second=window.__qa.level6ToolState();
    return {canvas,first,second};
  });

  assert.equal(result.first.handDetected,true);
  assert.equal(result.second.handDetected,true);
  assert.ok(Math.abs(result.first.cursor.x-result.canvas.width*.30)<1);
  assert.ok(Math.abs(result.first.cursor.y-result.canvas.height*.35)<1);
  assert.ok(Math.abs(result.second.cursor.x-result.canvas.width*.70)<1,
    'second hand frame reaches the cursor with no median/EMA trail');
  assert.ok(Math.abs(result.second.cursor.y-result.canvas.height*.65)<1,
    'missing Pose landmarks cannot block the hand-only Level 6 path');
  assert.equal(result.second.gameType,'dwell',
    'chopsticks remains affected index-fingertip dwell, not a flexion gate');
});

test('large public stage uses bounded backing pixels without changing CSS size',async()=>{
  const result=await withPage({width:1920,height:1080},()=>{
    window.__qa.startGame({
      level:'67',level6Task:'flower',duration:60,affectedSide:'right',
    });
    const canvas=document.getElementById('gameCanvas');
    const rect=canvas.getBoundingClientRect();
    return {
      backing:{width:canvas.width,height:canvas.height},
      css:{width:rect.width,height:rect.height},
    };
  });

  assert.ok(result.backing.width<=1600);
  assert.ok(result.backing.width*result.backing.height<=1440000);
  assert.equal(Math.round(result.css.width),1920);
  assert.equal(Math.round(result.css.height),1080);
});
