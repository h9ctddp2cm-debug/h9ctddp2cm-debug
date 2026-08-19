/* FTHUE Level 4 independent games.
   Movement taxonomy (final):
     linear flexion <-> extension only : 茶樓 dimsum, 保齡球 bowling
     extension then outward/circular path : 抹窗 wipewindow, 洗麻雀 mahjongwash,
                                            巴士拍卡 buspay
   Signal A (reach) is the shared stabilized two-pose progress. Signal B (the
   side-correct lateral/abduction path) is separate and is only consumed by the
   three path games, after adequate extension.
   All three games consume ONE normalised elbow signal produced by the shared
   two-pose calibration (flexed endpoint = 0, extended endpoint = 1) together
   with its hysteresis gates. They never re-threshold raw joint angles and never
   interpret elbow motion as horizontal movement. */

/* ---- Deterministic lightweight 2D pin physics ----
   Pin coordinates live in lane space: x is -1..1 across the lane, y is 0..1
   down the lane from the pin deck. No randomness, no network assets: the same
   peak reach always produces the same topple, so tests are reproducible. */
const LEVEL4_PIN_LAYOUT = [
  [0, 0],
  [-0.17, 0.085], [0.17, 0.085],
  [-0.34, 0.170], [0, 0.170], [0.34, 0.170],
  [-0.51, 0.255], [-0.17, 0.255], [0.17, 0.255], [0.51, 0.255],
];
// Headpin outward: how a real ball spreads energy through the rack.
const LEVEL4_PIN_FALL_ORDER = [0, 1, 2, 4, 3, 5, 7, 8, 6, 9];
function level4NewPinBodies(){
  return LEVEL4_PIN_LAYOUT.map((pos, i) => ({
    id:i, x:pos[0], y:pos[1], homeX:pos[0], homeY:pos[1],
    vx:0, vy:0, angle:0, va:0, down:false, resting:true,
  }));
}
function level4TopplePins(game, count){
  const bodies = game.pinBodies;
  for(let n=0; n<count && n<LEVEL4_PIN_FALL_ORDER.length; n++){
    const pin = bodies[LEVEL4_PIN_FALL_ORDER[n]];
    if(!pin || pin.down) continue;
    pin.down = true;
    pin.resting = false;
    // Deterministic scatter: outer pins fly outward, energy fades down the rack.
    const energy = 1 - n*0.06;
    const outward = pin.homeX === 0 ? ((n%2) ? 0.16 : -0.16) : Math.sign(pin.homeX)*0.9;
    pin.vx = outward*0.85*energy;
    pin.vy = -(0.55 + (n%3)*0.09)*energy;
    pin.va = (outward >= 0 ? 1 : -1)*(3.1 + (n%4)*0.5)*energy;
  }
}
function level4StepPinBodies(game, now){
  const last = game.physicsAt || now;
  // Clamp the step so a paused tab or a slow frame cannot fling pins away.
  const dt = Math.min(0.05, Math.max(0, (now-last)/1000));
  game.physicsAt = now;
  if(dt <= 0) return;
  for(const pin of game.pinBodies){
    if(!pin.down || pin.resting) continue;
    pin.x += pin.vx*dt;
    pin.y += pin.vy*dt;
    pin.angle += pin.va*dt;
    // Friction on the lane surface, then rest once the pin is basically still.
    const damping = Math.pow(0.0008, dt);
    pin.vx *= damping;
    pin.vy *= damping;
    pin.va *= damping;
    if(Math.hypot(pin.vx, pin.vy) < 0.05 && Math.abs(pin.va) < 0.35){
      pin.vx = 0; pin.vy = 0; pin.va = 0;
      pin.angle = Math.max(-1.45, Math.min(1.45, pin.angle));
      pin.resting = true;
    }
  }
}
function level4PinsDown(game){
  return game.pinBodies.reduce((n, pin) => n + (pin.down ? 1 : 0), 0);
}
function level4PinsSettled(game){
  return game.pinBodies.every(pin => !pin.down || pin.resting);
}

