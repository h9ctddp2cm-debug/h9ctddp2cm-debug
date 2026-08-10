/* ==================================================================
   進階活動模組（麻雀 / 啤牌 / 煮飯 / 插花 / 收衫）
   —— 共用基建：資產、獎勵回饋、選取引擎、姿勢追蹤
   所有內容留在記憶體，不使用 localStorage / cookies。
   ================================================================== */

const ADV_THEMES = ['mahjong','cards','cooking','flowers','laundry'];
function isAdvTheme(id){ return ADV_THEMES.indexOf(id || state.theme) >= 0; }

/* ---------- 圖片資產（透明 PNG） ---------- */
const ADV_IMG = {};
const ADV_ASSETS = [
  'rice_bowl','eggs','spring_onion','oil_bottle','egg_beaten','onion_chopped',
  'plate_empty','salt_dish','wok','friedrice','stove_knob','board_knife',
  'fl_rose','fl_chrys','fl_sunflower','fl_gerbera','fl_tulip','fl_lily',
  'leaf_blade','leaf_euca','vase',
  'mahjong_atlas','cards_atlas'
];
['red','blue','yellow','green'].forEach(c=>{
  ['g_tshirt','g_socks','g_shorts','g_vest','g_trousers','g_jacket','basket']
    .forEach(g=> ADV_ASSETS.push(g + '_' + c));
});
function advImg(name){
  if(!ADV_IMG[name]){
    const im = new Image();
    im.decoding = 'async';
    im.src = 'img/advanced/' + name + '.png';
    ADV_IMG[name] = im;
  }
  return ADV_IMG[name];
}
function preloadAdvAssets(){ ADV_ASSETS.forEach(advImg); }

