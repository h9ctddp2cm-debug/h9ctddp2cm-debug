/* ==================================================================
   煮飯 = 蛋炒飯 12 步引導訓練（虛擬模擬）
   ⚠ 前臂旋前／旋後（pronation / supination）只以手部方向＋肘腕向量「估算」，
     屬螢幕訓練回饋，並非醫學量度。
   ================================================================== */

const COOK_STEPS = [
  { id:'loosen', text:'準備食材：現在將隔夜冷飯完全抓鬆', prop:'rice_bowl',
    kind:'grasp',      need:3, goal:'握緊 → 張開，重複 3 次',
    tts:'準備食材。現在將隔夜冷飯完全抓鬆。握緊手，然後張開，做三次。' },
  { id:'beat', text:'將雞蛋打散', prop:'eggs',
    kind:'circle',     need:3, goal:'手腕畫圈 3 次',
    tts:'將雞蛋打散。手腕畫圈，做三次。' },
  { id:'mix', text:'將雞蛋液拌入白飯中（讓每一粒米飯都裹上蛋液）', prop:'egg_beaten',
    kind:'pronate',    need:4, goal:'手掌向上 ↔ 向下 交替 4 次',
    tts:'將雞蛋液拌入白飯中，讓每一粒米飯都裹上蛋液。手掌向上，再向下，交替四次。' },
  { id:'wash', text:'現在洗青蔥', prop:'spring_onion',
    kind:'elbow',      need:3, goal:'手肘屈曲 → 伸直，3 次',
    tts:'現在洗青蔥。手肘屈曲，然後伸直，做三次。' },
  { id:'chop', text:'切蔥變成蔥花', prop:'board_knife',
    kind:'chop',       need:5, goal:'手腕上下切 5 下',
    tts:'切蔥，變成蔥花。手腕控制住，上下切五下。' },
  { id:'heat', text:'現在開火熱鍋', prop:'wok',
    kind:'reachHold',  need:1, holdMs:1500, goal:'肩膀向前伸，停住 1.5 秒',
    tts:'現在開火熱鍋。肩膀向前伸出，停住一秒半。' },
  { id:'oil', text:'落油', prop:'oil_bottle',
    kind:'tiltHold',   need:1, holdMs:1200, goal:'手腕側傾／旋轉，停住',
    tts:'落油。手腕側傾，慢慢倒，停住。' },
  { id:'pour', text:'倒入有蛋液的白飯', prop:'rice_bowl',
    kind:'tiltReturn', need:1, goal:'前臂傾倒，再轉回原位',
    tts:'倒入有蛋液的白飯。前臂慢慢傾倒，再轉回原位。' },
  { id:'salt', text:'落鹽', prop:'salt_dish',
    kind:'shake',      need:4, goal:'手腕輕抖 4 下',
    tts:'落鹽。手腕輕輕抖四下。' },
  { id:'onion', text:'落蔥花', prop:'onion_chopped',
    kind:'pinchDrop',  need:1, goal:'捏起蔥花，放入鍋中',
    tts:'落蔥花。捏起蔥花，放入鍋中。' },
  { id:'off', text:'熄火', prop:'stove_knob',
    kind:'knobDwell',  need:1, holdMs:1200, goal:'伸手去爐頭旋鈕，停住',
    tts:'熄火。伸手去爐頭旋鈕，停住一陣。' },
  { id:'plate', text:'上碟', prop:'friedrice',
    kind:'scoop',      need:3, goal:'由鍋舀到碟，3 次',
    tts:'上碟。由鍋舀到碟，做三次。' },
];

/* 級別門檻：Level 4–5 較闊鬆（大動作即可）；Level 6–7 較精細（細動作亦可偵測，要求控制） */
const COOK_TH = {
  '45': { rollDeg:32, chopPx:52, shakePx:26, circleR:46, elbowFlex:95, elbowExt:135,
          reachRatio:0.30, tiltHoldDeg:26, moveMin:34 },
  '67': { rollDeg:20, chopPx:34, shakePx:16, circleR:30, elbowFlex:105, elbowExt:128,
          reachRatio:0.24, tiltHoldDeg:18, moveMin:20 },
};
function cookTh(){ return COOK_TH[state.level] || COOK_TH['45']; }

