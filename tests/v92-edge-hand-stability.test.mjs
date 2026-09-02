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

async function withPortraitPage(fn,arg){
  const context=await browser.newContext({viewport:{width:820,height:1180}});
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
  await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
  try{
    return await page.evaluate(fn,arg);
  }finally{
    await context.close();
  }
}

test('portrait cover mapping reaches a stable bottom-right safe area',async()=>{
  const result=await withPortraitPage(()=>{
    window.__qa.startGame({level:'5',theme:'dimsum',duration:60,affectedSide:'right'});
    return window.__qa.trackingProbe(.648,.858,[
      [.646,.856],[.649,.859],[.647,.857],
    ],{width:1920,height:1080});
  });
  const last=result.mapped.at(-1);
  assert.ok(last.x>result.canvas.width*.94,'landscape camera crop still reaches the right edge');
  assert.ok(last.y>result.canvas.height*.94,'safe-area expansion still reaches the bottom edge');
  assert.ok(result.mapped.every(point=>
    point.x>=0&&point.x<=result.canvas.width&&point.y>=0&&point.y<=result.canvas.height));
  assert.ok(Math.max(...result.mapped.map(p=>p.x))-Math.min(...result.mapped.map(p=>p.x))<12,
    'three-frame median suppresses edge coordinate noise');
});

for(const affectedSide of ['right','left']){
  test(`Level 5 ${affectedSide} hand keeps its open arm through a brief bottom-right miss`,async()=>{
    const result=await withPortraitPage((side)=>{
      window.__qa.startGame({
        level:'5',theme:'dimsum',duration:60,affectedSide:side,
      });
      const initial=window.__qa.state();
      const item=initial.items.slice().sort((a,b)=>(b.x+b.y)-(a.x+a.y))[0];
      window.__qa.snapCursor();
      window.__qa.setHandAt(item.x,item.y,false,true);
      window.advanceTime(140);
      const armed=window.__qa.state();
      window.__qa.clearHand();
      window.advanceTime(240);
      const missed=window.__qa.state();
      window.__qa.setHandAt(item.x,item.y,true,false);
      window.advanceTime(360);
      return {armed,missed,picked:window.__qa.state()};
    },affectedSide);
    assert.equal(result.armed.held,null);
    assert.equal(result.missed.detectionHeldGrace,true);
    assert.deepEqual(result.missed.cursor,result.armed.cursor,'brief miss freezes the visible cursor');
    assert.notEqual(result.picked.held,null,'fresh close can use the previously proven open arm');
    assert.equal(result.picked.grabCount,1,'dropout cannot create duplicate pickup transitions');
  });
}

test('Level 5 keeps its open preparation through a brief partial-landmark miss',async()=>{
  const result=await withPortraitPage(()=>{
    window.__qa.startGame({
      level:'5',theme:'dimsum',duration:60,affectedSide:'right',
    });
    const initial=window.__qa.state();
    const item=initial.items.slice().sort((a,b)=>(b.x+b.y)-(a.x+a.y))[0];
    window.__qa.snapCursor();
    window.__qa.setHandAt(item.x,item.y,false,true);
    window.advanceTime(140);
    const armed=window.__qa.state();
    window.__qa.setTrackingMiss('required-landmarks-missing');
    window.advanceTime(240);
    const missed=window.__qa.state();
    window.__qa.setHandAt(item.x,item.y,true,false);
    window.advanceTime(360);
    return {armed,missed,picked:window.__qa.state()};
  });
  assert.equal(result.armed.held,null);
  assert.equal(result.missed.detectionHeldGrace,true,
    'a brief missing fingertip uses Level 5 tracking grace');
  assert.deepEqual(result.missed.cursor,result.armed.cursor,
    'partial-landmark miss keeps the last stable cursor');
  assert.notEqual(result.picked.held,null,
    'fresh close after the brief miss can still pick up');
  assert.equal(result.picked.grabCount,1);
});

for(const spec of [
  {task:'peg',side:'right'},
  {task:'peg',side:'left'},
]){
  test(`Level 6 ${spec.task} ${spec.side} edge dropout preserves gesture continuity and sprite bounds`,async()=>{
    const result=await withPortraitPage(({task,side})=>{
      window.__qa.startGame({
        level:'67',level6Task:task,duration:60,affectedSide:side,
      });
      const layout=window.__qa.level67Layout();
      const item=layout.items.slice().sort((a,b)=>(b.x+b.y)-(a.x+a.y))[0];
      const atItem={nx:item.x/layout.canvas.width,ny:item.y/layout.canvas.height};
      for(let i=0;i<5;i++) window.__qa.setLevel6ToolFrame({
        ...atItem,gesture:'open',handSide:side,stepMs:100,
        poseMissing:['shoulder','elbow','wrist'],
      });
      const armed=window.__qa.level6ToolState();
      window.__qa.setLevel6ToolFrame({
        ...atItem,noHand:true,gesture:'open',handSide:side,stepMs:220,
        poseMissing:['shoulder','elbow','wrist'],
      });
      const missed=window.__qa.level6ToolState();
      for(let i=0;i<6;i++) window.__qa.setLevel6ToolFrame({
        ...atItem,gesture:'closed',handSide:side,stepMs:100,
        apertures:{index:.10,middle:.15},
        poseMissing:['shoulder','elbow','wrist'],
      });
      const picked=window.__qa.level6ToolState();
      const samples=[];
      for(let i=0;i<18;i++){
        window.__qa.setLevel6ToolFrame({
          nx:.985-(i%3)*.003,ny:.985-(i%2)*.004,
          gesture:'closed',handSide:side,stepMs:70,
          apertures:{index:.10,middle:.15},
          poseMissing:['shoulder','elbow','wrist'],
        });
        const current=window.__qa.level6ToolState();
        samples.push(current.heldPosition);
      }
      return {layout,item,armed,missed,picked,samples,final:window.__qa.level6ToolState()};
    },spec);
    assert.equal(result.armed.basic.armed,true,'fresh open frames arm pickup');
    assert.equal(result.missed.handDetected,true,'brief total hand miss enters edge grace');
    assert.equal(result.missed.basic.armed,true,'edge miss does not erase proven open preparation');
    assert.notEqual(result.picked.held,null,'fresh close after the miss picks up');
    assert.equal(result.picked.grabCount,1);
    assert.ok(result.samples.every(Boolean),'the held item never disappears');
    assert.ok(result.samples.every(point=>
      point.x-result.item.r>=-0.01&&point.x+result.item.r<=result.layout.canvas.width+.01&&
      point.y-result.item.r>=-0.01&&point.y+result.item.r<=result.layout.canvas.height+.01),
    'carried garment/dim sum remains fully on canvas at the bottom-right edge');
    assert.equal(result.final.grabCount,1,'edge noise cannot oscillate pickup/drop state');
  });
}