/* 以「最長邊 = size」等比繪製透明 PNG（中心對齊） */
function drawSprite(ctx, img, cx, cy, size, opts){
  if(!img || !img.complete || !img.naturalWidth) return false;
  const o = opts || {};
  const iw = img.naturalWidth, ih = img.naturalHeight;
  let dw, dh;
  if(iw >= ih){ dw = size; dh = size * ih / iw; } else { dh = size; dw = size * iw / ih; }
  ctx.save();
  ctx.translate(cx, cy);
  if(o.rot) ctx.rotate(o.rot);
  if(o.alpha != null) ctx.globalAlpha = o.alpha;
  if(o.shadow){
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  }
  ctx.drawImage(img, -dw/2 + (o.ax || 0), -dh/2 + (o.ay || 0), dw, dh);
  ctx.restore();
  return true;
}
/* 以底部為基準點繪製（花枝插入花瓶用） */
function drawSpriteBottom(ctx, img, cx, byy, size, rot, alpha){
  if(!img || !img.complete || !img.naturalWidth) return false;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  let dw, dh;
  if(iw >= ih){ dw = size; dh = size * ih / iw; } else { dh = size; dw = size * iw / ih; }
  ctx.save();
  ctx.translate(cx, byy);
  if(rot) ctx.rotate(rot);
  if(alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(img, -dw/2, -dh, dw, dh);
  ctx.restore();
  return true;
}

/* ---------- 麻雀 / 啤牌 atlas ---------- */
const MJ_ATLAS = { cw:132, ch:176, cols:9 };
const MJ_ROW = { p:0, s:1, w:2 };
const MJ_HONOR = ['E','S','W','N','C','F','B'];
const MJ_NAME = {
  E:'東', S:'南', W:'西', N:'北', C:'紅中', F:'發財', B:'白板'
};
function mjCell(code){
  if(MJ_HONOR.indexOf(code) >= 0) return { col: MJ_HONOR.indexOf(code), row: 3 };
  const suit = code[0], n = parseInt(code.slice(1), 10);
  return { col: n - 1, row: MJ_ROW[suit] };
}
function mjLabel(code){
  if(MJ_NAME[code]) return MJ_NAME[code];
  const n = '一二三四五六七八九'[parseInt(code.slice(1),10) - 1];
  return n + ({ p:'筒', s:'索', w:'萬' })[code[0]];
}
/* 麻雀牌繪製：tileW 寬，等比高 */
function drawTile(ctx, code, x, y, tileW, opts){
  const img = advImg('mahjong_atlas');
  const c = mjCell(code);
  const h = tileW * MJ_ATLAS.ch / MJ_ATLAS.cw;
  const o = opts || {};
  if(img.complete && img.naturalWidth){
    ctx.save();
    if(o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.drawImage(img, c.col * MJ_ATLAS.cw, c.row * MJ_ATLAS.ch,
      MJ_ATLAS.cw, MJ_ATLAS.ch, x - tileW/2, y - h/2, tileW, h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#F7F3E6'; ctx.strokeStyle = '#8C8672'; ctx.lineWidth = 2;
    rrPath(ctx, x - tileW/2, y - h/2, tileW, h, tileW*0.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(tileW*0.42) + 'px "PingFang TC","Noto Sans TC",sans-serif';
    ctx.fillText(mjLabel(code).slice(0,1), x, y);
    ctx.restore();
  }
  return h;
}
const CARD_ATLAS = { cw:132, ch:184 };
const CARD_SUITS = ['S','H','D','C'];
const CARD_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CARD_SUIT_NAME = { S:'黑桃', H:'紅心', D:'紅磚', C:'梅花' };
const CARD_SUIT_SYM  = { S:'♠', H:'♥', D:'♦', C:'♣' };
const CARD_SUIT_COLOR= { S:'#1A1A1E', H:'#BA2026', D:'#BA2026', C:'#1A1A1E' };
function drawCard2(ctx, suit, rank, x, y, cardW, opts){
  const img = advImg('cards_atlas');
  const col = CARD_RANKS.indexOf(rank), row = CARD_SUITS.indexOf(suit);
  const h = cardW * CARD_ATLAS.ch / CARD_ATLAS.cw;
  const o = opts || {};
  ctx.save();
  if(o.rot){ ctx.translate(x, y); ctx.rotate(o.rot); ctx.translate(-x, -y); }
  if(o.alpha != null) ctx.globalAlpha = o.alpha;
  if(img.complete && img.naturalWidth){
    ctx.drawImage(img, col * CARD_ATLAS.cw, row * CARD_ATLAS.ch,
      CARD_ATLAS.cw, CARD_ATLAS.ch, x - cardW/2, y - h/2, cardW, h);
  } else {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#777'; ctx.lineWidth = 2;
    rrPath(ctx, x - cardW/2, y - h/2, cardW, h, cardW*0.1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CARD_SUIT_COLOR[suit]; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font = 'bold ' + Math.round(cardW*0.5) + 'px -apple-system,sans-serif';
    ctx.fillText(CARD_SUIT_SYM[suit], x, y);
  }
  ctx.restore();
  return h;
}

/* ---------- 進階 UI DOM（動態建立，避免改動原有結構） ---------- */
let advDom = null;
function buildAdvDom(){
  if(advDom) return advDom;
  const stage = document.querySelector('.game-stage');
  const css = document.createElement('style');
  css.textContent = `
.adv-panel{position:absolute;left:50%;transform:translateX(-50%);top:86px;z-index:12;
  width:min(780px,92%);background:rgba(255,255,255,0.96);border-radius:18px;
  padding:14px 18px 16px;box-shadow:0 6px 24px rgba(0,0,0,0.25);text-align:center;}
.adv-panel .ap-step{font-size:13px;font-weight:800;color:#0a7d75;letter-spacing:0.04em;}
.adv-panel .ap-text{font-size:clamp(20px,3.4vw,30px);font-weight:800;color:#1f1f1f;line-height:1.35;margin:4px 0 8px;}
.adv-panel .ap-goal{font-size:15px;font-weight:700;color:#4a4a4a;}
.adv-panel .ap-metric{font-size:13px;color:#5b5b5b;margin-top:6px;line-height:1.5;}
.adv-progress{height:12px;border-radius:999px;background:#e6e2d8;overflow:hidden;margin:10px 0 6px;}
.adv-progress > i{display:block;height:100%;background:linear-gradient(90deg,#1A6B5A,#2E9E7E);width:0;transition:width .25s ease;}
.adv-btnrow{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.adv-btn{font-family:inherit;font-size:15px;font-weight:800;padding:11px 16px;border-radius:12px;
  border:2px solid #1A6B5A;background:#fff;color:#12564a;cursor:pointer;min-height:44px;}
.adv-btn.solid{background:#0a7d75;color:#fff;border-color:#0a7d75;}
.adv-btn.warn{border-color:#C0392B;color:#9c2c20;}
.adv-note{position:absolute;left:50%;transform:translateX(-50%);bottom:64px;z-index:12;
  width:min(760px,94%);background:rgba(24,24,24,0.82);color:#fff;border-radius:12px;
  padding:8px 14px;font-size:13px;line-height:1.5;text-align:center;}
.adv-toast{position:absolute;left:50%;transform:translateX(-50%) translateY(-8px);top:16px;z-index:44;
  background:rgba(10,125,117,0.96);color:#fff;padding:12px 20px;border-radius:14px;
  font-size:18px;font-weight:800;box-shadow:0 6px 20px rgba(0,0,0,0.3);opacity:0;
  transition:opacity .2s ease, transform .2s ease;pointer-events:none;text-align:center;max-width:90%;}
.adv-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
.adv-toast small{display:block;font-size:13px;font-weight:700;opacity:0.92;margin-top:3px;}
.reward-overlay{position:absolute;inset:0;z-index:60;background:rgba(12,32,26,0.94);
  display:none;flex-direction:column;align-items:center;justify-content:flex-start;
  padding:18px 16px 20px;overflow:auto;color:#fff;text-align:center;}
.reward-overlay.show{display:flex;}
.reward-tier{font-size:14px;font-weight:800;letter-spacing:0.12em;color:#FFD166;}
.reward-title{font-size:clamp(26px,5vw,40px);font-weight:900;margin:4px 0 2px;}
.reward-sub{font-size:clamp(15px,2.4vw,19px);font-weight:700;color:#CFEFE4;margin-bottom:10px;}
.reward-canvas{width:min(920px,96%);border-radius:16px;background:#2F7A4F;box-shadow:0 8px 30px rgba(0,0,0,0.4);}
.reward-detail{font-size:15px;line-height:1.7;margin-top:10px;max-width:720px;}
.reward-prog{width:min(560px,92%);margin-top:12px;}
.reward-prog .lbl{font-size:13px;font-weight:700;color:#CFEFE4;margin-bottom:5px;}
.keepsake{position:absolute;inset:0;z-index:62;background:#F7F4EE;display:none;
  flex-direction:column;align-items:center;padding:14px 14px 18px;overflow:auto;}
.keepsake.show{display:flex;}
.keepsake h2{font-size:22px;margin:2px 0 8px;color:#12564a;}
.keepsake canvas.preview{width:min(520px,94%);border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,0.18);background:#fff;}
.keepsake .field{width:min(520px,94%);margin-top:10px;text-align:left;}
.keepsake label{display:block;font-size:14px;font-weight:800;color:#3a3a3a;margin-bottom:5px;}
.keepsake input[type=text]{width:100%;font-family:inherit;font-size:20px;padding:12px;border-radius:12px;
  border:2px solid #c9c2b4;background:#fff;min-height:48px;}
.keepsake canvas.sig{width:100%;height:120px;border:2px dashed #c9c2b4;border-radius:12px;background:#fff;touch-action:none;}
.sig-hint{font-size:12px;color:#6a6a6a;margin-top:4px;}
@media (max-height:520px){ .adv-panel{top:70px;padding:9px 12px 10px;} .adv-panel .ap-text{font-size:19px;} }
`;
  document.head.appendChild(css);

  const mk = (cls, html, id)=>{
    const d = document.createElement('div');
    d.className = cls; if(id) d.id = id; if(html) d.innerHTML = html;
    stage.appendChild(d); return d;
  };

  const panel = mk('adv-panel', `
    <div class="ap-step" id="advStepNo"></div>
    <div class="ap-text" id="advStepText"></div>
    <div class="ap-goal" id="advStepGoal"></div>
    <div class="adv-progress"><i id="advStepBar"></i></div>
    <div class="ap-metric" id="advMetric"></div>
    <div class="adv-btnrow" id="advBtnRow"></div>`, 'advPanel');
  panel.style.display = 'none';

  const note = mk('adv-note', '', 'advNote');
  note.style.display = 'none';

  const toast = mk('adv-toast', '', 'advToast');

  const reward = mk('reward-overlay', `
    <div class="reward-tier" id="rwTier"></div>
    <div class="reward-title" id="rwTitle"></div>
    <div class="reward-sub" id="rwSub"></div>
    <canvas class="reward-canvas" id="rwCanvas" width="920" height="300"></canvas>
    <div class="reward-detail" id="rwDetail"></div>
    <div class="reward-prog">
      <div class="lbl" id="rwProgLbl"></div>
      <div class="adv-progress" style="background:rgba(255,255,255,0.22)"><i id="rwProgBar"></i></div>
    </div>
    <div class="adv-btnrow"><button class="adv-btn solid" id="rwContinue">繼續下一局 ▶</button></div>`,
    'rewardOverlay');
  reward.setAttribute('role','dialog');
  reward.setAttribute('aria-label','成績回饋');

  const keep = mk('keepsake', `
    <h2>作品完成 · 加上你的名字</h2>
    <canvas class="preview" id="ksPreview" width="1000" height="1300"></canvas>
    <div class="field">
      <label for="ksName">在花瓶上寫上名字（只保存在此頁，不會儲存）</label>
      <input type="text" id="ksName" maxlength="12" placeholder="例如：陳女士" autocomplete="off">
    </div>
    <div class="field">
      <label for="ksSig">親筆簽名（可選）</label>
      <canvas class="sig" id="ksSig" width="1000" height="240"></canvas>
      <div class="sig-hint">用手指或滑鼠在框內簽名。<button class="adv-btn" id="ksSigClear" style="padding:6px 10px;font-size:13px;min-height:34px;margin-top:6px;">清除簽名</button></div>
    </div>
    <div class="adv-btnrow">
      <button class="adv-btn solid" id="ksDownload">下載作品 PNG</button>
      <button class="adv-btn" id="ksBack">返回繼續插花</button>
      <button class="adv-btn warn" id="ksFinish">完成訓練</button>
    </div>`, 'keepsake');
  keep.setAttribute('role','dialog');
  keep.setAttribute('aria-label','插花作品留念');

  advDom = { panel, note, toast, reward, keep };
  return advDom;
}

function advSetPanel(o){
  const d = buildAdvDom();
  d.panel.style.display = o ? 'block' : 'none';
  if(!o) return;
  const set = (id, v)=>{ const el = document.getElementById(id); if(el) el.innerHTML = (v == null ? '' : v); };
  set('advStepNo', o.stepNo || '');
  set('advStepText', o.text || '');
  set('advStepGoal', o.goal || '');
  set('advMetric', o.metric || '');
  const bar = document.getElementById('advStepBar');
  if(bar) bar.style.width = Math.round(Math.max(0, Math.min(1, o.pct || 0)) * 100) + '%';
  const row = document.getElementById('advBtnRow');
  if(row && o.buttons){
    row.innerHTML = '';
    o.buttons.forEach(b=>{
      const btn = document.createElement('button');
      btn.className = 'adv-btn' + (b.solid ? ' solid' : '') + (b.warn ? ' warn' : '');
      btn.textContent = b.label; btn.id = b.id || '';
      btn.addEventListener('click', (e)=>{ e.stopPropagation(); b.onClick(); });
      row.appendChild(btn);
    });
  }
}
function advSetNote(text){
  const d = buildAdvDom();
  d.note.style.display = text ? 'block' : 'none';
  if(text) d.note.textContent = text;
}

/* ==================================================================
   正向回饋系統（全站遊戲共用）
   即時視覺獎勵 + 慶祝音效 / 廣東話語音 + 具名成就 + 下一階段進度
   語氣為成人尊重式，不使用兒語。
   ================================================================== */
const ENCOURAGE = ['做得好，繼續保持。','好準，再嚟一次。','控制得好穩。','非常好，繼續動。','掌握得好，再嚟一局。'];
let encourageIdx = 0;
function nextEncourage(){ const t = ENCOURAGE[encourageIdx % ENCOURAGE.length]; encourageIdx++; return t; }

/* 畫布慶祝粒子（confetti / sparkle） */
let fxParticles = [];
function fxBurst(x, y, opts){
  const o = opts || {};
  const n = o.count || 26;
  const colors = o.colors || ['#F2C230','#E07B39','#2E9E7E','#C0392B','#FFFFFF','#5AA9E6'];
  for(let i=0;i<n;i++){
    const a = Math.random() * Math.PI * 2;
    const sp = (o.speed || 4.2) * (0.5 + Math.random());
    fxParticles.push({
      x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 1.6,
      life: 1, decay: 0.012 + Math.random()*0.014,
      size: (o.size || 9) * (0.6 + Math.random()*0.9),
      col: colors[(Math.random()*colors.length)|0],
      rot: Math.random()*Math.PI, vr: (Math.random()-0.5)*0.3,
    });
  }
  if(fxParticles.length > 400) fxParticles = fxParticles.slice(-400);
}
function fxRing(x, y){ fxRings.push({ x, y, r: 24, life: 1 }); }
let fxRings = [];
function fxUpdateDraw(ctx){
  for(const p of fxParticles){
    p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.99;
    p.rot += p.vr; p.life -= p.decay;
  }
  fxParticles = fxParticles.filter(p=>p.life > 0);
  for(const p of fxParticles){
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.col;
    ctx.fillRect(-p.size/2, -p.size/3, p.size, p.size*0.66);
    ctx.restore();
  }
  for(const r of fxRings){ r.r += 6; r.life -= 0.05; }
  fxRings = fxRings.filter(r=>r.life > 0);
  for(const r of fxRings){
    ctx.save();
    ctx.globalAlpha = Math.max(0, r.life) * 0.8;
    ctx.strokeStyle = '#2E9E7E'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}

/* 即時小獎勵：具名成就 toast + 粒子 + 音效 + 語音 */
let lastRewardLog = [];
function rewardSmall(o){
  // o: { achievement, detail, x, y, tts, progressLabel, silent }
  const d = buildAdvDom();
  const t = d.toast;
  t.innerHTML = '<span>🎉 ' + (o.achievement || '完成') + '</span>' +
    (o.detail ? '<small>' + o.detail + '</small>' : '') +
    (o.progressLabel ? '<small>' + o.progressLabel + '</small>' : '');
  t.classList.add('show');
  clearTimeout(window._advToastTimer);
  window._advToastTimer = setTimeout(()=>{ t.classList.remove('show'); }, 2200);
  if(o.x != null){ fxBurst(o.x, o.y, { count: o.big ? 34 : 20 }); fxRing(o.x, o.y); }
  if(!o.silent){ playCorrectSound(); }
  if(o.tts !== false){ speakCantonese(o.tts || nextEncourage()); }
  lastRewardLog.push({ achievement:o.achievement || '', detail:o.detail || '', progress:o.progressLabel || '' });
  if(lastRewardLog.length > 12) lastRewardLog.shift();
}

/* 大獎勵：全螢幕慶祝（麻雀和牌 / 一局完成 / 插花作品） */
let rewardOnContinue = null;
function rewardBig(o){
  // o: { tier, title, sub, detail, progressLabel, progressPct, draw(ctx,w,h), tts, onContinue, continueLabel }
  const d = buildAdvDom();
  document.getElementById('rwTier').textContent = o.tier || '';
  document.getElementById('rwTitle').textContent = o.title || '';
  document.getElementById('rwSub').textContent = o.sub || '';
  document.getElementById('rwDetail').innerHTML = o.detail || '';
  document.getElementById('rwProgLbl').textContent = o.progressLabel || '';
  document.getElementById('rwProgBar').style.width =
    Math.round(Math.max(0, Math.min(1, o.progressPct || 0)) * 100) + '%';
  const btn = document.getElementById('rwContinue');
  btn.textContent = o.continueLabel || '繼續下一局 ▶';
  const cv = document.getElementById('rwCanvas');
  if(o.draw){
    cv.style.display = 'block';
    cv.height = o.canvasH || 300;
    const c2 = cv.getContext('2d');
    c2.clearRect(0,0,cv.width,cv.height);
    o.draw(c2, cv.width, cv.height);
  } else { cv.style.display = 'none'; }
  d.reward.classList.add('show');
  rewardOnContinue = o.onContinue || null;
  playApplause();
  fxBurst(gameCanvas.width*0.5, gameCanvas.height*0.4, { count: 60, speed: 6 });
  if(o.tts) speakCantonese(o.tts);
  lastRewardLog.push({ achievement:(o.tier || '') + ' ' + (o.title || ''), detail:o.sub || '',
    progress:o.progressLabel || '' });
}
function rewardClose(){
  const d = buildAdvDom();
  d.reward.classList.remove('show');
  const cb = rewardOnContinue; rewardOnContinue = null;
  if(cb) cb();
}
function rewardIsOpen(){ return advDom && advDom.reward.classList.contains('show'); }

/* ==================================================================
   選取 / 搬運引擎 —— 沿用級別機制
   Level 4–5（grasp）：握拳選取 / 張開放下，容錯範圍較闊
   Level 6–7（reach）：食指停留（dwell）選取及放下
   ================================================================== */
const SEL_TOL = { grasp: 130, reach: 70 };
function selTol(){ return state.gameType === 'grasp' ? SEL_TOL.grasp : SEL_TOL.reach; }

function nearestItem(items){
  let best = null, bd = Infinity;
  for(const it of items){
    if(it.gone) continue;
    const d = Math.hypot(cursorX - it.x, cursorY - it.y);
    const tol = (it.r || 60) + selTol();
    if(d <= tol && d < bd){ bd = d; best = it; }
  }
  return best;
}

/* 點選式（麻雀 / 啤牌）：回傳被選中的 id */
const picker = {
  hoverId:null, start:0, pct:0, armed:true, lock:null,
  reset(){ this.hoverId=null; this.start=0; this.pct=0; this.armed=true; this.lock=null; },
  poll(items){
    this.pct = 0;
    if(cursorX < 0 || !handDetected){ this.hoverId = null; return null; }
    const best = nearestItem(items);
    if(!best){ this.hoverId = null; this.start = 0; this.lock = null; return null; }
    this.hoverId = best.id;
    if(state.gameType === 'grasp'){
      if(!isGrasping){ this.armed = true; return null; }
      if(this.armed){ this.armed = false; return best.id; }
      return null;
    }
    const now = nowMs();
    if(this.lock === best.id) return null;
    if(this.startId !== best.id){ this.startId = best.id; this.start = now; }
    if(!isStill(now)){ this.start = now; return null; }
    const el = now - this.start;
    this.pct = Math.min(1, el / DWELL_MS);
    if(el >= DWELL_MS){ this.lock = best.id; this.start = now; return best.id; }
    return null;
  },
};

/* 搬運式（收衫 / 插花）：grab → 跟隨游標 → drop（在區域內或任意位置） */
const carrier = {
  heldId:null, hoverId:null, startId:null, start:0, pct:0, armed:true, relStart:0,
  reset(){ this.heldId=null; this.hoverId=null; this.startId=null; this.start=0;
           this.pct=0; this.armed=true; this.relStart=0; },
  poll(items, zones){
    const ev = { grab:null, drop:null, zone:null };
    this.pct = 0;
    if(cursorX < 0 || !handDetected) return ev;
    const now = nowMs();
    if(!this.heldId){
      const best = nearestItem(items);
      this.hoverId = best ? best.id : null;
      if(!best){ this.startId = null; return ev; }
      if(state.gameType === 'grasp'){
        if(!isGrasping){ this.armed = true; return ev; }
        if(this.armed){ this.armed = false; this.heldId = best.id; this.relStart = 0; ev.grab = best.id; }
        return ev;
      }
      if(this.startId !== best.id){ this.startId = best.id; this.start = now; }
      if(!isStill(now)){ this.start = now; return ev; }
      const el = now - this.start;
      this.pct = Math.min(1, el / DWELL_MS);
      if(el >= DWELL_MS){ this.heldId = best.id; ev.grab = best.id; this.startId = null; this.pct = 0; }
      return ev;
    }
    // 已握住：尋找游標所在的放置區
    let z = null;
    for(const zz of (zones || [])){
      if(cursorX >= zz.x - zz.w/2 && cursorX <= zz.x + zz.w/2 &&
         cursorY >= zz.y - zz.h/2 && cursorY <= zz.y + zz.h/2){ z = zz; break; }
    }
    if(state.gameType === 'grasp'){
      if(!isGrasping){
        if(!this.relStart) this.relStart = now;
        this.pct = Math.min(1, (now - this.relStart) / 400);
        if(now - this.relStart >= 400){
          ev.drop = this.heldId; ev.zone = z;
          this.heldId = null; this.relStart = 0; this.armed = true; this.pct = 0;
        }
      } else { this.relStart = 0; }
      return ev;
    }
    if(z){
      if(this.startId !== ('z:' + z.id)){ this.startId = 'z:' + z.id; this.start = now; }
      if(!isStill(now)){ this.start = now; return ev; }
      const el = now - this.start;
      this.pct = Math.min(1, el / DWELL_MS);
      if(el >= DWELL_MS){
        ev.drop = this.heldId; ev.zone = z;
        this.heldId = null; this.startId = null; this.pct = 0;
      }
    } else { this.startId = null; }
    return ev;
  },
};

/* ==================================================================
   MediaPipe Pose Landmarker（肩 / 肘 / 腕）
   與 Hand Landmarker 共用同一 webcam；各自維持單調遞增時間戳，
   避免重複 detectForVideo timestamp。
   若模型載入失敗 → poseFailed = true，煮飯改為「手部動作」模式，不阻塞其他活動。
   ================================================================== */
let poseLandmarker = null, poseLoading = null, poseFailed = false;
let lastPoseLm = null, lastPoseTs = 0;
let mpHandTs = 0, mpPoseTs = 0;
function nextTs(which){
  const t = performance.now();
  if(which === 'pose'){ mpPoseTs = Math.max(mpPoseTs + 1, t); return mpPoseTs; }
  mpHandTs = Math.max(mpHandTs + 1, t); return mpHandTs;
}
async function ensurePoseLandmarker(){
  if(poseLandmarker) return poseLandmarker;
  if(poseFailed) return null;
  if(poseLoading) return poseLoading;
  poseLoading = (async ()=>{
    const mpVision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
    const { PoseLandmarker, FilesetResolver } = mpVision;
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1
    });
    return poseLandmarker;
  })();
  try{
    return await poseLoading;
  }catch(err){
    poseFailed = true; poseLoading = null; poseLandmarker = null;
    return null;
  }
}
function detectPose(videoEl){
  if(!poseLandmarker || !videoEl || videoEl.readyState < 2) return null;
  try{
    const res = poseLandmarker.detectForVideo(videoEl, nextTs('pose'));
    if(res && res.landmarks && res.landmarks.length){
      lastPoseLm = res.landmarks[0];
      lastPoseTs = nowMs();
      return lastPoseLm;
    }
  }catch(e){ /* 忽略單幀失敗 */ }
  return null;
}