const cook = {
  idx:0, reps:0, holdStart:0, done:false, active:false,
  msg:'', metric:'', poseOn:false, lastAdvance:0,
  // 偵測用暫存
  graspPrev:false, ring:[], angAccum:0, rollSign:0, rollPeak:0,
  chopPhase:0, chopAnchor:0, shakeDir:0, shakeAnchor:0, shakeCount:0,
  elbowPhase:0, tiltPhase:0, pinchPrev:false, scoopZone:'', scoopCount:0,
  layout:null,
  reset(){
    this.idx = 0; this.reps = 0; this.holdStart = 0; this.done = false;
    this.msg = ''; this.metric = ''; this.ring = []; this.angAccum = 0;
    this.rollSign = 0; this.rollPeak = 0; this.chopPhase = 0; this.chopAnchor = 0;
    this.shakeDir = 0; this.shakeAnchor = 0; this.shakeCount = 0;
    this.elbowPhase = 0; this.tiltPhase = 0; this.pinchPrev = false;
    this.scoopZone = ''; this.scoopCount = 0; this.graspPrev = false;
  },
  step(){ return COOK_STEPS[Math.min(this.idx, COOK_STEPS.length - 1)]; },
};

/* ---- 幾何：由手部 landmarks 估算手掌轉向角（度） ---- */
function handRollDeg(lm){
  if(!lm) return null;
  // 食指根 (5) → 小指根 (17) 的橫向軸；配合肘腕向量作參考
  const dx = lm[17].x - lm[5].x, dy = lm[17].y - lm[5].y;
  let deg = Math.atan2(dy, dx) * 180 / Math.PI;   // -180..180
  const fa = forearmDeg();
  if(fa != null){
    // 以前臂方向為基準，取相對角（估算前臂旋前／旋後傾向）
    deg = deg - (fa + 90);
    while(deg > 180) deg -= 360;
    while(deg < -180) deg += 360;
  }
  return deg;
}
function poseSide(){
  const lm = lastPoseLm;
  if(!lm) return null;
  const R = { s:lm[12], e:lm[14], w:lm[16] };
  const L = { s:lm[11], e:lm[13], w:lm[15] };
  const vis = p => (p && p.visibility != null) ? p.visibility : 1;
  const rv = vis(R.s) + vis(R.e) + vis(R.w);
  const lv = vis(L.s) + vis(L.e) + vis(L.w);
  return rv >= lv ? R : L;
}
function forearmDeg(){
  const s = poseSide();
  if(!s) return null;
  return Math.atan2(s.w.y - s.e.y, s.w.x - s.e.x) * 180 / Math.PI;
}
function elbowAngleDeg(){
  const s = poseSide();
  if(!s) return null;
  const a = { x:s.s.x - s.e.x, y:s.s.y - s.e.y };
  const b = { x:s.w.x - s.e.x, y:s.w.y - s.e.y };
  const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y);
  if(na < 1e-4 || nb < 1e-4) return null;
  const c = Math.max(-1, Math.min(1, (a.x*b.x + a.y*b.y) / (na*nb)));
  return Math.acos(c) * 180 / Math.PI;
}
function shoulderReachRatio(){
  const s = poseSide();
  if(!s) return null;
  const d = Math.hypot(s.w.x - s.s.x, s.w.y - s.s.y);
  return d; // 已是 normalised 影像座標比例
}
function pinchDist(lm){
  if(!lm) return null;
  const a = lm[4], b = lm[8];
  const span = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 0.2;
  return Math.hypot(a.x - b.x, a.y - b.y) / span;
}