test('Level 5 remains responsive through two virtual minutes of repeated pickup/drop cycles',async()=>{
  const result=await withPortraitPage(()=>{
    window.__qa.startGame({
      level:'5',theme:'dimsum',duration:300,affectedSide:'right',
    });
    const cycles=30;
    for(let cycle=0;cycle<cycles;cycle++){
      const state=window.__qa.state();
      const item=state.items.find(candidate=>
        state.targets.some(target=>target.type===candidate.type));
      const target=state.targets.find(candidate=>candidate.type===item.type);
      window.__qa.snapCursor();
      window.__qa.setHandAt(item.x,item.y,false,true);
      window.advanceTime(500);
      window.__qa.setHandAt(item.x,item.y,true,false);
      window.advanceTime(260);
      window.__qa.snapCursor();
      window.__qa.setHandAt(target.x,target.y,true,false);
      window.advanceTime(120);
      window.__qa.setHandAt(target.x,target.y,false,true);
      window.advanceTime(420);
      window.advanceTime(2700);
    }
    return {cycles,state:window.__qa.state()};
  });
  assert.equal(result.state.running,true,'game loop remains live after 120 virtual seconds');
  assert.equal(result.state.held,null,'final garment/food is released');
  assert.equal(result.state.grabCount,result.cycles,'one pickup per cycle');
  assert.equal(result.state.correctCount,result.cycles,'one scored drop per cycle');
  assert.ok(result.state.items.every(item=>
    item.x-item.r>=-0.01&&item.x+item.r<=820+.01&&
    item.y-item.r>=-0.01&&item.y+item.r<=1180+.01),
  'replenished sprites remain on canvas');
});

test('Level 6 laundry garments remain bounded and responsive through two virtual minutes of cycling',async()=>{
  const result=await withPortraitPage(()=>{
    window.__qa.startGame({
      level:'67',level6Task:'peg',duration:300,affectedSide:'right',
    });
    let generation=1;
    const frame=(gesture,count,point)=>{
      for(let i=0;i<count;i++) window.__qa.setLevel6ToolFrame({
        ...point,gesture,handSide:'right',stepMs:220,generation:generation++,
        ...(gesture==='closed'?{apertures:{index:.10,middle:.15}}:{}),
        poseMissing:['shoulder','elbow','wrist'],
      });
    };
    const cycles=24;
    const positions=[];
    for(let cycle=0;cycle<cycles;cycle++){
      const layout=window.__qa.level67Layout();
      const needed=layout.laundryOrder?.lines
        .filter(line=>line.placed<line.need).map(line=>line.type)||[];
      const item=layout.items.find(candidate=>!needed.length||needed.includes(candidate.type))
        ||layout.items[0];
      const target=layout.targets.find(candidate=>candidate.type==='laundry_rack');
      const at=point=>({nx:point.x/layout.canvas.width,ny:point.y/layout.canvas.height});
      frame('open',4,at(item));
      frame('closed',5,at(item));
      frame('closed',4,{nx:.985,ny:.985});
      positions.push(window.__qa.level6ToolState().heldPosition);
      frame('closed',4,at(target));
      frame('open',7,at(target));
    }
    return {
      cycles,positions,layout:window.__qa.level67Layout(),
      state:window.__qa.level6ToolState(),running:window.__qa.state().running,
    };
  });
  assert.equal(result.running,true,'laundry loop remains responsive');
  assert.equal(result.state.held,null,'last garment is released');
  assert.equal(result.state.grabCount,result.cycles,'laundry has one pickup per cycle');
  assert.ok(result.positions.every(Boolean),'no carried garment disappears');
  assert.ok(result.positions.every(point=>
    point.x>=0&&point.x<=result.layout.canvas.width&&
    point.y>=0&&point.y<=result.layout.canvas.height),
  'garments cannot fly beyond the canvas during edge transport');
  assert.equal(result.layout.insideCanvas,true,'all replenished laundry objects remain on canvas');
});
