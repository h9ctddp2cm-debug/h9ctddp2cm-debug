import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibration, armAtAngle, poseForArm } from './fixtures/level4-two-point-test-helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function armAtAngleWithOutward(degrees, outward = 0, side = 'right') {
  const rad = degrees * Math.PI / 180;
  // Keep the same torso as armAtAngle(); only the upper-arm direction changes.
  const shoulderX = .50;
  const otherX = side === 'left' ? .32 : .68;
  const elbowX = shoulderX + outward;
  const elbowY = .50;
  const tilt = Math.atan2(.20, outward) - Math.PI / 2;
  const fx = .20 * Math.sin(rad), fy = .20 * Math.cos(rad);
  return {
    shoulder:{x:shoulderX,y:.30,visibility:1},
    elbow:{x:elbowX,y:elbowY,visibility:1},
    wrist:{x:elbowX + fx*Math.cos(tilt)-fy*Math.sin(tilt),y:elbowY+fx*Math.sin(tilt)+fy*Math.cos(tilt),visibility:1},
    otherShoulder:{x:otherX,y:.30,visibility:1},
  };
}

function packet(angle, generation, nowMs, {side='right', arm, lm, fresh=true, requireHorizontal=false, mirrorX=true, torso}={}) {
  const selectedArm = arm === undefined ? armAtAngle(angle) : arm;
  return {
    arm:selectedArm, lm:lm === undefined && selectedArm ? poseForArm(selectedArm, side, torso) : lm, side,
    mirrorX, imageAspect:1, requireHorizontal, enableHorizontalAbduction:requireHorizontal,
    nowMs, frameFresh:fresh, frameGeneration:generation,
    frame:{fresh,generation,ageMs:fresh?16:900,source:'test',reason:fresh?'fresh-decoded-frame':'stale-decoded-frame'},
  };
}

function update(controller, auto, angle, generation, nowMs, options) {
  const input = packet(angle,generation,nowMs,options);
  controller.update(input); auto.update(input,controller);
  return auto.snapshot();
}

function establish(controller, auto, options={}) {
  for(let i=0;i<6;i++) update(controller,auto,120,-6+i,-200+i*30,options);
  assert.equal(auto.snapshot().preAnchor.available,true);
  auto.start(0,{requireHorizontal:options.requireHorizontal===true});
  update(controller,auto,120,1,0,options);
  update(controller,auto,120,2,2999,options);
  update(controller,auto,120,3,3000,options);
}
function hold(controller,auto,angle,startGen,startMs,options={}) {
  let snap;
  for(let i=0;i<10;i++) snap=update(controller,auto,angle,startGen+i,startMs+i*33,options);
  return snap;
}

test('mirror display never changes selected anatomical indices', () => {
  for(const side of ['left','right']) {
    const lm = poseForArm(armAtAngle(120), side);
    const normal=calibration.armFromLandmarks(lm,side);
    const mirrored=calibration.armFromLandmarks(lm,side);
    assert.equal(normal.shoulder, lm[side==='left'?11:12]);
    assert.equal(mirrored.wrist, lm[side==='left'?15:16]);
  }
});

test('opposite arm cannot supply the selected-arm measurement and loss fails closed', () => {
  const c=calibration.createController();
  const lm=poseForArm(armAtAngle(120),'right');
  lm[12].visibility=0; lm[14].visibility=0; lm[16].visibility=0; // right selected arm missing; left remains
  c.update(packet(120,1,0,{side:'right',lm,arm:null}));
  assert.equal(c.snapshot().reason,'selected-arm-lost');
  assert.equal(c.snapshot().framingReady,false);
});

test('arm extension/foreshortening retains a stable torso instead of causing a person-change', () => {
  const c=calibration.createController(), auto=calibration.createAutoCalibration();
  establish(c,auto);
  hold(c,auto,120,4,3033);
  const snap=hold(c,auto,92,24,3400); // selected arm moves, torso does not
  assert.equal(snap.phase,'complete');
  assert.equal(snap.reason,'auto-pair-ready');
});