const level4MiniGames = {
  bowling:{
    phase:'reach', peak:0, armProgress:0, ballProgress:0, rollStartedAt:0,
    pins:0, rounds:0, readyForNextAt:0,
    impactAt:0, physicsAt:0, pinBodies:level4NewPinBodies(),
  },
  mahjong:{
    progress:0, lastPoint:null, rounds:0, completed:false,
    readyForNextAt:0,
  },
  bus:{
    targetIndex:0, hitCount:0, holdFrames:0, armed:true,
    flashUntil:0, beepCount:0, beeped:false, successUntil:0,
  },
  reset(){
    Object.assign(this.bowling, {
      phase:'reach', peak:0, armProgress:0, ballProgress:0, rollStartedAt:0,
      pins:0, rounds:0, readyForNextAt:0,
      impactAt:0, physicsAt:0, pinBodies:level4NewPinBodies(),
    });
    Object.assign(this.mahjong, {
      progress:0, lastPoint:null, rounds:0, completed:false,
      readyForNextAt:0,
    });
    Object.assign(this.bus, {
      targetIndex:0, hitCount:0, holdFrames:0, armed:true,
      flashUntil:0, beepCount:0, beeped:false, successUntil:0,
    });
  },
};

const LEVEL4_BUS_TARGETS = [
  {x:0.50,y:0.43}, {x:0.43,y:0.37}, {x:0.57,y:0.38},
  {x:0.48,y:0.50},
];

const level4Runtime = window.__level4GameRuntime;

function level4MiniGameScore(points, eventName, detail){
  level4Runtime.addScore(points, eventName, detail);
}

/* ---- Shared normalised motion accessors ----
   `progress` is the calibrated 0..1 reach value. `reachGate` / `returnReady`
   carry the controller's hysteresis so each game gates identically. Legacy
   field names and bare progress objects stay supported for tests/harnesses. */
function level4MotionProgress(motion){
  if(!motion) return 0;
  if(Number.isFinite(motion.progress)) return level4Runtime.clamp01(motion.progress);
  if(Number.isFinite(motion.elbowExtensionProgress)){
    return level4Runtime.clamp01(motion.elbowExtensionProgress);
  }
  return 0;
}
function level4MotionReachGate(motion){
  if(!motion) return false;
  if(typeof motion.reachGate === 'boolean') return motion.reachGate;
  return level4MotionProgress(motion) >= 0.62;
}
function level4MotionReturnReady(motion){
  if(!motion) return true;
  if(typeof motion.returnReady === 'boolean') return motion.returnReady;
  return level4MotionProgress(motion) <= 0.18;
}

function level4MotionArcProgress(motion){
  if(!motion) return 0;
  if(Number.isFinite(motion.arcProgress)) return level4Runtime.clamp01(motion.arcProgress);
  return 0;
}
/* Path games: adequate stabilized extension first, then the outward path. */
function level4MotionPathReady(motion){
  if(!motion?.calibrated || motion.shoulderHike) return false;
  const extensionSeen = level4MotionReachGate(motion)
    || motion.cyclePhase === 'reached'
    || motion.cyclePhase === 'arc-out'
    || motion.cyclePhase === 'arc-return';
  if(!extensionSeen) return false;
  if(!motion.arcCalibrated) return level4MotionProgress(motion) >= 0.35;
  return motion.arcActive === true || level4MotionArcProgress(motion) >= 0.12;
}

