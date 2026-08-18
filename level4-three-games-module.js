/* FTHUE Level 4 independent games.
   These games consume the existing level4Reach pose controller. They do not
   infer tone, strength, or movement quality beyond its explicit gates. */

const level4MiniGames = {
  bowling:{
    phase:'reach', peak:0, ballProgress:0, rollStartedAt:0,
    pins:0, rounds:0, readyForNextAt:0,
  },
  mahjong:{
    progress:0, lastPoint:null, rounds:0, completed:false,
    readyForNextAt:0,
  },
  bus:{
    targetIndex:0, hitCount:0, holdFrames:0, armed:true,
    flashUntil:0,
  },
  reset(){
    Object.assign(this.bowling, {
      phase:'reach', peak:0, ballProgress:0, rollStartedAt:0,
      pins:0, rounds:0, readyForNextAt:0,
    });
    Object.assign(this.mahjong, {
      progress:0, lastPoint:null, rounds:0, completed:false,
      readyForNextAt:0,
    });
    Object.assign(this.bus, {
      targetIndex:0, hitCount:0, holdFrames:0, armed:true,
      flashUntil:0,
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

function updateLevel4Bowling(motion){
  if(!level4Runtime.isBowling()) return;
  const game = level4MiniGames.bowling;
  const now = level4Runtime.now();
  if(game.phase === 'rolling'){
    game.ballProgress = level4Runtime.clamp01((now-game.rollStartedAt)/1050);
    if(game.ballProgress >= 1 && !game.readyForNextAt){
      game.pins = game.peak >= 0.86 ? 10 : game.peak >= 0.72 ? 7 : 4;
      game.rounds += 1;
      game.readyForNextAt = now+900;
      level4MiniGameScore(game.pins, 'level4_bowling_complete', {
        pins:game.pins, peak:Number(game.peak.toFixed(3)),
      });
    }
    if(game.readyForNextAt && now >= game.readyForNextAt){
      Object.assign(game, {
        phase:'reach', peak:0, ballProgress:0, rollStartedAt:0,
        pins:0, readyForNextAt:0,
      });
    }
    return;
  }
  if(!motion?.calibrated || motion.shoulderHike) return;
  if(motion.engaged && motion.progress >= 0.55){
    game.phase = 'return';
    game.peak = Math.max(game.peak, motion.progress);
  }
  if(game.phase === 'return'){
    game.peak = Math.max(game.peak, motion.progress);
    // A full reach must be followed by elbow flexion/return. A single noisy
    // extension frame can never release the ball.
    if(motion.completionReady || (game.peak >= 0.68 && motion.progress <= 0.18)){
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
  const valid = !!(
    motion?.calibrated && motion.engaged
    && motion.elbowExtensionProgress >= 0.35 && !motion.shoulderHike
  );
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
  if(motion.elbowExtensionProgress < 0.22){
    game.armed = true;
    game.holdFrames = 0;
    return;
  }
  if(!game.armed || !motion.engaged) return;
  const target = LEVEL4_BUS_TARGETS[game.targetIndex];
  const near = Number.isFinite(nx) && Number.isFinite(ny)
    && Math.hypot(nx-target.x, ny-target.y) <= 0.13;
  const extended = motion.elbowExtensionProgress >= 0.48 && motion.progress >= 0.48;
  game.holdFrames = near && extended ? game.holdFrames+1 : Math.max(0,game.holdFrames-1);
  if(game.holdFrames < 4) return;
  game.hitCount += 1;
  game.targetIndex = (game.targetIndex+1)%LEVEL4_BUS_TARGETS.length;
  game.flashUntil = level4Runtime.now()+420;
  game.holdFrames = 0;
  game.armed = false;
  level4MiniGameScore(10, 'level4_bus_pay_complete', {
    hit:game.hitCount,
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

function renderLevel4Bowling(ctx,cw,ch){
  const game = level4MiniGames.bowling;
  const laneX=cw*.24,laneY=ch*.18,laneW=cw*.52,laneH=ch*.70;
  ctx.save();
  ctx.fillStyle='rgba(246,226,181,.86)';
  level4Runtime.roundedRect(ctx,laneX,laneY,laneW,laneH,24); ctx.fill();
  ctx.strokeStyle='rgba(120,82,35,.62)';ctx.lineWidth=5;ctx.stroke();
  ctx.strokeStyle='rgba(154,107,53,.30)';ctx.lineWidth=3;
  for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(laneX+laneW*i/4,laneY);ctx.lineTo(laneX+laneW*i/4,laneY+laneH);ctx.stroke();}
  const pinY=laneY+laneH*.13;
  for(let r=0;r<3;r++) for(let c=0;c<=r;c++){
    const px=cw/2+(c-r/2)*26, py=pinY+r*24;
    ctx.fillStyle=game.pins&&r*3+c<game.pins?'rgba(255,255,255,.22)':'#fff';
    level4Runtime.roundedRect(ctx,px-7,py-13,14,28,7);ctx.fill();
    ctx.fillStyle='#c84a42';ctx.fillRect(px-7,py-2,14,4);
  }
  const ballY=laneY+laneH*(.86-.66*game.ballProgress);
  ctx.beginPath();ctx.arc(cw/2,ballY,26,0,Math.PI*2);
  ctx.fillStyle='#276aa8';ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.72)';
  for(const dx of [-7,0,7]){ctx.beginPath();ctx.arc(cw/2+dx,ballY-6,3,0,Math.PI*2);ctx.fill();}
  level4DrawTitle(ctx,cw,'保齡球',
    game.phase==='return'?'屈肘收手':game.phase==='rolling'?'出球':'向前伸肘');
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
  ctx.restore();
}

function renderLevel4BusPay(ctx,cw,ch){
  const game=level4MiniGames.bus;
  const target=LEVEL4_BUS_TARGETS[game.targetIndex];
  const tx=target.x*cw,ty=target.y*ch;
  ctx.save();
  ctx.fillStyle='rgba(227,235,235,.88)';
  level4Runtime.roundedRect(ctx,cw*.28,ch*.17,cw*.44,ch*.65,30);ctx.fill();
  ctx.fillStyle='#345861';
  level4Runtime.roundedRect(ctx,tx-cw*.12,ty-ch*.13,cw*.24,ch*.26,24);ctx.fill();
  ctx.beginPath();ctx.arc(tx,ty,Math.min(cw,ch)*.105,0,Math.PI*2);
  ctx.fillStyle=level4Runtime.now()<game.flashUntil?'#63b879':'#ffd34f';ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=7;ctx.stroke();
  ctx.fillStyle='#273a38';ctx.font='800 24px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.textAlign='center';ctx.fillText('拍卡',tx,ty+8);
  level4DrawTitle(ctx,cw,'巴士拍卡','伸肘對準黃色位置');
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
    ' mahjongProgress:'+m.progress.toFixed(3)+' mahjongRounds:'+m.rounds+
    ' busHits:'+p.hitCount+' busTarget:'+p.targetIndex+' busArmed:'+p.armed;
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
