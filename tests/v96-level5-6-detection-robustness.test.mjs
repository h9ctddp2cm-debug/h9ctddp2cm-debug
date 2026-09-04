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

test('public Level 5 keeps the same hand through a handedness dip; a confident opposite hand never substitutes while the affected hand is in view (v98 policy)',async()=>{
  const {value}=await withPage(new Function(`
    ${HAND_FACTORY}
    const two=(a,b)=>({landmarks:[...a.landmarks,...b.landmarks],handednesses:[...a.handednesses,...b.handednesses]});
    window.__qa.startGame({level:'5',theme:'dimsum',duration:60,affectedSide:'right'});
    window.__qa.resetHandTrack();
    const out={};
    // v98: a LONE hand with an ambiguous or missing label is admitted.
    out.coldAmbiguous=window.__qa.interpretHand(hand(.5,.6,'Right',.40),false).detected;
    window.__qa.resetHandTrack();
    out.coldMissing=window.__qa.interpretHand(hand(.5,.6,null,null),false).detected;
    window.__qa.resetHandTrack();
    // A lone confidently opposite hand is NOT admitted within the first second.
    out.coldOpposite=window.__qa.interpretHand(hand(.5,.6,'Left',.95),false).detected;
    // Establish the track with a confident affected-side label.
    out.strict=window.__qa.interpretHand(hand(.5,.6,'Right',.98),false).detected;
    window.advanceTime(40);
    out.dipFlip=window.__qa.interpretHand(hand(.51,.61,'Left',.56),false).detected;
    window.advanceTime(40);
    out.dipLow=window.__qa.interpretHand(hand(.52,.60,'Right',.30),false).detected;
    window.advanceTime(40);
    out.dipMissing=window.__qa.interpretHand(hand(.52,.61,null,null),false).detected;
    window.advanceTime(40);
    // Two hands in view: confident opposite at the tracked place + another
    // confident opposite elsewhere -> nothing is admitted.
    out.confidentOpposite=window.__qa.interpretHand(two(hand(.52,.61,'Left',.95),hand(.15,.20,'Left',.95)),false).detected;
    window.advanceTime(40);
    // Two hands: ambiguous hand far from the track + confident opposite -> rejected.
    out.farAmbiguous=window.__qa.interpretHand(two(hand(.15,.20,'Right',.40),hand(.85,.20,'Left',.95)),false).detected;
    // Continuity now lasts 1500 ms: still kept ~1400 ms after the last admitted
    // frame (which renews the track), expired 1600 ms after that.
    window.advanceTime(1200);
    out.lateAmbiguous=window.__qa.interpretHand(two(hand(.52,.61,'Right',.40),hand(.85,.20,'Left',.95)),false).detected;
    window.advanceTime(1600);
    out.expiredAmbiguous=window.__qa.interpretHand(two(hand(.52,.61,'Right',.40),hand(.85,.20,'Left',.95)),false).detected;
    return out;
  `));
  assert.equal(value.coldAmbiguous,true,'lone ambiguous label is admitted (v98)');
  assert.equal(value.coldMissing,true,'lone missing label is admitted (v98)');
  assert.equal(value.coldOpposite,false,'lone confident opposite hand is not admitted at once');
  assert.equal(value.strict,true,'confident affected label is selected');
  assert.equal(value.dipFlip,true,'low-confidence flipped label near the tracked wrist is kept');
  assert.equal(value.dipLow,true,'low-confidence affected label near the tracked wrist is kept');
  assert.equal(value.dipMissing,true,'missing label near the tracked wrist is kept');
  assert.equal(value.confidentOpposite,false,'confident opposite hands never substitute');
  assert.equal(value.farAmbiguous,false,'ambiguous hand elsewhere is rejected when another hand is in view');
  assert.equal(value.lateAmbiguous,true,'continuity still holds inside 1500 ms');
  assert.equal(value.expiredAmbiguous,false,'continuity expires after 1500 ms');
});

test('Level 6 shares the public continuity rescue (v98); research isolation is asserted at source level',async()=>{
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
  assert.equal(value.dip.detected,true);
});

test('handedness dropout grace applies to public Level 5 and Level 6',async()=>{
  const {value}=await withPage(()=>{
    const probe=()=>window.__qa.graspGraceEligible({detected:false,reason:'affected-hand-not-detected'});
    window.__qa.startGame({level:'5',theme:'dimsum',duration:60,affectedSide:'right'});
    const level5=probe();
    window.__qa.startGame({level:'67',level6Task:'flowers',duration:60,affectedSide:'right'});
    const level6=probe();
    window.__qa.startGame({level:'67',level6Task:'peg',duration:60,affectedSide:'right'});
    const peg=probe();
    window.__qa.startGame({level:'4',theme:'dimsum',duration:60,affectedSide:'right'});
    const level4=probe();
    return {level5,level6,peg,level4};
  });
  assert.equal(value.level5,true);
  assert.equal(value.level6,true);
  assert.equal(value.peg,true);
  assert.equal(value.level4,false);
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