function updateLevel4Bowling(motion){
  if(!level4Runtime.isBowling()) return;
  const game = level4MiniGames.bowling;
  const now = level4Runtime.now();
  if(game.phase === 'rolling'){
    // The released ball rolls the length of the lane on its own timeline; the
    // arm is free to rest during the roll.
    game.ballProgress = level4Runtime.clamp01((now-game.rollStartedAt)/1050);
    if(game.ballProgress >= 1 && !game.impactAt){
      game.impactAt = now;
      game.physicsAt = now;
      game.pins = game.peak >= 0.86 ? 10 : game.peak >= 0.72 ? 7 : 4;
      level4TopplePins(game, game.pins);
      game.rounds += 1;
      game.readyForNextAt = now+1500;
      level4MiniGameScore(game.pins, 'level4_bowling_complete', {
        pins:game.pins, peak:Number(game.peak.toFixed(3)),
      });
    }
    if(game.impactAt) level4StepPinBodies(game, now);
    if(game.readyForNextAt && now >= game.readyForNextAt && level4PinsSettled(game)){
      Object.assign(game, {
        phase:'reach', peak:0, armProgress:0, ballProgress:0, rollStartedAt:0,
        pins:0, readyForNextAt:0, impactAt:0, physicsAt:0,
        pinBodies:level4NewPinBodies(),
      });
    }
    return;
  }
  if(!motion?.calibrated || motion.shoulderHike) return;
  // Before release, the ball follows the shared vertical reach signal:
  // elbow extension raises it up the lane and flexion brings it back down.
  // Elbow motion is never interpreted as lane X.
  const progress = level4MotionProgress(motion);
  game.armProgress = progress;
  if(level4MotionReachGate(motion)){
    game.phase = 'return';
    game.peak = Math.max(game.peak, progress);
  }
  if(game.phase === 'return'){
    game.peak = Math.max(game.peak, progress);
    // A full reach must be followed by elbow flexion/return. A single noisy
    // extension frame can never release the ball.
    if(level4MotionReturnReady(motion)){
      game.phase = 'rolling';
      game.rollStartedAt = now;
      game.ballProgress = 0;
    }
  }
}

function updateLevel4MahjongWash(motion, nx, ny){
  if(!level4Runtime.isMahjongWash()) return;
  const game = level4MiniGames.mahjong;
  const now = level4Runtime.now();
  if(game.completed){
    if(now >= game.readyForNextAt){
      game.progress = 0;
      game.completed = false;
      game.readyForNextAt = 0;
      game.lastPoint = null;
    }
    return;
  }
  // 洗麻雀 is a path game: wash along the outward arc after extending.
  const valid = !!(motion?.engaged && level4MotionPathReady(motion));
  if(!valid || !Number.isFinite(nx) || !Number.isFinite(ny)){
    game.lastPoint = null;
    return;
  }
  const point = {
    x:level4Runtime.clamp01(nx),
    y:level4Runtime.clamp01(ny),
  };
  if(!game.lastPoint){
    game.lastPoint = point;
    return;
  }
  const dx = point.x-game.lastPoint.x;
  const dy = point.y-game.lastPoint.y;
  const distance = Math.hypot(dx,dy);
  game.lastPoint = point;
  // Ignore camera shimmer and implausible jumps. Progress reflects actual
  // repeated tabletop arcs, not time spent holding one pose.
  if(distance < 0.007 || distance > 0.16) return;
  game.progress = level4Runtime.clamp01(game.progress + distance*1.55);
  if(game.progress >= 1){
    game.completed = true;
    game.rounds += 1;
    game.readyForNextAt = now+1100;
    level4MiniGameScore(10, 'level4_mahjong_wash_complete', {
      round:game.rounds,
    });
  }
}

function updateLevel4BusPay(motion, nx, ny){
  if(!level4Runtime.isBusPay()) return;
  const game = level4MiniGames.bus;
  if(!motion?.calibrated || motion.shoulderHike) return;
  // Re-arm at the calibrated flexed start, tap once the shared reach gate opens.
  if(level4MotionReturnReady(motion) || level4MotionProgress(motion) < 0.22){
    game.armed = true;
    game.holdFrames = 0;
    return;
  }
  if(!game.armed || !motion.engaged) return;
  const target = LEVEL4_BUS_TARGETS[game.targetIndex];
  const near = Number.isFinite(nx) && Number.isFinite(ny)
    && Math.hypot(nx-target.x, ny-target.y) <= 0.13;
  // 巴士拍卡 is a path game: extension first, then the outward path brings the
  // hand to the fare reader, where a short dwell taps the card.
  const onPath = level4MotionPathReady(motion);
  game.holdFrames = near && onPath ? game.holdFrames+1 : Math.max(0,game.holdFrames-1);
  if(game.holdFrames < 4) return;
  game.hitCount += 1;
  game.targetIndex = (game.targetIndex+1)%LEVEL4_BUS_TARGETS.length;
  game.flashUntil = level4Runtime.now()+900;
  game.holdFrames = 0;
  game.armed = false;
  // Exactly one '嘟' per valid tap: the game is disarmed until the arm returns
  // to the calibrated flexed start, so a held pose cannot beep twice.
  game.beepCount += 1;
  game.beeped = typeof level4Runtime.beepTap === 'function'
    ? level4Runtime.beepTap() !== false
    : false;
  game.successUntil = level4Runtime.now()+1200;
  level4MiniGameScore(10, 'level4_bus_pay_complete', {
    hit:game.hitCount,
    beeps:game.beepCount,
  });
}

