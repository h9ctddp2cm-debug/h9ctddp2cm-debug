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

async function withPage(fn, viewport={width:1180,height:820}){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
  try{
    const value=await page.evaluate(fn);
    return {value,errors};
  }finally{
    await context.close();
  }
}

// Synthetic MediaPipe-style result: 21 landmarks of one hand at wrist (wx,wy).
const HAND_FACTORY=`
  const hand=(wx,wy,label,score)=>{
    const lm=[];
    for(let i=0;i<21;i++){
      lm.push({x:wx+(i%5)*0.03, y:wy-Math.floor(i/5)*0.05, z:0});
    }
    const handednesses=label==null?[[]]:[[{categoryName:label,score}]];
    return {landmarks:[lm], handednesses, worldLandmarks:[lm]};
  };
`;

test('chopsticks calibration/tracking never throws on a hand-less frame and fails closed',async()=>{
  const {value,errors}=await withPage(()=>{
    window.__qa.startGame({level:'67',level6Task:'chopsticks',duration:60,affectedSide:'right'});
    const empty=window.__qa.interpretHand({landmarks:[],handednesses:[]},false);
    const nullish=window.__qa.interpretHand(null,false);
    return {empty,nullish};
  });
  assert.equal(errors.length,0,'no uncaught page errors');
  for(const [name,res] of Object.entries(value)){
    assert.notEqual(res.reason,'THROW',`${name}: interpretHandResults must not throw (${res.error||''})`);
    assert.equal(res.detected,false,`${name}: chopsticks fails closed without the affected hand`);
    assert.equal(res.reason,'no-hand-detected');
  }
});

test('gross tabletop levels tolerate a missing video element in the pose fallback',async()=>{
  const {value}=await withPage(()=>{
    window.__qa.startGame({level:'4',theme:'dimsum',duration:60,affectedSide:'right'});
    return window.__qa.interpretHand({landmarks:[],handednesses:[]},false);
  });
  assert.notEqual(value.reason,'THROW',value.error||'');
  assert.equal(value.detected,false);
});

test('public Level 5 keeps the same hand through a brief handedness dip but rejects a confident opposite hand',async()=>{
  const {value}=await withPage(new Function(`
    ${HAND_FACTORY}
    window.__qa.startGame({level:'5',theme:'dimsum',duration:60,affectedSide:'right'});
    window.__qa.resetHandTrack();
    const out={};
    // No prior track: an ambiguous label must fail closed.
    out.coldAmbiguous=window.__qa.interpretHand(hand(.5,.6,'Right',.40),false).detected;
    out.coldMissing=window.__qa.interpretHand(hand(.5,.6,null,null),false).detected;
    // Establish the track with a confident affected-side label.
    out.strict=window.__qa.interpretHand(hand(.5,.6,'Right',.98),false).detected;
    window.advanceTime(40);
    // Same place, label flipped with low confidence (fist frame).
    out.dipFlip=window.__qa.interpretHand(hand(.51,.61,'Left',.56),false).detected;
    window.advanceTime(40);
    out.dipLow=window.__qa.interpretHand(hand(.52,.60,'Right',.30),false).detected;
    window.advanceTime(40);
    out.dipMissing=window.__qa.interpretHand(hand(.52,.61,null,null),false).detected;
    window.advanceTime(40);
    // Confident opposite hand at the same place is still rejected.
    out.confidentOpposite=window.__qa.interpretHand(hand(.52,.61,'Left',.95),false).detected;
    window.advanceTime(40);
    // Ambiguous hand far away is rejected.
    out.farAmbiguous=window.__qa.interpretHand(hand(.15,.20,'Right',.40),false).detected;
    // After the continuity window lapses the ambiguous label fails closed again.
    window.advanceTime(800);
    out.expiredAmbiguous=window.__qa.interpretHand(hand(.52,.61,'Right',.40),false).detected;
    return out;
  `));
  assert.equal(value.coldAmbiguous,false,'cold ambiguous label fails closed');
  assert.equal(value.coldMissing,false,'cold missing label fails closed');
  assert.equal(value.strict,true,'confident affected label is selected');
  assert.equal(value.dipFlip,true,'low-confidence flipped label near the tracked wrist is kept');
  assert.equal(value.dipLow,true,'low-confidence affected label near the tracked wrist is kept');
  assert.equal(value.dipMissing,true,'missing label near the tracked wrist is kept');
  assert.equal(value.confidentOpposite,false,'confident opposite hand never substitutes');
  assert.equal(value.farAmbiguous,false,'ambiguous hand elsewhere is rejected');
  assert.equal(value.expiredAmbiguous,false,'continuity expires after the short window');
});

test('Level 6 keeps strict fail-closed handedness (no continuity rescue)',async()=>{
  const {value}=await withPage(new Function(`
    ${HAND_FACTORY}
    window.__qa.startGame({level:'67',level6Task:'flowers',duration:60,affectedSide:'right'});
    window.__qa.resetHandTrack();
    const strict=window.__qa.interpretHand(hand(.5,.6,'Right',.98),false).detected;
    window.advanceTime(40);
    const dip=window.__qa.interpretHand(hand(.51,.61,'Right',.30),false);
    return {strict,dip};
  `));
  assert.equal(value.strict,true);
  assert.equal(value.dip.detected,false);
  assert.equal(value.dip.reason,'affected-hand-not-detected');
});

test('handedness dropout grace applies to public Level 5 only',async()=>{
  const {value}=await withPage(()=>{
    const probe=()=>window.__qa.graspGraceEligible({detected:false,reason:'affected-hand-not-detected'});
    window.__qa.startGame({level:'5',theme:'dimsum',duration:60,affectedSide:'right'});
    const level5=probe();
    window.__qa.startGame({level:'67',level6Task:'flowers',duration:60,affectedSide:'right'});
    const level6=probe();
    window.__qa.startGame({level:'67',level6Task:'peg',duration:60,affectedSide:'right'});
    const peg=probe();
    return {level5,level6,peg};
  });
  assert.equal(value.level5,true);
  assert.equal(value.level6,false);
  assert.equal(value.peg,false);
});

test('Level 6 flowers: a placed flower stays inside the canvas on landscape and portrait',async()=>{
  for(const viewport of [{width:1180,height:820},{width:820,height:1180}]){
    const {value}=await withPage(()=>{
      window.__qa.startGame({level:'67',level6Task:'flowers',duration:60,affectedSide:'right'});
      const right=window.__qa.flowerSnapProbe(10_000);
      const left=window.__qa.flowerSnapProbe(-10_000);
      const centre=window.__qa.flowerSnapProbe(right.vase.x);
      return {right,left,centre};
    },viewport);
    const half=value.right.size*value.right.scale*0.36;
    assert.ok(value.right.x<=value.right.width-half,
      `${viewport.width}x${viewport.height}: far-right snap x=${value.right.x} exceeds width ${value.right.width}`);
    assert.ok(value.left.x>=half,
      `${viewport.width}x${viewport.height}: far-left snap x=${value.left.x} is off-canvas`);
    assert.ok(Math.abs(value.centre.x-value.centre.vase.x)<1,'central release lands at the vase centre');
    assert.ok(value.right.x>value.centre.x&&value.left.x<value.centre.x,'lateral placement is preserved');
  }
});