/* ---- 每一步的動作偵測 ---- */
function cookDetect(){
  const st = cook.step();
  const th = cookTh();
  const now = nowMs();
  const lm = lastHandLm;
  const L = cook.layout;
  let m = '';

  const bumpRep = ()=>{
    cook.reps++;
    if(cook.reps < st.need){
      playCorrectSound();
      rewardSmall({ achievement:'第 ' + (cook.idx+1) + ' 步 · ' + cook.reps + '/' + st.need,
        detail: st.goal, x: cursorX > 0 ? cursorX : gameCanvas.width/2,
        y: cursorY > 0 ? cursorY : gameCanvas.height/2, silent:true, tts:false });
    }
  };

  switch(st.kind){
    case 'grasp': {
      // 握緊 → 張開 為一次循環
      if(isGrasping && !cook.graspPrev){ cook.graspPhase = 1; }
      if(!isGrasping && cook.graspPrev && cook.graspPhase === 1){ cook.graspPhase = 0; bumpRep(); }
      cook.graspPrev = isGrasping;
      m = '手勢：' + (isGrasping ? '握緊 ✊' : '張開 🖐');
      break;
    }
    case 'circle': {
      if(cursorX >= 0){
        cook.ring.push({ x:cursorX, y:cursorY, t:now });
        while(cook.ring.length && now - cook.ring[0].t > 3000) cook.ring.shift();
        if(cook.ring.length > 6){
          let cx = 0, cy = 0;
          for(const p of cook.ring){ cx += p.x; cy += p.y; }
          cx /= cook.ring.length; cy /= cook.ring.length;
          const last = cook.ring[cook.ring.length-1], prev = cook.ring[cook.ring.length-2];
          const r = Math.hypot(last.x - cx, last.y - cy);
          if(r > th.circleR){
            let a1 = Math.atan2(prev.y - cy, prev.x - cx);
            let a2 = Math.atan2(last.y - cy, last.x - cx);
            let da = a2 - a1;
            while(da > Math.PI) da -= Math.PI*2;
            while(da < -Math.PI) da += Math.PI*2;
            if(Math.abs(da) < 0.9) cook.angAccum += da;
          }
          m = '圈半徑估算：' + Math.round(r) + 'px';
          if(Math.abs(cook.angAccum) >= Math.PI*2){ cook.angAccum = 0; bumpRep(); }
        }
      }
      break;
    }
    case 'pronate': {
      const roll = handRollDeg(lm);
      if(roll != null){
        m = '前臂旋轉估算：' + Math.round(roll) + '°（訓練用估算，非醫學量度）';
        const s = roll > th.rollDeg ? 1 : (roll < -th.rollDeg ? -1 : 0);
        if(s !== 0 && s !== cook.rollSign){ cook.rollSign = s; bumpRep(); }
      } else {
        m = '未偵測到手部方向，請將手掌對正鏡頭';
      }
      break;
    }
    case 'elbow': {
      const ang = elbowAngleDeg();
      if(ang != null){
        m = '手肘角度估算：' + Math.round(ang) + '°';
        if(cook.elbowPhase === 0 && ang < th.elbowFlex) cook.elbowPhase = 1;
        else if(cook.elbowPhase === 1 && ang > th.elbowExt){ cook.elbowPhase = 0; bumpRep(); }
      } else {
        // 無姿勢追蹤：以手部上下大幅移動代替（追蹤有限）
        m = '姿勢追蹤未啟用 · 以手部上下移動代替';
        if(cursorY >= 0){
          if(cook.elbowPhase === 0 && cursorY > gameCanvas.height*0.62) cook.elbowPhase = 1;
          else if(cook.elbowPhase === 1 && cursorY < gameCanvas.height*0.38){ cook.elbowPhase = 0; bumpRep(); }
        }
      }
      break;
    }
    case 'chop': {
      if(cursorY >= 0){
        if(!cook.chopAnchor) cook.chopAnchor = cursorY;
        if(cook.chopPhase === 0 && cursorY - cook.chopAnchor > th.chopPx){
          cook.chopPhase = 1; cook.chopAnchor = cursorY;
        } else if(cook.chopPhase === 1 && cook.chopAnchor - cursorY > th.chopPx){
          cook.chopPhase = 0; cook.chopAnchor = cursorY; bumpRep();
        }
        m = '切落幅度門檻：' + th.chopPx + 'px';
      }
      break;
    }
    case 'reachHold': {
      const rr = shoulderReachRatio();
      const ok = rr != null ? (rr > th.reachRatio)
        : (cursorX >= 0 && L && Math.hypot(cursorX - L.wok.x, cursorY - L.wok.y) < L.wok.r);
      m = (rr != null ? '肩→腕距離估算：' + rr.toFixed(2) : '姿勢追蹤未啟用 · 伸手去炒鍋代替');
      if(ok){
        if(!cook.holdStart) cook.holdStart = now;
        const el = now - cook.holdStart;
        m += ' · 停住 ' + (el/1000).toFixed(1) + 's / 1.5s';
        if(el >= (st.holdMs || 1500)){ cook.holdStart = 0; bumpRep(); }
      } else cook.holdStart = 0;
      break;
    }
    case 'tiltHold': {
      const roll = handRollDeg(lm);
      m = roll != null ? '手腕傾斜估算：' + Math.round(roll) + '°（訓練用估算）'
                       : '未偵測到手部方向';
      if(roll != null && Math.abs(roll) > th.tiltHoldDeg){
        if(!cook.holdStart) cook.holdStart = now;
        const el = now - cook.holdStart;
        m += ' · 停住 ' + (el/1000).toFixed(1) + 's';
        if(el >= (st.holdMs || 1200)){ cook.holdStart = 0; bumpRep(); }
      } else cook.holdStart = 0;
      break;
    }
    case 'tiltReturn': {
      const roll = handRollDeg(lm);
      m = roll != null ? '前臂傾倒估算：' + Math.round(roll) + '°（訓練用估算）' : '未偵測到手部方向';
      if(roll != null){
        if(cook.tiltPhase === 0 && Math.abs(roll) > th.rollDeg + 8) cook.tiltPhase = 1;
        else if(cook.tiltPhase === 1 && Math.abs(roll) < th.tiltHoldDeg*0.6){ cook.tiltPhase = 0; bumpRep(); }
        m += cook.tiltPhase === 1 ? ' · 已傾倒，慢慢轉回' : ' · 傾倒中…';
      }
      break;
    }
    case 'shake': {
      if(cursorX >= 0){
        if(!cook.shakeAnchor) cook.shakeAnchor = cursorX;
        const d = cursorX - cook.shakeAnchor;
        if(Math.abs(d) > th.shakePx){
          const dir = d > 0 ? 1 : -1;
          if(dir !== cook.shakeDir){ cook.shakeDir = dir; cook.shakeAnchor = cursorX; bumpRep(); }
          else cook.shakeAnchor = cursorX;
        }
        m = '抖動幅度門檻：' + th.shakePx + 'px';
      }
      break;
    }
    case 'pinchDrop': {
      const inPan = L && cursorX >= 0 && Math.hypot(cursorX - L.wok.x, cursorY - L.wok.y) < L.wok.r * 1.25;
      if(state.gameType === 'grasp'){
        m = '（Level 4–5）握緊蔥花 → 移到鍋上張開手';
        if(isGrasping) cook.pinchPrev = true;
        else if(cook.pinchPrev && inPan){ cook.pinchPrev = false; bumpRep(); }
      } else {
        const pd = pinchDist(lastHandLm);
        m = pd != null ? '捏合估算：' + pd.toFixed(2) : '未偵測到手指';
        if(pd != null){
          if(pd < 0.55) cook.pinchPrev = true;
          else if(cook.pinchPrev && pd > 0.8 && inPan){ cook.pinchPrev = false; bumpRep(); }
        }
      }
      if(inPan) m += ' · 已在鍋上';
      break;
    }
    case 'knobDwell': {
      const on = L && cursorX >= 0 &&
        Math.hypot(cursorX - L.knob.x, cursorY - L.knob.y) < L.knob.r + selTol()*0.6;
      m = on ? '已到爐頭旋鈕' : '伸手去爐頭旋鈕（畫面左下大圓鈕）';
      if(on){
        if(!cook.holdStart) cook.holdStart = now;
        const el = now - cook.holdStart;
        m += ' · 停住 ' + (el/1000).toFixed(1) + 's';
        if(el >= (st.holdMs || 1200)){ cook.holdStart = 0; bumpRep(); }
      } else cook.holdStart = 0;
      break;
    }
    case 'scoop': {
      if(L && cursorX >= 0){
        const inWok = Math.hypot(cursorX - L.wok.x, cursorY - L.wok.y) < L.wok.r * 1.2;
        const inPlate = Math.hypot(cursorX - L.plate.x, cursorY - L.plate.y) < L.plate.r * 1.2;
        if(inWok && cook.scoopZone !== 'wok'){ cook.scoopZone = 'wok'; }
        else if(inPlate && cook.scoopZone === 'wok'){ cook.scoopZone = 'plate'; bumpRep(); }
        m = '路線：鍋 → 碟（現在：' + (inWok ? '鍋' : inPlate ? '碟' : '中間') + '）';
      }
      break;
    }
  }
  cook.metric = m;

  if(cook.reps >= st.need){ cookAdvance(true); }
}