function level4DrawTitle(ctx, cw, title, detail){
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.93)';
  level4Runtime.roundedRect(ctx,cw/2-150,18,300,62,18);
  ctx.fill();
  ctx.fillStyle = '#173f39';
  ctx.font = '800 24px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.fillText(title,cw/2,45);
  ctx.fillStyle = '#4c625e';
  ctx.font = '700 15px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.fillText(detail,cw/2,67);
  ctx.restore();
}

function level4DrawPin(ctx, x, y, scale, angle, down){
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(angle);
  if(down) ctx.scale(1, 0.55);
  // Pin silhouette: head, neck, belly, base.
  ctx.beginPath();
  ctx.moveTo(-3.4*scale, 13*scale);
  ctx.bezierCurveTo(-7.4*scale, 6*scale, -6.2*scale, -1*scale, -3.1*scale, -5*scale);
  ctx.bezierCurveTo(-6.0*scale, -9*scale, -4.0*scale, -14*scale, 0, -14*scale);
  ctx.bezierCurveTo(4.0*scale, -14*scale, 6.0*scale, -9*scale, 3.1*scale, -5*scale);
  ctx.bezierCurveTo(6.2*scale, -1*scale, 7.4*scale, 6*scale, 3.4*scale, 13*scale);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-7*scale,0,7*scale,0);
  grad.addColorStop(0,'#dcdcdc'); grad.addColorStop(0.35,'#ffffff');
  grad.addColorStop(1,'#c9ccd2');
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle='rgba(80,80,86,.45)'; ctx.lineWidth=1.4; ctx.stroke();
  ctx.fillStyle='#c8443b';
  ctx.fillRect(-4.6*scale,-6.4*scale,9.2*scale,2.4*scale);
  ctx.fillRect(-5.2*scale,-2.6*scale,10.4*scale,2.2*scale);
  ctx.restore();
}

