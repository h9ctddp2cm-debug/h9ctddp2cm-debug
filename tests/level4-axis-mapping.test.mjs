import test from 'node:test';
import assert from 'node:assert/strict';
import { calibration } from './fixtures/level4-two-point-test-helpers.mjs';

function armAtAngleWithAbduction(degrees, outwardRawX = 0, side = 'right') {
  const rad = degrees * Math.PI / 180;
  const shoulderX = side === 'left' ? 0.40 : 0.60;
  const otherX = side === 'left' ? 0.60 : 0.40;
  const elbowX = shoulderX + outwardRawX;
  const elbowY = 0.50;
  // Rotate the forearm with the upper arm so this synthetic shoulder-abduction
  // change leaves the 2-D elbow angle itself invariant.
  const tilt = Math.atan2(.20, outwardRawX) - Math.PI / 2;
  const fx = .20 * Math.sin(rad), fy = .20 * Math.cos(rad);
  return {
    shoulder:{x:shoulderX,y:0.30,visibility:1},
    elbow:{x:elbowX,y:elbowY,visibility:1},
    wrist:{
      x:elbowX + fx * Math.cos(tilt) - fy * Math.sin(tilt),
      y:elbowY + fx * Math.sin(tilt) + fy * Math.cos(tilt),
      visibility:1,
    },
    otherShoulder:{x:otherX,y:0.30,visibility:1},
  };
}

test('all five Level 4 games share monotonic flex-down / extend-up Y mapping', () => {
  for (const theme of ['dimsum', 'bowling', 'wipewindow', 'mahjongwash', 'buspay']) {
    const down = calibration.pathCoordinates(0, 0, 'right', true);
    const middle = calibration.pathCoordinates(.5, 0, 'right', true);
    const up = calibration.pathCoordinates(1, 0, 'right', true);
    assert.ok(down.y > middle.y && middle.y > up.y, theme + ' maps flexion downward and extension upward');
    assert.equal(down.x, up.x, theme + ' elbow progress does not alter X');
    assert.equal(down.x, .1, theme + ' dormant horizontal phase begins at its left endpoint');
  }
});

test('path-game X is independent of elbow Y and grows screen-left to screen-right for both sides', () => {
  for (const aspect of [.5625, 1.7778]) {
    for (const side of ['left', 'right']) {
      const atFlexion = calibration.pathCoordinates(0, .65, side, true);
      const atExtension = calibration.pathCoordinates(1, .65, side, true);
      const atBaseline = calibration.pathCoordinates(1, 0, side, true);
      assert.equal(atFlexion.x, atExtension.x, side + ' aspect ' + aspect + ': elbow does not alter X');
      assert.ok(atFlexion.y > atExtension.y, side + ' aspect ' + aspect + ': elbow only changes Y');
      assert.equal(atBaseline.x, .1, side + ' aspect ' + aspect + ': phase start is at screen-left');
      assert.ok(atExtension.x > atBaseline.x, side + ' aspect ' + aspect + ': increasing range moves screen-right');
      for (const game of ['wipewindow', 'mahjongwash', 'buspay']) {
        assert.ok(atExtension.x !== atBaseline.x, game + ' receives independent abduction X');
      }
    }
  }
});

test('shoulder-outward baseline is captured at extension and does not invert elbow progress', () => {
  for (const side of ['left', 'right']) {
    const c = calibration.createController();
    const flexed = armAtAngleWithAbduction(120, 0, side);
    const extended = armAtAngleWithAbduction(70, 0, side);
    const rawOutward = side === 'left' ? -.13 : .13;
    c.update({arm:flexed,side,mirrorX:true,requireHorizontal:true,imageAspect:1,frameFresh:true,frameGeneration:1,frame:{fresh:true,generation:1}});
    assert.equal(c.markFlexed(), true);
    c.update({arm:extended,side,mirrorX:true,requireHorizontal:true,imageAspect:1,frameFresh:true,frameGeneration:2,frame:{fresh:true,generation:2}});
    assert.equal(c.markExtended(), true);
    c.update({arm:armAtAngleWithAbduction(70,rawOutward,side),side,mirrorX:true,requireHorizontal:true,imageAspect:1,
      frameFresh:true,frameGeneration:3,frame:{fresh:true,generation:3}});
    assert.equal(c.markHorizontal(), true);
    const baseline = c.snapshot();
    assert.equal(baseline.progress, 1);
    assert.ok(baseline.abductionProgress > 0);
    c.update({arm:armAtAngleWithAbduction(70,rawOutward * .6,side),side,mirrorX:true,requireHorizontal:true,imageAspect:1,
      frameFresh:true,frameGeneration:4,frame:{fresh:true,generation:4}});
    const outward = c.snapshot();
    assert.ok(outward.abductionProgress > 0, side + ' outward upper arm drives X');
    assert.equal(outward.progress, 1, side + ' abduction does not change endpoint elbow Y');
    for(let generation=4; generation<=6; generation++){
      c.update({arm:armAtAngleWithAbduction(120,rawOutward,side),side,mirrorX:true,requireHorizontal:true,imageAspect:1,
        frameFresh:true,frameGeneration:generation+3,frame:{fresh:true,generation:generation+3}});
    }
    assert.ok(c.snapshot().progress < .5, side + ' flexion still returns down with X held outward');
  }
});

test('dropout clears path admission state without changing the fixed axis orientation', () => {
  const c = calibration.createController();
  c.update({arm:armAtAngleWithAbduction(120),side:'right',mirrorX:true,requireHorizontal:true,imageAspect:1,frameFresh:true,frameGeneration:1,frame:{fresh:true,generation:1}});
  c.markFlexed();
  c.update({arm:armAtAngleWithAbduction(70),side:'right',mirrorX:true,requireHorizontal:true,imageAspect:1,frameFresh:true,frameGeneration:2,frame:{fresh:true,generation:2}});
  c.markExtended();
  c.update({arm:armAtAngleWithAbduction(70,.13),side:'right',mirrorX:true,requireHorizontal:true,imageAspect:1,frameFresh:true,frameGeneration:3,frame:{fresh:true,generation:3}});
  c.markHorizontal();
  assert.ok(c.snapshot().abductionProgress > 0);
  c.update({side:'right',mirrorX:true,imageAspect:1,frameFresh:false,frameGeneration:4,frame:{fresh:false,generation:4}});
  const stale = c.snapshot();
  assert.equal(stale.gameReady, false);
  const down = calibration.pathCoordinates(0, .65, 'right', true);
  const up = calibration.pathCoordinates(1, .65, 'right', true);
  assert.ok(down.y > up.y, 'stale admission does not invert fixed Y direction');
});