function cookAdvance(earned){
  const st = cook.step();
  const total = COOK_STEPS.length;
  if(earned){
    score += 10; correctCount++; grabCount++;
    updateHUD();
  }
  const isLast = cook.idx >= total - 1;
  const nextIdx = cook.idx + 1;
  if(isLast){
    cook.done = true;
    cook.idx = total - 1;
    cookRenderPanel();
    rewardBig({
      tier:'完成整道菜',
      title:'蛋炒飯完成！',
      sub:'12 / 12 步全部完成 · 成就：一人一鍋蛋炒飯',
      detail:'你完成了所有 12 個步驟，包括握放、手腕畫圈、前臂旋轉估算、手肘屈伸、伸手及舀取轉移。' +
             '<br><small>本活動為虛擬煮食訓練，動作回饋屬估算，並非臨床運動學量度。</small>',
      progressLabel:'進度：12 / 12 步',
      progressPct:1,
      canvasH:280,
      draw:(c,w,h)=> drawCookSummary(c,w,h),
      tts:'恭喜，蛋炒飯完成。十二個步驟全部做完，做得非常好。',
      continueLabel:'再煮一次 ▶',
      onContinue:()=>{ cook.reset(); cookAnnounce(); },
    });
    return;
  }
  cook.idx = nextIdx;
  cook.reps = 0; cook.holdStart = 0; cook.ring = []; cook.angAccum = 0;
  cook.rollSign = 0; cook.chopPhase = 0; cook.chopAnchor = 0;
  cook.shakeDir = 0; cook.shakeAnchor = 0; cook.elbowPhase = 0;
  cook.tiltPhase = 0; cook.pinchPrev = false; cook.scoopZone = '';
  if(earned){
    rewardSmall({
      achievement:'完成第 ' + nextIdx + ' 步 · ' + st.text.slice(0, 12),
      detail:'下一步：' + COOK_STEPS[nextIdx].text,
      progressLabel:'進度 ' + nextIdx + ' / ' + total + '，仲有 ' + (total - nextIdx) + ' 步',
      x: cursorX > 0 ? cursorX : gameCanvas.width/2,
      y: cursorY > 0 ? cursorY : gameCanvas.height/2,
      big:true,
      tts:'好，' + nextEncourage(),
    });
    setTimeout(()=>{ if(cook.active) cookAnnounce(); }, 1400);
  } else {
    cookAnnounce();
  }
}