function renderLevel4Bowling(ctx,cw,ch){
  const game = level4MiniGames.bowling;
  ctx.save();
  // --- alley with simple linear perspective ------------------------------
  const deckY=ch*.16, foulY=ch*.90;
  const topHalf=cw*.14, bottomHalf=cw*.30;
  const laneAt=(t)=>({
    y:deckY+(foulY-deckY)*t,
    half:topHalf+(bottomHalf-topHalf)*t,
  });
  ctx.fillStyle='#1b1f2b';
  ctx.fillRect(0,0,cw,ch);
  // gutters
  ctx.beginPath();
  ctx.moveTo(cw/2-topHalf*1.34,deckY); ctx.lineTo(cw/2+topHalf*1.34,deckY);
  ctx.lineTo(cw/2+bottomHalf*1.28,foulY); ctx.lineTo(cw/2-bottomHalf*1.28,foulY);
  ctx.closePath(); ctx.fillStyle='#2c3446'; ctx.fill();
  // lane boards
  ctx.beginPath();
  ctx.moveTo(cw/2-topHalf,deckY); ctx.lineTo(cw/2+topHalf,deckY);
  ctx.lineTo(cw/2+bottomHalf,foulY); ctx.lineTo(cw/2-bottomHalf,foulY);
  ctx.closePath();
  const wood=ctx.createLinearGradient(0,deckY,0,foulY);
  wood.addColorStop(0,'#e5c489'); wood.addColorStop(.55,'#f3dcae'); wood.addColorStop(1,'#e0bd83');
  ctx.fillStyle=wood; ctx.fill();
  ctx.strokeStyle='rgba(120,82,35,.55)'; ctx.lineWidth=4; ctx.stroke();
  ctx.strokeStyle='rgba(154,107,53,.22)'; ctx.lineWidth=2;
  for(let i=1;i<8;i++){
    const f=i/8;
    ctx.beginPath();
    ctx.moveTo(cw/2-topHalf+2*topHalf*f,deckY);
    ctx.lineTo(cw/2-bottomHalf+2*bottomHalf*f,foulY);
    ctx.stroke();
  }
  // pin deck shadow
  ctx.fillStyle='rgba(0,0,0,.16)';
  ctx.beginPath();
  ctx.moveTo(cw/2-topHalf,deckY); ctx.lineTo(cw/2+topHalf,deckY);
  ctx.lineTo(cw/2+topHalf*1.1,deckY+ch*.10); ctx.lineTo(cw/2-topHalf*1.1,deckY+ch*.10);
  ctx.closePath(); ctx.fill();

  // --- pins (deterministic physics bodies) -------------------------------
  for(const pin of game.pinBodies){
    const t=level4Runtime.clamp01(0.02+pin.y*0.55);
    const row=laneAt(t);
    const px=cw/2+pin.x*row.half*0.92;
    const scale=Math.min(cw,ch)/520*(1+t*0.5);
    ctx.globalAlpha=pin.down?0.92:1;
    level4DrawPin(ctx,px,row.y,scale,pin.down?pin.angle:0,pin.down);
    ctx.globalAlpha=1;
  }

  // --- ball --------------------------------------------------------------
  const verticalProgress = game.phase === 'rolling' ? game.ballProgress : game.armProgress;
  const t=level4Runtime.clamp01(1-0.94*verticalProgress);
  const row=laneAt(t);
  const ballR=Math.min(cw,ch)*(0.030+0.030*t);
  const ballY=row.y-ballR*0.35;
  ctx.beginPath();
  ctx.ellipse(cw/2,row.y+ballR*0.55,ballR*0.95,ballR*0.32,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,.24)'; ctx.fill();
  const sphere=ctx.createRadialGradient(cw/2-ballR*.35,ballY-ballR*.4,ballR*.15,cw/2,ballY,ballR);
  sphere.addColorStop(0,'#7fc4f2'); sphere.addColorStop(.5,'#2a72ad'); sphere.addColorStop(1,'#12395c');
  ctx.beginPath(); ctx.arc(cw/2,ballY,ballR,0,Math.PI*2);
  ctx.fillStyle=sphere; ctx.fill();
  // Finger holes rotate with the roll so the ball visibly spins.
  const spin=(game.phase==='rolling'?game.ballProgress:game.armProgress)*Math.PI*2.4;
  ctx.save(); ctx.translate(cw/2,ballY); ctx.rotate(spin);
  ctx.fillStyle='rgba(12,30,48,.85)';
  for(const off of [[-ballR*.32,-ballR*.20],[0,-ballR*.36],[ballR*.32,-ballR*.20]]){
    ctx.beginPath(); ctx.ellipse(off[0],off[1],ballR*.11,ballR*.13,0,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();

  const pinsDown=level4PinsDown(game);
  level4DrawTitle(ctx,cw,'保齡球',
    game.impactAt ? ('倒 '+pinsDown+' 支')
      : game.phase==='return'?'屈肘收手':game.phase==='rolling'?'出球':'向前伸肘');
  level4Runtime.drawVerticalReachGuide(ctx,cw,ch);
  ctx.restore();
}

const LEVEL4_MAHJONG_TILES = [
  [-.31,-.12,-.14],[-.12,-.19,.10],[.08,-.15,-.08],[.28,-.11,.13],
  [-.27,.13,.07],[-.08,.17,-.12],[.13,.13,.12],[.31,.16,-.06],
];

function renderLevel4MahjongWash(ctx,cw,ch){
  const game=level4MiniGames.mahjong;
  const x=cw*.14,y=ch*.23,w=cw*.72,h=ch*.58;
  ctx.save();
  ctx.fillStyle='rgba(25,112,91,.88)';
  level4Runtime.roundedRect(ctx,x,y,w,h,26);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.80)';ctx.lineWidth=5;ctx.stroke();
  LEVEL4_MAHJONG_TILES.forEach((tile,i)=>{
    const spread=1-game.progress*.34;
    const tx=cw/2+tile[0]*w*spread;
    const ty=y+h/2+tile[1]*h*spread;
    ctx.save();ctx.translate(tx,ty);ctx.rotate(tile[2]*spread);
    ctx.fillStyle='#fffdf5';
    level4Runtime.roundedRect(ctx,-20,-28,40,56,7);ctx.fill();
    ctx.strokeStyle='#c9b98e';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle=i%2?'#b33a31':'#196752';
    ctx.font='800 22px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(i%4+1),0,0);ctx.restore();
  });
  ctx.fillStyle='rgba(255,255,255,.86)';
  level4Runtime.roundedRect(ctx,x,y+h+18,w,20,10);ctx.fill();
  ctx.fillStyle='#f0b83f';
  level4Runtime.roundedRect(ctx,x,y+h+18,w*game.progress,20,10);ctx.fill();
  level4DrawTitle(ctx,cw,'洗麻雀',game.completed?'完成':'伸肘畫大弧');
  level4Runtime.drawVerticalReachGuide(ctx,cw,ch);
  ctx.restore();
}

function renderLevel4BusPay(ctx,cw,ch){
  const game=level4MiniGames.bus;
  const target=LEVEL4_BUS_TARGETS[game.targetIndex];
  const tx=target.x*cw,ty=target.y*ch;
  const now=level4Runtime.now();
  const flashing=now<game.flashUntil;
  ctx.save();
  // --- bus interior ------------------------------------------------------
  ctx.fillStyle='#dfe6e6'; ctx.fillRect(0,0,cw,ch);
  // ceiling and side windows
  ctx.fillStyle='#eef3f3'; ctx.fillRect(0,0,cw,ch*.16);
  ctx.fillStyle='#9fc6d8';
  level4Runtime.roundedRect(ctx,cw*.03,ch*.18,cw*.20,ch*.24,12); ctx.fill();
  level4Runtime.roundedRect(ctx,cw*.77,ch*.18,cw*.20,ch*.24,12); ctx.fill();
  ctx.strokeStyle='rgba(60,80,88,.5)'; ctx.lineWidth=4;
  level4Runtime.roundedRect(ctx,cw*.03,ch*.18,cw*.20,ch*.24,12); ctx.stroke();
  level4Runtime.roundedRect(ctx,cw*.77,ch*.18,cw*.20,ch*.24,12); ctx.stroke();
  // grab rail along the ceiling with hanging handles
  ctx.strokeStyle='#b9bfc4'; ctx.lineWidth=7;
  ctx.beginPath(); ctx.moveTo(cw*.06,ch*.11); ctx.lineTo(cw*.94,ch*.11); ctx.stroke();
  ctx.lineWidth=4; ctx.strokeStyle='#c9a24a';
  for(const fx of [0.16,0.34,0.66,0.84]){
    ctx.beginPath(); ctx.moveTo(cw*fx,ch*.11); ctx.lineTo(cw*fx,ch*.17); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cw*fx,ch*.19,cw*.017,ch*.022,0,0,Math.PI*2); ctx.stroke();
  }
  // seat backs (foreground rows)
  ctx.fillStyle='#7d3f46';
  level4Runtime.roundedRect(ctx,cw*.04,ch*.70,cw*.34,ch*.26,16); ctx.fill();
  level4Runtime.roundedRect(ctx,cw*.62,ch*.70,cw*.34,ch*.26,16); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.18)';
  level4Runtime.roundedRect(ctx,cw*.07,ch*.73,cw*.28,ch*.08,10); ctx.fill();
  level4Runtime.roundedRect(ctx,cw*.65,ch*.73,cw*.28,ch*.08,10); ctx.fill();
  // yellow pole beside the door
  ctx.fillStyle='#e8c33d'; ctx.fillRect(cw*.955,ch*.16,cw*.014,ch*.62);

  // --- generic contactless fare reader (no logos) ------------------------
  const rw=Math.min(cw*.26,ch*.30), rh=rw*1.12;
  ctx.save();
  ctx.translate(tx,ty);
  ctx.fillStyle='rgba(0,0,0,.20)';
  level4Runtime.roundedRect(ctx,-rw/2+6,-rh/2+8,rw,rh,18); ctx.fill();
  const body=ctx.createLinearGradient(0,-rh/2,0,rh/2);
  body.addColorStop(0,'#4a5f68'); body.addColorStop(1,'#2c3d45');
  ctx.fillStyle=body;
  level4Runtime.roundedRect(ctx,-rw/2,-rh/2,rw,rh,18); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=3;
  level4Runtime.roundedRect(ctx,-rw/2,-rh/2,rw,rh,18); ctx.stroke();
  // small fare display
  ctx.fillStyle=flashing?'#123f22':'#101a1c';
  level4Runtime.roundedRect(ctx,-rw*.36,-rh*.42,rw*.72,rh*.20,7); ctx.fill();
  ctx.fillStyle=flashing?'#7ef2a4':'#8fe6d8';
  ctx.font='700 '+Math.round(rh*.12)+'px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(flashing?'已付款 PAID':'請拍卡 TAP',0,-rh*.32);
  // circular tap pad with generic contactless waves
  const padR=rw*.30;
  ctx.beginPath(); ctx.arc(0,rh*.13,padR,0,Math.PI*2);
  ctx.fillStyle=flashing?'#63b879':'#ffd34f'; ctx.fill();
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=6; ctx.stroke();
  ctx.strokeStyle='rgba(38,54,58,.85)'; ctx.lineWidth=4;
  for(let i=1;i<=3;i++){
    ctx.beginPath();
    ctx.arc(-padR*.28,rh*.13,padR*(0.22*i),-Math.PI*.42,Math.PI*.42);
    ctx.stroke();
  }
  ctx.fillStyle='rgba(38,54,58,.9)';
  ctx.beginPath(); ctx.arc(-padR*.28,rh*.13,padR*.09,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // --- concise success feedback -----------------------------------------
  if(now<game.successUntil){
    ctx.fillStyle='rgba(24,86,44,.92)';
    level4Runtime.roundedRect(ctx,cw*.30,ch*.055,cw*.40,ch*.085,16); ctx.fill();
    ctx.fillStyle='#eafff0';
    ctx.font='800 '+Math.round(ch*.048)+'px "PingFang TC","Noto Sans TC",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('嘟 · 已拍卡',cw*.50,ch*.098);
  }
  level4DrawTitle(ctx,cw,'巴士拍卡','伸肘後向外拍讀卡器');
  level4Runtime.drawVerticalReachGuide(ctx,cw,ch);
  const cursor = level4Runtime.cursor();
  if(cursor.detected && cursor.x>=0){
    ctx.beginPath();ctx.arc(cursor.x,cursor.y,30,0,Math.PI*2);
    ctx.strokeStyle='#d9303e';ctx.lineWidth=7;ctx.stroke();
  }
  ctx.restore();
}

