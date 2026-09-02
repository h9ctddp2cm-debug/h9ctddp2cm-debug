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
  try{
    const {chromium}=await import('playwright');
    browser=await chromium.launch();
  }catch(error){
    browser=null;
    console.warn('playwright unavailable; browser checks skipped:',error.message);
  }
});
after(async()=>{ if(browser) await browser.close(); });

async function withPage(viewport,fn){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
  await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
  try{ await fn(page); }finally{ await context.close(); }
}

test('processed left/right Level 6 cursor assets are transparent 191x133 PNG files',()=>{
  for(const side of ['right','left']){
    const data=readFileSync(path.join(root,'img',`level6_pinch_${side}.png`));
    assert.equal(data.subarray(1,4).toString(),'PNG');
    assert.equal(data.readUInt32BE(16),191);
    assert.equal(data.readUInt32BE(20),133);
    assert.equal(data[25],6,'PNG uses RGBA colour type');
  }
});

test('public Level 6 uses affected-side image cues on both tracked cursor renderers',()=>{
  assert.match(html,/imgLevel6PinchRight\.src = 'img\/level6_pinch_right\.png'/);
  assert.match(html,/imgLevel6PinchLeft\.src = 'img\/level6_pinch_left\.png'/);
  assert.match(html,/function level6PinchHandGeometry[\s\S]*?activeAffectedSide\(\)==='left'/);
  assert.match(html,/function drawPublicLevel6ClosedPinchCursor[\s\S]*?geometry\.side==='left'/);
  assert.match(html,/if\(isLevel6\(\) && isGrasping\)\{\s*drawPublicLevel6ClosedPinchCursor\(ctx,cursorPoint\.x/);
  assert.match(html,/function advDrawCursor[\s\S]*?if\(isLevel6\(\) && isGrasping\)\{\s*drawPublicLevel6ClosedPinchCursor\(ctx,cursorX/);
  assert.match(html,/if\(patientMode\)\{[\s\S]{0,300}statusBar\.innerHTML = '';/);
});

test('held-object display offset is side-aware and does not alter logical control coordinates',()=>{
  const helper=html.match(/function publicLevel6HeldDisplayPoint[\s\S]*?\n\}/)?.[0]||'';
  assert.match(helper,/activeAffectedSide\(\)==='right' \? -1 : 1/);
  assert.match(helper,/radius\*\.78/);
  assert.match(html,/const visualPoint=publicLevel6HeldDisplayPoint\(f\.x,f\.y,visualR,f\.held\)/);
  assert.match(html,/const visualPoint=publicLevel6HeldDisplayPoint\(cursorX,cursorY,Math\.max\(46,s\*\.30\)\)/);
  assert.match(html,/heldItem\.x = cursorX;\s*heldItem\.y = cursorY;/,
    'logical held item remains on the selected-hand cursor');
});

test('Level 6 Flowers routes to the same public arrangement geometry as Level 5 but remains pinch',async t=>{
  if(!browser) return t.skip('playwright unavailable');
  await withPage({width:820,height:1180},async page=>{
    const result=await page.evaluate(()=>{
      window.__qa.startGame({level:'5',theme:'flowers',duration:60,affectedSide:'right'});
      const level5=window.__qa.level67Layout();
      window.__qa.startGame({level:'67',level6Task:'flowers',duration:60,affectedSide:'right'});
      const level6=window.__qa.level67Layout();
      return {level5,level6,state:window.__qa.state()};
    });
    assert.equal(result.level5.advancedModule,'flowers');
    assert.equal(result.level6.advancedModule,'flowers');
    assert.equal(result.state.gameType,'pinch');
    assert.equal(result.state.theme,'flowers');
    assert.deepEqual(result.level6.targets,result.level5.targets);
    assert.deepEqual(result.level6.items,result.level5.items);
  });
});

test('Level 5 dim sum initial state keeps source items low and steamers high',async t=>{
  if(!browser) return t.skip('playwright unavailable');
  for(const viewport of [
    {width:390,height:844},
    {width:820,height:1180},
    {width:768,height:1024},
    {width:320,height:568},
    {width:1180,height:820},
  ]){
    await withPage(viewport,async page=>{
      const result=await page.evaluate(()=>{
        window.__qa.startGame({level:'5',theme:'dimsum',duration:60,affectedSide:'right'});
        const first=window.__qa.level67Layout();
        window.__qa.startGame({level:'5',theme:'dimsum',duration:60,affectedSide:'right'});
        return {layout:first,restarted:window.__qa.level67Layout(),state:window.__qa.state()};
      });
      const {layout,restarted,state}=result;
      assert.equal(state.held,null,'preview is a true initial, unheld state');
      assert.equal(layout.items.length,3,'exactly three source dim sum pieces are shown');
      assert.equal(layout.targets.length,2,'only the two steamers occupy the upper target zone');
      assert.deepEqual(
        restarted.items.map(({x,y,r})=>({x,y,r})),
        layout.items.map(({x,y,r})=>({x,y,r})),
        'source slots are fixed rather than random',
      );
      assert.ok(layout.items.every(item=>item.y-item.r>layout.canvas.height*.50),
        'every complete source image begins below the screen midpoint');
      assert.ok(layout.targets.every(target=>target.y+target.h/2<layout.canvas.height*.50),
        'every complete steamer ends above the screen midpoint');
      for(const item of layout.items){
        assert.ok(item.x-item.r>=0 && item.x+item.r<=layout.canvas.width,
          'each complete source image remains inside the canvas horizontally');
        assert.ok(item.y+item.r<=layout.canvas.height,
          'each complete source image remains inside the canvas vertically');
      }
      for(let left=0;left<layout.items.length;left++){
        for(let right=left+1;right<layout.items.length;right++){
          const a=layout.items[left],b=layout.items[right];
          assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r+12,
            `source pieces ${left}/${right} retain a clear visible gap`);
        }
      }
      for(const item of layout.items) for(const target of layout.targets){
        const nearestX=Math.max(target.x-target.w/2,Math.min(item.x,target.x+target.w/2));
        const nearestY=Math.max(target.y-target.h/2,Math.min(item.y,target.y+target.h/2));
        assert.ok(Math.hypot(item.x-nearestX,item.y-nearestY)>=item.r,
          'source images never obscure a steamer');
      }
    });
  }
});

test('Level 5 dim sum geometry derives radius from responsive slots and required visual gap',()=>{
  assert.match(html,/function publicLevel5DimsumGeometry\(cw,ch\)/);
  assert.match(html,/\[\[0\.50,0\.64\],\[0\.24,0\.86\],\[0\.76,0\.86\]\]/);
  assert.match(html,/\[\[0\.18,0\.76\],\[0\.50,0\.76\],\[0\.82,0\.76\]\]/);
  assert.match(html,/slot\.y-ch\/2/,'radius accounts for the complete lower-half boundary');
  assert.match(html,/Math\.hypot\(slots\[i\]\.x-slots\[j\]\.x,slots\[i\]\.y-slots\[j\]\.y\)-visibleGap/);
  assert.match(html,/publicLevel5DimsumGeometry\(cw,ch\)\.maxRadius/);
});

test('Level 5 dim sum refill selects the genuinely empty slot instead of overlapping an occupied slot',()=>{
  const start=html.indexOf('function publicLevel5DimsumGeometry(cw,ch)');
  const end=html.indexOf('function isPublicSideCardGame()',start);
  assert.ok(start>=0&&end>start,'dim sum slot helpers exist');
  const helpers=html.slice(start,end);
  const {geometry,freeSlot}=new Function(
    `${helpers}; return {
      geometry:publicLevel5DimsumGeometry,
      freeSlot:publicLevel5DimsumFreeSlot
    };`
  )();
  const cw=1330,ch=759;
  const g=geometry(cw,ch);
  const r=g.maxRadius;
  const existing=[
    {x:g.slots[1].x,y:g.slots[1].y,r,removed:false},
    {x:g.slots[2].x,y:g.slots[2].y,r,removed:false},
  ];
  const replacement=freeSlot(existing,cw,ch,r);
  assert.deepEqual(replacement,g.slots[0],
    'refill returns to the vacated left slot, not the occupied lower-right slot');
  for(const food of existing){
    assert.ok(Math.hypot(replacement.x-food.x,replacement.y-food.y)>=
      r+food.r+g.visibleGap-0.5,'replacement preserves the configured visual gap');
  }
  assert.match(html,/const slot = publicLevel5DimsumFreeSlot\(existingFoods,cw,ch,r\)/);
});

test('chopstick tool-relative flex can enter and release while aperture is occluded, but one digit cannot release',async t=>{
  if(!browser) return t.skip('playwright unavailable');
  await withPage({width:1180,height:820},async page=>{
    const result=await page.evaluate(()=>{
      window.__qa.startGame({level:'67',level6Task:'chopsticks',duration:60,affectedSide:'right'});
      window.__qa.resetLevel6ToolAdapt();
      const entered=window.__qa.level6ChopstickFlexProbe(1.38,1.40,false,false);
      const released=window.__qa.level6ChopstickFlexProbe(1.76,1.74,true,true);
      const oneDigit=window.__qa.level6ChopstickFlexProbe(1.76,1.40,true,true);
      window.__qa.resetLevel6ToolAdapt();
      for(let i=0;i<120;i++) window.__qa.level6ChopstickFlexProbe(1.40,1.40,false,false);
      const staticThresholds=window.__qa.level6ToolAdaptState().flex;
      window.__qa.resetLevel6ToolAdapt();
      for(let i=0;i<120;i++){
        const index=i%2?1.78:1.36;
        window.__qa.level6ChopstickFlexProbe(index,1.40,false,false);
      }
      const oneDigitThresholds=window.__qa.level6ToolAdaptState().flex;
      return {entered,released,oneDigit,
        staticThresholds,oneDigitThresholds};
    });
    assert.equal(result.entered.isPinching,true,'dual-finger flex can close despite unusable thumb aperture');
    assert.equal(result.released.isPinching,false,'true dual-finger extension can release');
    assert.equal(result.oneDigit.isPinching,true,'one extending digit cannot release');
    assert.equal(result.staticThresholds,null,'static posture cannot self-calibrate');
    assert.equal(result.oneDigitThresholds,null,'one drifting digit cannot self-calibrate');
  });
});

test('Level 6 status card stays empty after duplicate side icon removal',async t=>{
  if(!browser) return t.skip('playwright unavailable');
  await withPage({width:820,height:1180},async page=>{
    const sources=await page.evaluate(()=>{
      const cue=(side)=>{
        window.__qa.startGame({level:'67',level6Task:'flowers',duration:60,affectedSide:side});
        return window.__qa.forceActionPrompt('三指輕捏','').image;
      };
      return {right:cue('right'),left:cue('left')};
    });
    assert.equal(sources.right,null);
    assert.equal(sources.left,null);
  });
});

test('audio-only patient phrase mapping follows Level 5 and each Level 6 tool release',async t=>{
  if(!browser) return t.skip('playwright unavailable');
  await withPage({width:1180,height:820},async page=>{
    const result=await page.evaluate(()=>{
      const run=(start,expectedTarget)=>{
        window.__qa.startGame({...start,duration:60,affectedSide:'right'});
        const contact=window.__qa.publicPatientVoiceProbe({
          reset:true,resetCooldown:true,phase:'contact',itemId:'a',
        }).phrase;
        window.__qa.publicPatientVoiceProbe({
          phase:'pickup',itemId:'a',itemY:700,targetY:180,
        });
        const target=window.__qa.publicPatientVoiceProbe({
          phase:'held',itemId:'a',itemY:700,targetY:180,cursorY:180,
          onTarget:true,stillGrasped:true,stepMs:3000,
        }).phrase;
        return {contact,target,expectedTarget};
      };
      return {
        level5:run({level:'5',theme:'dimsum'},'打開隻手'),
        chopsticks:run({level:'67',level6Task:'chopsticks'},'打開筷子'),
        peg:run({level:'67',level6Task:'peg'},'放手'),
        flowers:run({level:'67',level6Task:'flowers'},'打開隻手'),
      };
    });
    assert.deepEqual(result.level5,{contact:'揸拳頭',target:'打開隻手',expectedTarget:'打開隻手'});
    for(const [name,value] of Object.entries(result).filter(([key])=>key!=='level5')){
      assert.equal(value.contact,'夾住',`${name} uses the short Level 6 pickup cue`);
      assert.equal(value.target,value.expectedTarget,`${name} uses its release cue`);
    }
  });
});

test('patient voice proximity, phase, dedup, cooldown, drop reset, and research exclusion fail quiet',async t=>{
  if(!browser) return t.skip('playwright unavailable');
  await withPage({width:1180,height:820},async page=>{
    const result=await page.evaluate(()=>{
      window.__qa.startGame({level:'5',theme:'dimsum',duration:60,affectedSide:'right'});
      const away=window.__qa.publicPatientVoiceProbe({
        reset:true,resetCooldown:true,phase:'contact',itemId:'a',touching:false,
      });
      const contact=window.__qa.publicPatientVoiceProbe({phase:'contact',itemId:'a'});
      const duplicate=window.__qa.publicPatientVoiceProbe({
        phase:'contact',itemId:'a',stepMs:100,
      });
      const reset=window.__qa.publicPatientVoiceProbe({phase:'drop'});
      const cooldown=window.__qa.publicPatientVoiceProbe({
        phase:'contact',itemId:'b',stepMs:100,
      });
      const afterCooldown=window.__qa.publicPatientVoiceProbe({
        phase:'contact',itemId:'b',stepMs:3000,
      });
      const research=window.__qa.publicPatientVoiceProbe({
        reset:true,resetCooldown:true,phase:'contact',itemId:'research',
        researchActive:true,
      });
      return {away,contact,duplicate,reset,cooldown,afterCooldown,research};
    });
    assert.equal(result.away.phrase,'','no contact means no cue');
    assert.equal(result.contact.phrase,'揸拳頭');
    assert.equal(result.duplicate.phrase,'','the same contact cannot chatter');
    assert.equal(result.reset.spokenCount,0,'drop resets cycle dedup state');
    assert.equal(result.reset.holdId,'','drop resets held-phase state');
    assert.equal(result.cooldown.phrase,'','cross-cycle cooldown remains strong');
    assert.equal(result.afterCooldown.phrase,'揸拳頭','new cycle can speak after cooldown');
    assert.equal(result.research.phrase,'','research mode is excluded');
    assert.equal(result.research.spokenCount,0,'research mode records no cue');
  });
});

test('raise-hand cue requires a stalled bottom-to-top hold and excludes side or non-upper targets',async t=>{
  if(!browser) return t.skip('playwright unavailable');
  await withPage({width:1180,height:820},async page=>{
    const result=await page.evaluate(()=>{
      const stalled=(start,targetY,cursorY)=>{
        window.__qa.startGame({...start,duration:60,affectedSide:'right'});
        window.__qa.publicPatientVoiceProbe({
          reset:true,resetCooldown:true,phase:'pickup',itemId:'a',
          itemY:700,targetY,
        });
        return window.__qa.publicPatientVoiceProbe({
          phase:'held',itemId:'a',itemY:700,targetY,cursorY,
          onTarget:false,stillGrasped:true,stepMs:1700,
        });
      };
      return {
        vertical:stalled({level:'5',theme:'dimsum'},180,695),
        progressed:stalled({level:'5',theme:'dimsum'},180,560),
        side:stalled({level:'67',level6Task:'cards'},180,695),
        targetBelow:stalled({level:'67',level6Task:'flowers'},760,695),
      };
    });
    assert.equal(result.vertical.phrase,'舉高手');
    assert.equal(result.progressed.phrase,'','meaningful upward progress suppresses the cue');
    assert.equal(result.side.phrase,'','side-target cards never ask for upward movement');
    assert.equal(result.side.targetAbove,false);
    assert.equal(result.targetBelow.phrase,'','a target that is not above never asks for upward movement');
    assert.equal(result.targetBelow.targetAbove,false);
  });
});

test('patient voice guide remains audio-only and cannot change interaction safety gates',()=>{
  const helper=html.match(/function updatePublicPatientVoiceGuide\(spec\)[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(helper,/setActionPrompt|innerHTML|textContent|correctCount|grabCount|heldItem\s*=/);
  assert.match(helper,/if\(!publicPatientVoiceEligible\(\)\) return ''/);
  assert.match(html,/return !research\.active && isPatientVisualCueMode\(\) && state\.running && !state\.paused/);
  assert.match(html,/PUBLIC_PATIENT_VOICE_COOLDOWN_MS = 2800/);
});