function cookAnnounce(){
  const st = cook.step();
  cookRenderPanel();
  speakCantonese(st.tts);
}

function cookRenderPanel(){
  const st = cook.step();
  const total = COOK_STEPS.length;
  advSetPanel({
    stepNo:'步驟 ' + (cook.idx + 1) + ' / ' + total + (cook.done ? ' · 已完成' : ''),
    text: st.text,
    goal:'目標動作：' + st.goal + '　（' + cook.reps + ' / ' + st.need + '）',
    metric: cook.metric + (cook.poseOn ? '' : '<br>姿勢追蹤（肩／肘）未啟用：以手部動作估算，追蹤有限。'),
    pct: (cook.idx + Math.min(1, cook.reps / st.need)) / total,
    buttons:[
      { label:'🔊 再讀一次', onClick:()=> speakCantonese(st.tts) },
      { label:'跳過此步（治療師）', warn:true, onClick:()=>{
          advSetNote('已跳過步驟 ' + (cook.idx+1) + '。');
          cookAdvance(false);
        } },
    ],
  });
}

/* 煮飯場景座標 */
function cookLayout(){
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const base = Math.min(cw, ch);
  const y = ch * 0.72;
  return {
    wok:   { x: cw * 0.34, y, r: base * 0.16 },
    plate: { x: cw * 0.70, y, r: base * 0.13 },
    knob:  { x: cw * 0.10, y: ch * 0.86, r: base * 0.075 },
    prop:  { x: cw * 0.52, y: ch * 0.44, s: base * 0.30 },
  };
}