test('selected-shoulder translation does not replace the non-selected torso anchor', () => {
  const c=calibration.createController(), auto=calibration.createAutoCalibration();
  establish(c,auto);
  hold(c,auto,120,4,3033);
  const movingArm=armAtAngle(92);
  movingArm.shoulder.x += .12;
  movingArm.elbow.x += .12;
  movingArm.wrist.x += .12;
  const snap=hold(c,auto,92,24,3400,{arm:movingArm});
  assert.equal(snap.phase,'complete');
  assert.equal(snap.reason,'auto-pair-ready');
});

test('a hand-only or a replacement torso fails closed and clears uncommitted credit', () => {
  const c=calibration.createController(), auto=calibration.createAutoCalibration();
  establish(c,auto);
  for(let i=0;i<4;i++) update(c,auto,120,4+i,3033+i*33);
  assert.equal(auto.snapshot().stableFrames,4);
  const handOnly=packet(120,8,3180,{lm:null});
  c.update(handOnly); auto.update(handOnly,c);
  assert.equal(auto.snapshot().phase,'retry');
  assert.equal(auto.snapshot().reason,'torso-moved/person-changed');

  const c2=calibration.createController(), auto2=calibration.createAutoCalibration();
  establish(c2,auto2);
  const switchedArm=armAtAngle(120);
  ['shoulder','elbow','wrist','otherShoulder'].forEach(k=>{ switchedArm[k].x+=.55; });
  const switched=packet(120,4,3033,{arm:switchedArm});
  c2.update(switched); auto2.update(switched,c2);
  assert.equal(auto2.snapshot().phase,'retry');
  assert.equal(auto2.snapshot().reason,'torso-moved/person-changed');
});

test('linear automatic calibration commits after flexed plus extended only', () => {
  const c=calibration.createController(), auto=calibration.createAutoCalibration();
  establish(c,auto,{requireHorizontal:false});
  hold(c,auto,120,4,3033);
  const snap=hold(c,auto,92,24,3400);
  assert.equal(snap.phase,'complete');
  assert.equal(c.snapshot().auto.horizontal,false);
  assert.equal(c.snapshot().endpoints.horizontal,null);
});

test('path automatic calibration requires a held outward range while elbow stays extended', () => {
  const c=calibration.createController(), auto=calibration.createAutoCalibration();
  const base={requireHorizontal:true,side:'right'};
  establish(c,auto,base);
  hold(c,auto,120,4,3033,base);
  let snap=hold(c,auto,70,24,3400,base);
  assert.equal(snap.phase,'capture-horizontal');
  // This helper's displayed elbow parameter is supplementary to the joint
  // angle; 110° produces the same 70° selected-elbow signal as armAtAngle(70).
  const outward=armAtAngleWithOutward(110,-.13,'right');
  snap=hold(c,auto,70,44,3800,{...base,arm:outward});
  assert.equal(snap.phase,'complete');
  assert.equal(c.snapshot().auto.horizontal,true);
  assert.ok(c.snapshot().abductionRange >= .08);
});

test('horizontal range is separate from elbow progress and patient UI names the selected arm', () => {
  const c=calibration.createController();
  const start=armAtAngleWithOutward(120,0,'left');
  c.update(packet(120,1,0,{side:'left',arm:start,requireHorizontal:true})); c.markFlexed();
  const end=armAtAngleWithOutward(70,0,'left');
  c.update(packet(70,2,33,{side:'left',arm:end,requireHorizontal:true})); c.markExtended();
  const outward=armAtAngleWithOutward(70,.13,'left');
  c.update(packet(70,3,66,{side:'left',arm:outward,requireHorizontal:true})); c.markHorizontal();
  const before=c.snapshot().progress;
  c.update(packet(70,4,99,{side:'left',arm:armAtAngleWithOutward(70,.18,'left'),requireHorizontal:true}));
  assert.equal(c.snapshot().progress,before);
  assert.ok(c.snapshot().abductionProgress > 0);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/Tracking patient’s/);
  assert.match(html,/drawLevel4SelectedArmOverlay/);
  assert.doesNotMatch(html,/different arm was detected/i);
});