function level4MiniGamesText(){
  const b=level4MiniGames.bowling,m=level4MiniGames.mahjong,p=level4MiniGames.bus;
  return 'level4MiniGames=theme:'+level4Runtime.theme()+
    ' bowlingPhase:'+b.phase+' bowlingPeak:'+b.peak.toFixed(3)+' bowlingRounds:'+b.rounds+
    ' bowlingBall:'+b.ballProgress.toFixed(3)+' bowlingPinsDown:'+level4PinsDown(b)+
    ' bowlingPinsSettled:'+level4PinsSettled(b)+
    ' mahjongProgress:'+m.progress.toFixed(3)+' mahjongRounds:'+m.rounds+
    ' busHits:'+p.hitCount+' busTarget:'+p.targetIndex+' busArmed:'+p.armed+
    ' busBeeps:'+p.beepCount+' busBeeped:'+p.beeped;
}

window.__level4MiniGamesQA = {
  reset(){ level4MiniGames.reset(); return level4MiniGamesText(); },
  bowling(motion){ updateLevel4Bowling(motion); return level4MiniGamesText(); },
  mahjong(motion,nx,ny){
    updateLevel4MahjongWash(motion,nx,ny);
    return level4MiniGamesText();
  },
  bus(motion,nx,ny){
    updateLevel4BusPay(motion,nx,ny);
    return level4MiniGamesText();
  },
  state:level4MiniGames,
};