function cookRender(ctx){
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const L = cook.layout = cookLayout();
  const st = cook.step();

  // 檯面
  ctx.save();
  const g = ctx.createLinearGradient(0, ch*0.6, 0, ch);
  g.addColorStop(0, 'rgba(255,255,255,0.72)');
  g.addColorStop(1, 'rgba(226,218,203,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, ch*0.6, cw, ch*0.4);
  ctx.restore();

  // 爐頭旋鈕（大目標）
  ctx.save();
  ctx.beginPath(); ctx.arc(L.knob.x, L.knob.y, L.knob.r + 10, 0, Math.PI*2);
  ctx.fillStyle = st.kind === 'knobDwell' ? 'rgba(224,123,57,0.35)' : 'rgba(255,255,255,0.55)';
  ctx.fill();
  drawSprite(ctx, advImg('stove_knob'), L.knob.x, L.knob.y, L.knob.r*2, { shadow:true });
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 15px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('爐頭', L.knob.x, L.knob.y + L.knob.r + 12);
  ctx.restore();

  // 炒鍋 + 碟
  const hot = ['heat','oil','pour','salt','onion','plate','off'].indexOf(st.id) >= 0;
  if(hot){
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(nowMs()/220);
    ctx.fillStyle = '#E07B39';
    ctx.beginPath(); ctx.ellipse(L.wok.x, L.wok.y + L.wok.r*0.5, L.wok.r*0.9, L.wok.r*0.22, 0, 0, Math.PI*2);
    ctx.fill(); ctx.restore();
  }
  drawSprite(ctx, advImg('wok'), L.wok.x, L.wok.y, L.wok.r*2.2, { shadow:true });
  drawSprite(ctx, advImg(cook.idx >= 11 ? 'friedrice' : 'plate_empty'),
    L.plate.x, L.plate.y, L.plate.r*2.1, { shadow:true });
  ctx.save();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 17px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('炒鍋', L.wok.x, L.wok.y + L.wok.r*0.9);
  ctx.fillText('碟', L.plate.x, L.plate.y + L.plate.r*0.95);
  ctx.restore();

  // 目前步驟道具（放大顯示）
  const bob = Math.sin(nowMs()/420) * 6;
  drawSprite(ctx, advImg(st.prop), L.prop.x, L.prop.y + bob, L.prop.s, { shadow:true });

  // 進度圓點（12 步）
  ctx.save();
  const dotR = 7, gap = 22;
  const startX = cw/2 - (COOK_STEPS.length - 1) * gap / 2;
  for(let i=0;i<COOK_STEPS.length;i++){
    ctx.beginPath();
    ctx.arc(startX + i*gap, ch - 26, dotR, 0, Math.PI*2);
    ctx.fillStyle = i < cook.idx ? '#1A6B5A' : (i === cook.idx ? '#E07B39' : 'rgba(0,0,0,0.18)');
    ctx.fill();
  }
  ctx.restore();

  // 肩–肘–腕 小骨架 overlay
  drawPoseMini(ctx, cw - 132, 96, 120, 96);

  advDrawCursor(ctx, 0);
}

/* 小骨架：右上角顯示肩／肘／腕 */
function drawPoseMini(ctx, x, y, w, h){
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  rrPath(ctx, x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1.5;
  rrPath(ctx, x, y, w, h, 12); ctx.stroke();
  ctx.fillStyle = '#3a3a3a';
  ctx.font = 'bold 11px "PingFang TC",sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('肩 · 肘 · 腕', x + 8, y + 6);
  const s = poseSide();
  if(s){
    const px = p => x + 10 + (1 - p.x) * (w - 20);
    const py = p => y + 22 + p.y * (h - 32);
    ctx.strokeStyle = '#0a7d75'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px(s.s), py(s.s)); ctx.lineTo(px(s.e), py(s.e)); ctx.lineTo(px(s.w), py(s.w));
    ctx.stroke();
    [[s.s,'#1A6B5A'],[s.e,'#E07B39'],[s.w,'#C0392B']].forEach(([p,c])=>{
      ctx.beginPath(); ctx.arc(px(p), py(p), 5, 0, Math.PI*2);
      ctx.fillStyle = c; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    const ea = elbowAngleDeg();
    if(ea != null){
      ctx.fillStyle = '#3a3a3a';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(Math.round(ea) + '°', x + w - 34, y + 6);
    }
  } else {
    ctx.fillStyle = '#8a8a8a';
    ctx.font = '11px "PingFang TC",sans-serif';
    ctx.fillText('未偵測', x + 10, y + h/2);
  }
  ctx.restore();
}

/* 完成畫面：12 步縮圖 */
function drawCookSummary(c, w, h){
  c.fillStyle = '#2F7A4F'; c.fillRect(0,0,w,h);
  c.fillStyle = 'rgba(255,255,255,0.10)';
  rrPath(c, 14, 14, w-28, h-28, 14); c.fill();
  const cols = 6, cw = (w - 40) / cols, chh = (h - 40) / 2;
  COOK_STEPS.forEach((st, i)=>{
    const cx = 20 + (i % cols) * cw + cw/2;
    const cy = 20 + Math.floor(i / cols) * chh + chh/2 - 8;
    drawSprite(c, advImg(st.prop), cx, cy, Math.min(cw, chh) * 0.66);
    c.fillStyle = '#fff';
    c.font = 'bold 12px "PingFang TC",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText((i+1) + '. ' + st.text.slice(0, 6), cx, cy + chh*0.32);
  });
}
