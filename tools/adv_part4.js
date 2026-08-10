/* ==================================================================
   啤牌 = 花色收集
   場上一堆真實牌面，指定一個花色，收集足夠數目即完成一輪、換新花色。
   Tier 1 收集 3 張 → Tier 2 收集 4 張（干擾牌更多）→ Tier 3 收集 5 張（牌更多）
   → Tier 4 加入限時獎勵回合（雙倍分數）。
   ================================================================== */
const CARD_TIERS = [
  { tier:1, need:3, count:8,  label:'Tier 1 · 收集 3 張同花色', bonus:false },
  { tier:2, need:4, count:11, label:'Tier 2 · 收集 4 張（干擾牌增加）', bonus:false },
  { tier:3, need:5, count:14, label:'Tier 3 · 收集 5 張（牌數增加）', bonus:false },
  { tier:4, need:5, count:14, label:'Tier 4 · 限時獎勵回合（雙倍分）', bonus:true },
];
const cards = {
  active:false, tierIdx:0, rounds:0, suit:'H', need:3, got:0, field:[],
  combo:0, bestCombo:0, msg:'', bonusEndsAt:0, layout:null, idSeq:1,
  reset(){
    this.tierIdx = 0; this.rounds = 0; this.got = 0; this.field = [];
    this.combo = 0; this.bestCombo = 0; this.msg = ''; this.bonusEndsAt = 0; this.idSeq = 1;
  },
  cfg(){ return CARD_TIERS[Math.min(this.tierIdx, CARD_TIERS.length - 1)]; },
};
function cardsTierFor(rounds){
  if(rounds >= 6) return 3;
  if(rounds >= 4) return 2;
  if(rounds >= 2) return 1;
  return 0;
}
function cardsNewBoard(newSuit){
  const cfg = cards.cfg();
  cards.need = cfg.need;
  cards.got = 0;
  if(newSuit){
    const others = CARD_SUITS.filter(s=>s !== cards.suit);
    cards.suit = others[(Math.random()*others.length)|0];
  }
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const cardW = Math.max(52, Math.min(96, cw / 9));
  const cardH = cardW * CARD_ATLAS.ch / CARD_ATLAS.cw;
  const field = [];
  const place = (suit)=>{
    const rank = CARD_RANKS[(Math.random()*CARD_RANKS.length)|0];
    for(let a=0;a<160;a++){
      const x = cardW*0.7 + Math.random() * (cw - cardW*1.4);
      const y = ch*0.36 + Math.random() * (ch*0.50);
      let ok = true;
      for(const f of field){
        if(Math.hypot(f.x - x, f.y - y) < cardW * 1.15){ ok = false; break; }
      }
      if(ok){
        field.push({ id:'c' + (cards.idSeq++), suit, rank, x, y,
          r: cardW*0.62, rot:(Math.random()-0.5)*0.22, gone:false, w:cardW, h:cardH });
        return;
      }
    }
    field.push({ id:'c' + (cards.idSeq++), suit, rank,
      x: cardW*0.8 + Math.random()*(cw - cardW*1.6),
      y: ch*0.40 + Math.random()*(ch*0.44),
      r: cardW*0.62, rot:0, gone:false, w:cardW, h:cardH });
  };
  for(let i=0;i<cfg.need;i++) place(cards.suit);
  const others = CARD_SUITS.filter(s=>s !== cards.suit);
  for(let i=0;i<cfg.count - cfg.need;i++) place(others[(Math.random()*others.length)|0]);
  cards.field = field;
  if(cfg.bonus) cards.bonusEndsAt = nowMs() + 30000;
  picker.reset();
  cardsPanel();
}
function cardsPanel(){
  const cfg = cards.cfg();
  const bonusLeft = cfg.bonus ? Math.max(0, Math.ceil((cards.bonusEndsAt - nowMs())/1000)) : 0;
  advSetPanel({
    stepNo: cfg.label + (cfg.bonus ? ' · 剩 ' + bonusLeft + ' 秒' : ''),
    text:'請收集：' + CARD_SUIT_NAME[cards.suit] + ' ' + CARD_SUIT_SYM[cards.suit],
    goal:'已收集 ' + cards.got + ' / ' + cards.need +
      '　連續正確 ' + cards.combo + ' 次',
    metric:'下一階段：完成 ' + Math.max(0, (cardsTierFor(cards.rounds) === 3 ? 0 :
      [2,4,6][cardsTierFor(cards.rounds)] - cards.rounds)) + ' 輪後升級',
    pct: cards.got / cards.need,
    buttons:[
      { label:'🔊 讀出目標', onClick:()=> speakCantonese('請收集' + CARD_SUIT_NAME[cards.suit]) },
    ],
  });
}
function cardsUpdate(){
  const cfg = cards.cfg();
  if(cfg.bonus && cards.bonusEndsAt && nowMs() > cards.bonusEndsAt){
    cards.bonusEndsAt = nowMs() + 30000;   // 下一段獎勵時間
  }
  const items = cards.field.filter(c=>!c.gone);
  const hit = picker.poll(items);
  if(!hit) return;
  const c = cards.field.find(x=>x.id === hit);
  if(!c || c.gone) return;
  const cfg2 = cards.cfg();
  if(c.suit === cards.suit){
    c.gone = true;
    cards.got++; cards.combo++;
    if(cards.combo > cards.bestCombo) cards.bestCombo = cards.combo;
    const pts = cfg2.bonus ? 20 : 10;
    score += pts; correctCount++; grabCount++;
    updateHUD();
    if(cards.got >= cards.need){
      cards.rounds++;
      const oldTier = cards.tierIdx;
      cards.tierIdx = cardsTierFor(cards.rounds);
      const upgraded = cards.tierIdx > oldTier;
      if(upgraded){
        rewardBig({
          tier:'升級 · ' + CARD_TIERS[cards.tierIdx].label,
          title:'完成一輪收集！',
          sub:'成就：' + CARD_SUIT_NAME[cards.suit] + '收集 ×' + cards.need +
              ' · 連續正確 ' + cards.combo + ' 次',
          detail:'新階段：' + CARD_TIERS[cards.tierIdx].label +
            (CARD_TIERS[cards.tierIdx].bonus ? '<br>限時獎勵回合，每張牌雙倍分數。' : ''),
          progressLabel:'已完成 ' + cards.rounds + ' 輪 · 累積分數 ' + score,
          progressPct: Math.min(1, cards.rounds / 8),
          canvasH: 180,
          draw:(cx,w,h)=>{
            cx.fillStyle = '#154734'; cx.fillRect(0,0,w,h);
            const n = cards.need, cwid = Math.min(90, (w - 40)/n);
            for(let i=0;i<n;i++){
              drawCard2(cx, cards.suit, CARD_RANKS[(i*3) % CARD_RANKS.length],
                w/2 + (i - (n-1)/2) * (cwid + 8), h/2, cwid);
            }
          },
          tts:'完成一輪。升級到' + CARD_TIERS[cards.tierIdx].label + '。' + nextEncourage(),
          continueLabel:'繼續下一輪 ▶',
          onContinue:()=> cardsNewBoard(true),
        });
      } else {
        rewardSmall({
          achievement:'完成 ' + CARD_SUIT_NAME[cards.suit] + '收集 ×' + cards.need,
          detail:'連續正確 ' + cards.combo + ' 次 · 換新花色',
          progressLabel:'已完成 ' + cards.rounds + ' 輪，再 ' +
            Math.max(1, [2,4,6,99][cards.tierIdx] - cards.rounds) + ' 輪升級',
          x:c.x, y:c.y, big:true,
          tts:'完成一輪。' + nextEncourage(),
        });
        playApplause();
        setTimeout(()=>{ if(cards.active) cardsNewBoard(true); }, 1200);
      }
    } else {
      rewardSmall({
        achievement:'正確 · ' + CARD_SUIT_NAME[cards.suit] + ' ' + c.rank,
        detail:'已收集 ' + cards.got + ' / ' + cards.need,
        x:c.x, y:c.y, tts:false, silent:true,
      });
      playCorrectSound();
    }
  } else {
    cards.combo = 0;
    score = Math.max(0, score - 3);
    grabCount++;
    updateHUD();
    triggerFeedback(false);
    cards.msg = '呢張係' + CARD_SUIT_NAME[c.suit] + '，要揀' + CARD_SUIT_NAME[cards.suit] + '。';
    speakCantonese('呢張係' + CARD_SUIT_NAME[c.suit] + '。要揀' + CARD_SUIT_NAME[cards.suit] + '。');
  }
  cardsPanel();
}
function cardsRender(ctx){
  const cw = gameCanvas.width, ch = gameCanvas.height;
  ctx.save();
  ctx.fillStyle = 'rgba(24,66,48,0.80)';
  rrPath(ctx, 8, ch*0.30, cw-16, ch*0.66, 20); ctx.fill();
  ctx.restore();

  // 目標花色大標示
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  rrPath(ctx, cw/2 - 118, ch*0.315, 236, 44, 14); ctx.fill();
  ctx.fillStyle = CARD_SUIT_COLOR[cards.suit];
  ctx.font = 'bold 26px -apple-system,"PingFang TC",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(CARD_SUIT_SYM[cards.suit] + ' ' + CARD_SUIT_NAME[cards.suit] +
    '　' + cards.got + '/' + cards.need, cw/2, ch*0.315 + 23);
  ctx.restore();

  const hover = picker.hoverId;
  for(const c of cards.field){
    if(c.gone) continue;
    if(hover === c.id){
      ctx.save();
      ctx.fillStyle = 'rgba(224,123,57,0.35)';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r*1.35, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    drawCard2(ctx, c.suit, c.rank, c.x, c.y, c.w, { rot:c.rot });
  }
  advDrawCursor(ctx, picker.pct);
}

/* ==================================================================
   收衫 = 顏色分類
   真實衣物 PNG（襪／短褲／背心／外套／T恤／長褲）配 2–4 個同色衫籃。
   升級：顏色由 2 → 3 → 4，衣物數量／款式增加，顏色提示逐步減弱
   （但永遠保留大字顏色標籤，不單靠顏色分辨）。
   ================================================================== */
const LAUNDRY_COLORS = {
  red:   { name:'紅色', hex:'#C43E34' },
  blue:  { name:'藍色', hex:'#2C6CB2' },
  yellow:{ name:'黃色', hex:'#E2B020' },
  green: { name:'綠色', hex:'#308A58' },
};
const GARMENT_TYPES = [
  { key:'g_socks',    name:'襪' },
  { key:'g_shorts',   name:'短褲' },
  { key:'g_vest',     name:'背心' },
  { key:'g_tshirt',   name:'T恤' },
  { key:'g_jacket',   name:'外套' },
  { key:'g_trousers', name:'長褲' },
];
const laundry = {
  active:false, correct:0, wrong:0, tier:1, colors:['red','blue'],
  garments:[], baskets:[], msg:'', idSeq:1, cueLevel:1, layout:null,
  reset(){
    this.correct = 0; this.wrong = 0; this.tier = 1; this.colors = ['red','blue'];
    this.garments = []; this.baskets = []; this.msg = ''; this.idSeq = 1; this.cueLevel = 1;
  },
};
function laundryTier(correct){
  if(correct >= 12) return 4;
  if(correct >= 8)  return 3;
  if(correct >= 4)  return 2;
  return 1;
}
function laundryConfig(tier){
  return [
    null,
    { colors:['red','blue'],                     items:4, types:3, cue:1 },
    { colors:['red','blue','yellow'],            items:5, types:4, cue:2 },
    { colors:['red','blue','yellow','green'],    items:6, types:5, cue:3 },
    { colors:['red','blue','yellow','green'],    items:7, types:6, cue:4 },
  ][tier];
}
function laundrySetup(){
  const cfg = laundryConfig(laundry.tier);
  laundry.colors = cfg.colors.slice();
  laundry.cueLevel = cfg.cue;
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const n = laundry.colors.length;
  const bw = Math.min((cw - 24) / n - 10, 240);
  const bh = Math.min(ch * 0.22, bw * 0.72);
  laundry.baskets = laundry.colors.map((c, i)=>({
    id:'b' + c, color:c, x: cw * ((i + 0.5) / n), y: ch - bh*0.62 - 8,
    w: bw, h: bh,
  }));
  laundry.garments = [];
  laundryRefill();
  carrier.reset();
  laundryPanel();
}
function laundryRefill(){
  const cfg = laundryConfig(laundry.tier);
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const size = Math.max(70, Math.min(130, Math.min(cw, ch) * 0.17));
  const types = GARMENT_TYPES.slice(0, cfg.types);
  let guard = 0;
  while(laundry.garments.filter(g=>!g.gone).length < cfg.items && guard++ < 60){
    const t = types[(Math.random()*types.length)|0];
    const c = laundry.colors[(Math.random()*laundry.colors.length)|0];
    let x = 0, y = 0, ok = false;
    for(let a=0;a<140 && !ok;a++){
      x = size*0.7 + Math.random()*(cw - size*1.4);
      y = ch*0.34 + Math.random()*(ch*0.36);
      ok = true;
      for(const g of laundry.garments){
        if(g.gone) continue;
        if(Math.hypot(g.x - x, g.y - y) < size * 1.05){ ok = false; break; }
      }
    }
    laundry.garments.push({
      id:'g' + (laundry.idSeq++), type:t.key, name:t.name, color:c,
      x, y, baseX:x, baseY:y, r:size*0.5, size, gone:false,
    });
  }
}
function laundryPanel(){
  const nextAt = [4,8,12,null][laundry.tier - 1];
  advSetPanel({
    stepNo:'Tier ' + laundry.tier + ' · ' + laundry.colors.length + ' 種顏色',
    text:'把衣物放入相同顏色的衫籃',
    goal: laundry.msg || '每件衣物都有顏色名稱，唔單靠顏色分辨。',
    metric:'已完成 ' + laundry.correct + ' 件' +
      (nextAt ? '　下一階段：再 ' + Math.max(1, nextAt - laundry.correct) + ' 件（加多一種顏色／款式）'
              : '　已到最高階段'),
    pct: nextAt ? Math.min(1, laundry.correct / nextAt) : 1,
    buttons:[
      { label:'🔊 讀出指示', onClick:()=> speakCantonese('把衣物放入相同顏色的衫籃。') },
    ],
  });
}
function laundryUpdate(){
  const items = laundry.garments.filter(g=>!g.gone);
  const zones = laundry.baskets.map(b=>({ id:b.id, x:b.x, y:b.y, w:b.w*1.1, h:b.h*1.2, ref:b }));
  const ev = carrier.poll(items, zones);
  const held = laundry.garments.find(g=>g.id === carrier.heldId);
  if(held && !held.gone){ held.x = cursorX; held.y = cursorY; }
  if(ev.grab){
    const g = laundry.garments.find(x=>x.id === ev.grab);
    if(g) laundry.msg = '拿住' + LAUNDRY_COLORS[g.color].name + g.name + '，放入' +
      LAUNDRY_COLORS[g.color].name + '衫籃。';
    laundryPanel();
  }
  if(ev.drop){
    const g = laundry.garments.find(x=>x.id === ev.drop);
    if(!g) return;
    const b = ev.zone ? ev.zone.ref : null;
    if(b && b.color === g.color){
      g.gone = true;
      laundry.correct++;
      score += 10; correctCount++; grabCount++;
      updateHUD();
      const oldTier = laundry.tier;
      laundry.tier = laundryTier(laundry.correct);
      if(laundry.tier > oldTier){
        laundrySetup();
        rewardBig({
          tier:'升級 · Tier ' + laundry.tier,
          title:'分類升級！',
          sub:'成就：顏色分類 ×' + laundry.correct + ' 件 · 現在 ' + laundry.colors.length + ' 種顏色',
          detail:'新階段：' + laundry.colors.map(c=>LAUNDRY_COLORS[c].name).join('、') +
            '，衣物款式增加，顏色提示會減弱，但顏色名稱一直保留。',
          progressLabel:'已完成 ' + laundry.correct + ' 件',
          progressPct: Math.min(1, laundry.correct / 12),
          canvasH: 170,
          draw:(cx,w,h)=>{
            cx.fillStyle = '#1D3B2A'; cx.fillRect(0,0,w,h);
            laundry.colors.forEach((c,i)=>{
              const x = w * ((i+0.5)/laundry.colors.length);
              drawSprite(cx, advImg('basket_' + c), x, h*0.52, Math.min(150, w/laundry.colors.length*0.8));
              cx.fillStyle = '#fff'; cx.font = 'bold 15px "PingFang TC",sans-serif';
              cx.textAlign = 'center'; cx.textBaseline = 'top';
              cx.fillText(LAUNDRY_COLORS[c].name, x, h*0.80);
            });
          },
          tts:'升級。現在有' + laundry.colors.length + '種顏色。' + nextEncourage(),
          continueLabel:'繼續 ▶',
          onContinue:()=>{},
        });
      } else {
        rewardSmall({
          achievement:'正確 · ' + LAUNDRY_COLORS[g.color].name + g.name,
          detail:'已完成 ' + laundry.correct + ' 件',
          progressLabel:'下一階段：再 ' +
            Math.max(1, ([4,8,12,99][laundry.tier-1]) - laundry.correct) + ' 件',
          x:b.x, y:b.y - b.h*0.3,
          tts: laundry.correct % 3 === 0 ? nextEncourage() : false,
        });
        laundryRefill();
      }
      laundry.msg = '';
    } else {
      g.x = g.baseX; g.y = g.baseY;
      laundry.wrong++;
      score = Math.max(0, score - 3);
      grabCount++;
      updateHUD();
      triggerFeedback(false);
      laundry.msg = b ? ('呢個係' + LAUNDRY_COLORS[b.color].name + '籃，' + g.name + '要放' +
        LAUNDRY_COLORS[g.color].name + '籃。') : '未放入衫籃，衣物返回原位。';
      speakCantonese(laundry.msg);
    }
    laundryPanel();
  }
}
function laundryRender(ctx){
  const cw = gameCanvas.width, ch = gameCanvas.height;
  ctx.save();
  const g0 = ctx.createLinearGradient(0, ch*0.3, 0, ch);
  g0.addColorStop(0, 'rgba(255,255,255,0.62)');
  g0.addColorStop(1, 'rgba(228,224,214,0.92)');
  ctx.fillStyle = g0;
  rrPath(ctx, 8, ch*0.30, cw-16, ch*0.68, 20); ctx.fill();
  ctx.restore();

  // 衫籃
  for(const b of laundry.baskets){
    const col = LAUNDRY_COLORS[b.color];
    const cueAlpha = [0.34, 0.26, 0.18, 0.10][Math.min(3, laundry.cueLevel - 1)];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + b.h*0.44, b.w*0.44, b.h*0.10, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = cueAlpha;
    ctx.fillStyle = col.hex;
    rrPath(ctx, b.x - b.w/2, b.y - b.h/2, b.w, b.h, 18); ctx.fill();
    ctx.restore();
    drawSprite(ctx, advImg('basket_' + b.color), b.x, b.y, b.w*0.92, { shadow:true });
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    const fs = Math.max(20, Math.round((state.labelFont || 36) * 0.62));
    ctx.font = 'bold ' + fs + 'px "PingFang TC","Noto Sans TC",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, fs*0.26);
    ctx.strokeText(col.name, b.x, b.y + b.h*0.12);
    ctx.fillStyle = col.hex;
    ctx.fillText(col.name, b.x, b.y + b.h*0.12);
    ctx.restore();
  }

  // 衣物
  const hover = carrier.hoverId;
  for(const g of laundry.garments){
    if(g.gone) continue;
    const isHeld = carrier.heldId === g.id;
    if(hover === g.id && !isHeld){
      ctx.save();
      ctx.fillStyle = 'rgba(224,123,57,0.30)';
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r*1.25, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    drawSprite(ctx, advImg(g.type + '_' + g.color), g.x, g.y, g.size,
      { shadow:true, alpha: isHeld ? 0.94 : 1 });
    ctx.save();
    const fs = Math.max(16, Math.round((state.labelFont || 36) * 0.46));
    ctx.font = 'bold ' + fs + 'px "PingFang TC","Noto Sans TC",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = Math.max(3, fs*0.3);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    const lbl = LAUNDRY_COLORS[g.color].name + g.name;
    ctx.strokeText(lbl, g.x, g.y + g.size*0.42);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(lbl, g.x, g.y + g.size*0.42);
    ctx.restore();
  }
  advDrawCursor(ctx, carrier.pct);
}

/* ==================================================================
   插花 = 自由創作（最簡單、不計分）
   自選花材／長葉，自由擺放、旋轉、縮放，插入花瓶。
   完成後可打名／簽名，下載 PNG 留念（名字只留在此頁記憶中）。
   ================================================================== */
const FLOWER_KINDS = [
  { key:'fl_rose',      name:'玫瑰' },
  { key:'fl_chrys',     name:'菊花' },
  { key:'fl_sunflower', name:'太陽花' },
  { key:'fl_gerbera',   name:'非洲菊' },
  { key:'fl_tulip',     name:'鬱金香' },
  { key:'fl_lily',      name:'百合' },
  { key:'leaf_blade',   name:'長葉' },
  { key:'leaf_euca',    name:'尤加利葉' },
];
const flowers = {
  active:false, palette:[], placed:[], sel:-1, msg:'', layout:null, idSeq:1,
  name:'', sigStrokes:[],
  reset(){
    this.palette = []; this.placed = []; this.sel = -1; this.msg = '';
    this.idSeq = 1; this.name = ''; this.sigStrokes = [];
  },
};
function flowersSetup(){
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const narrow = cw < 700;
  const cols = narrow ? 2 : 1;
  const size = Math.max(58, Math.min(110, Math.min(cw, ch) * 0.13));
  flowers.palette = FLOWER_KINDS.map((k, i)=>{
    const col = i % cols, row = Math.floor(i / cols);
    return {
      id:'pal' + i, kind:k.key, name:k.name,
      x: 18 + size*0.5 + col * (size*0.92),
      y: ch*0.30 + size*0.55 + row * (size*0.80),
      r: size*0.46, size,
    };
  });
  flowers.layout = {
    vase:{ x: cw * (narrow ? 0.62 : 0.58), y: ch - Math.min(ch*0.30, 210)*0.5 - 10,
           w: Math.min(cw*0.34, 250), h: Math.min(ch*0.30, 210) },
    size,
  };
  carrier.reset();
  flowersPanel();
}
function flowersPanel(){
  advSetPanel({
    stepNo:'自由創作 · 已插入 ' + flowers.placed.length + ' 枝 · 不計分',
    text:'揀花材，插入花瓶',
    goal: flowers.msg || '慢慢揀、慢慢插，做一個屬於你的花束。',
    metric:'完成後可以寫上名字、簽名，下載作品 PNG 留念。',
    pct: Math.min(1, flowers.placed.length / 8),
    buttons:[
      { label:'↻ 旋轉', onClick:()=> flowersAdjust('rot') },
      { label:'＋ 放大', onClick:()=> flowersAdjust('big') },
      { label:'－ 縮小', onClick:()=> flowersAdjust('small') },
      { label:'復原', onClick:()=> flowersUndo() },
      { label:'清除', warn:true, onClick:()=> { flowers.placed = []; flowers.sel = -1; flowersPanel(); } },
      { label:'完成作品 ▶', solid:true, onClick:()=> flowersFinish() },
    ],
  });
}
function flowersAdjust(what){
  if(flowers.sel < 0 || !flowers.placed[flowers.sel]){
    flowers.msg = '先插一枝花，再調整。'; flowersPanel(); return;
  }
  const p = flowers.placed[flowers.sel];
  if(what === 'rot') p.rot += 0.16;
  if(what === 'big') p.scale = Math.min(2.0, p.scale * 1.12);
  if(what === 'small') p.scale = Math.max(0.5, p.scale / 1.12);
  flowers.msg = '已調整最後一枝（' + p.name + '）。';
  flowersPanel();
}
function flowersUndo(){
  if(!flowers.placed.length){ flowers.msg = '未有花可以復原。'; flowersPanel(); return; }
  flowers.placed.pop();
  flowers.sel = flowers.placed.length - 1;
  flowers.msg = '已復原一枝。';
  flowersPanel();
}
function flowersUpdate(){
  const L = flowers.layout || (flowersSetup(), flowers.layout);
  const items = flowers.palette;
  const zones = [{ id:'canvas', x:gameCanvas.width/2, y:gameCanvas.height/2,
                   w:gameCanvas.width, h:gameCanvas.height }];
  const ev = carrier.poll(items, zones);
  if(ev.grab){
    const p = flowers.palette.find(x=>x.id === ev.grab);
    flowers.msg = '拿住' + (p ? p.name : '花') + '，移到花瓶上放下。';
    flowersPanel();
  }
  if(ev.drop){
    const p = flowers.palette.find(x=>x.id === ev.drop);
    if(p){
      const vase = L.vase;
      const dx = Math.max(-1, Math.min(1, (cursorX - vase.x) / (vase.w*0.7)));
      const inVase = Math.abs(cursorX - vase.x) < vase.w*1.1 &&
                     cursorY > vase.y - vase.h*2.2;
      const item = {
        id:'f' + (flowers.idSeq++), kind:p.kind, name:p.name,
        x: inVase ? vase.x + dx * vase.w*0.30 : cursorX,
        y: inVase ? vase.y - vase.h*0.34 : cursorY,
        rot: dx * 0.34, scale: 1.0, size: L.size * 2.0,
      };
      flowers.placed.push(item);
      flowers.sel = flowers.placed.length - 1;
      rewardSmall({
        achievement:'已插入 ' + p.name,
        detail:'花束現有 ' + flowers.placed.length + ' 枝',
        progressLabel: flowers.placed.length < 3
          ? '再插 ' + (3 - flowers.placed.length) + ' 枝就可以完成作品'
          : '隨時可以按「完成作品」寫名留念',
        x:item.x, y:item.y,
        tts: flowers.placed.length % 2 === 0 ? nextEncourage() : false,
      });
      flowers.msg = '';
      flowersPanel();
    }
  }
}
function drawVaseScene(ctx, L, opts){
  const o = opts || {};
  const vase = L.vase;
  // 花枝（先畫後面的）
  flowers.placed.forEach((p, i)=>{
    drawSpriteBottom(ctx, advImg(p.kind), p.x, p.y, p.size * p.scale, p.rot,
      o.alpha != null ? o.alpha : 1);
    if(!o.noSel && i === flowers.sel){
      ctx.save();
      ctx.strokeStyle = '#E07B39'; ctx.lineWidth = 3;
      ctx.setLineDash([6,5]);
      ctx.beginPath(); ctx.arc(p.x, p.y - p.size*p.scale*0.2, p.size*p.scale*0.3, 0, Math.PI*2);
      ctx.stroke(); ctx.restore();
    }
  });
  drawSprite(ctx, advImg('vase'), vase.x, vase.y, vase.h, { shadow:true });
  if(o.name){
    ctx.save();
    ctx.font = 'bold ' + Math.round(vase.h*0.14) + 'px "PingFang TC","Noto Sans TC",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(20,60,50,0.86)';
    ctx.fillText(o.name, vase.x, vase.y + vase.h*0.12);
    ctx.restore();
  }
}
function flowersRender(ctx){
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const L = flowers.layout || (flowersSetup(), flowers.layout);
  ctx.save();
  const g0 = ctx.createLinearGradient(0, ch*0.28, 0, ch);
  g0.addColorStop(0, 'rgba(255,255,255,0.66)');
  g0.addColorStop(1, 'rgba(232,226,214,0.94)');
  ctx.fillStyle = g0;
  rrPath(ctx, 8, ch*0.28, cw-16, ch*0.70, 20); ctx.fill();
  ctx.restore();

  // 花材架
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  const pw = (flowers.palette[1] ? Math.abs(flowers.palette[1].x - flowers.palette[0].x) : 0);
  rrPath(ctx, 8, ch*0.30, (pw ? pw + L.size*1.0 : L.size*1.2), ch*0.66, 16);
  ctx.fill(); ctx.restore();

  const hover = carrier.hoverId;
  for(const p of flowers.palette){
    if(hover === p.id && carrier.heldId !== p.id){
      ctx.save();
      ctx.fillStyle = 'rgba(224,123,57,0.30)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r*1.3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    drawSprite(ctx, advImg(p.kind), p.x, p.y, p.size);
  }

  drawVaseScene(ctx, L, { name: flowers.name });

  // 正在搬運的花
  if(carrier.heldId){
    const p = flowers.palette.find(x=>x.id === carrier.heldId);
    if(p) drawSprite(ctx, advImg(p.kind), cursorX, cursorY, p.size*1.15, { alpha:0.92, shadow:true });
  }

  ctx.save();
  ctx.fillStyle = '#12564a';
  ctx.font = 'bold 15px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('花瓶', L.vase.x, L.vase.y - L.vase.h*0.58);
  ctx.restore();

  advDrawCursor(ctx, carrier.pct);
}

/* ---------- 留念畫面（打名 / 簽名 / 下載 PNG） ---------- */
let ksBound = false;
function flowersFinish(){
  const d = buildAdvDom();
  d.keep.classList.add('show');
  bindKeepsake();
  ksRedraw();
  playApplause();
  speakCantonese('作品完成。可以寫上你的名字，然後下載留念。' + nextEncourage());
}
function bindKeepsake(){
  if(ksBound) return;
  ksBound = true;
  const nameEl = document.getElementById('ksName');
  const sig = document.getElementById('ksSig');
  nameEl.addEventListener('input', ()=>{ flowers.name = nameEl.value.slice(0,12); ksRedraw(); });
  let drawing = false, cur = null;
  const pos = (e)=>{
    const r = sig.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    return { x:(p.clientX - r.left) * sig.width / r.width,
             y:(p.clientY - r.top)  * sig.height / r.height };
  };
  const start = (e)=>{ e.preventDefault(); drawing = true; cur = [pos(e)]; flowers.sigStrokes.push(cur); ksRedraw(); };
  const move  = (e)=>{ if(!drawing) return; e.preventDefault(); cur.push(pos(e)); ksRedraw(); };
  const end   = ()=>{ drawing = false; cur = null; };
  sig.addEventListener('pointerdown', start);
  sig.addEventListener('pointermove', move);
  sig.addEventListener('pointerup', end);
  sig.addEventListener('pointerleave', end);
  document.getElementById('ksSigClear').addEventListener('click', (e)=>{
    e.stopPropagation(); flowers.sigStrokes = []; ksRedraw();
  });
  document.getElementById('ksDownload').addEventListener('click', (e)=>{
    e.stopPropagation(); ksDownload();
  });
  document.getElementById('ksBack').addEventListener('click', (e)=>{
    e.stopPropagation();
    buildAdvDom().keep.classList.remove('show');
  });
  document.getElementById('ksFinish').addEventListener('click', (e)=>{
    e.stopPropagation();
    buildAdvDom().keep.classList.remove('show');
    endGame();
  });
}
function ksDateStr(){
  const d = new Date();
  return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
}
/* 將花束、名字、簽名、日期、頁腳畫在最終 canvas 上（無需外部截圖服務） */
function drawKeepsake(ctx, W, H){
  ctx.clearRect(0,0,W,H);
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, '#FFFDF8'); g.addColorStop(1, '#EFE9DC');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#1A6B5A'; ctx.lineWidth = 8;
  ctx.strokeRect(24,24,W-48,H-48);

  ctx.fillStyle = '#12564a';
  ctx.font = 'bold 52px "PingFang TC","Noto Sans TC",serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('我的花束作品', W/2, 62);
  ctx.font = '26px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.fillStyle = '#5a5a5a';
  ctx.fillText(ksDateStr(), W/2, 128);

  // 依畫面比例重繪花束
  const L = flowers.layout || { vase:{ x:0, y:0, w:200, h:200 }, size:80 };
  const vaseH = H * 0.30;
  const cx = W/2, cy = H*0.70;
  const sx = vaseH / Math.max(1, L.vase.h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sx, sx);
  ctx.translate(-L.vase.x, -L.vase.y);
  drawVaseScene(ctx, L, { noSel:true });
  ctx.restore();

  // 花瓶上的名字
  if(flowers.name){
    ctx.save();
    ctx.fillStyle = 'rgba(18,86,74,0.92)';
    ctx.font = 'bold ' + Math.round(vaseH*0.16) + 'px "PingFang TC","Noto Sans TC",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(flowers.name, cx, cy + vaseH*0.12);
    ctx.restore();
  }

  // 簽名
  if(flowers.sigStrokes.length){
    ctx.save();
    ctx.strokeStyle = '#243b36'; ctx.lineWidth = 4;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const sw = W * 0.52, sh = H * 0.10;
    const ox = W*0.24, oy = H*0.855;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ox, oy + sh); ctx.lineTo(ox + sw, oy + sh); ctx.stroke();
    ctx.strokeStyle = '#243b36'; ctx.lineWidth = 4;
    flowers.sigStrokes.forEach(st=>{
      ctx.beginPath();
      st.forEach((p, i)=>{
        const x = ox + (p.x / 1000) * sw;
        const y = oy + (p.y / 240) * sh;
        if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.fillStyle = '#7a7a7a';
    ctx.font = '20px "PingFang TC",sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('簽名', ox, oy + sh + 8);
    ctx.restore();
  }

  ctx.fillStyle = '#12564a';
  ctx.font = 'bold 28px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('仁濟上肢復康訓練', W/2, H - 46);
}
function ksRedraw(){
  const cv = document.getElementById('ksPreview');
  if(!cv) return;
  drawKeepsake(cv.getContext('2d'), cv.width, cv.height);
  // 簽名框即時顯示
  const sig = document.getElementById('ksSig');
  if(sig){
    const c = sig.getContext('2d');
    c.clearRect(0,0,sig.width,sig.height);
    c.strokeStyle = '#243b36'; c.lineWidth = 5;
    c.lineJoin = 'round'; c.lineCap = 'round';
    flowers.sigStrokes.forEach(st=>{
      c.beginPath();
      st.forEach((p,i)=>{ i ? c.lineTo(p.x,p.y) : c.moveTo(p.x,p.y); });
      c.stroke();
    });
  }
}
function ksDataURL(){
  const cv = document.getElementById('ksPreview');
  if(!cv) return '';
  drawKeepsake(cv.getContext('2d'), cv.width, cv.height);
  return cv.toDataURL('image/png');
}
function ksDownload(){
  const url = ksDataURL();
  if(!url) return '';
  const a = document.createElement('a');
  a.href = url;
  a.download = '花束作品_' + (flowers.name || '訓練') + '.png';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ a.remove(); }, 500);
  rewardSmall({ achievement:'作品已下載', detail:'PNG 已儲存到裝置',
    x:gameCanvas.width/2, y:gameCanvas.height/2, tts:'作品已經下載。' });
  return url;
}

/* ==================================================================
   共用游標繪製 + 進階活動總調度
   ================================================================== */
function advDrawCursor(ctx, pct){
  if(cursorX < 0 || cursorY < 0 || !handDetected) return;
  ctx.save();
  if(state.gameType === 'grasp'){
    ctx.beginPath(); ctx.arc(cursorX, cursorY, isGrasping ? 28 : 30, 0, Math.PI*2);
    ctx.fillStyle = isGrasping ? 'rgba(224,123,57,0.85)' : 'rgba(255,255,255,0.30)';
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    if(isGrasping){
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px -apple-system,"PingFang TC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✊', cursorX, cursorY);
    }
    if(pct > 0){
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 36, -Math.PI/2, -Math.PI/2 + pct*Math.PI*2);
      ctx.strokeStyle = '#C0392B'; ctx.lineWidth = 5; ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.arc(cursorX, cursorY, 22, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cursorX, cursorY, 18, 0, Math.PI*2);
    ctx.fillStyle = pct > 0 ? '#2E7D52' : '#E07B39'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    if(pct > 0){
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 27, -Math.PI/2, -Math.PI/2 + pct*Math.PI*2);
      ctx.strokeStyle = '#2E7D52'; ctx.lineWidth = 4; ctx.stroke();
    }
  }
  ctx.restore();
}

let advCurrent = null;
let advLastW = 0, advLastH = 0;
let advPoseFrame = 0;

function advInit(){
  buildAdvDom();
  preloadAdvAssets();
  advCurrent = state.theme;
  advLastW = gameCanvas.width; advLastH = gameCanvas.height;
  picker.reset(); carrier.reset();
  fxParticles = []; fxRings = [];
  advSetNote('');
  cook.active = cards.active = laundry.active = flowers.active = mj.active = false;
  document.getElementById('persistentRules').style.display = 'none';
  document.getElementById('statusBar').textContent = '';

  if(advCurrent === 'cooking'){
    cook.active = true; cook.reset();
    cook.layout = cookLayout();
    cook.poseOn = false;
    advSetNote('前臂旋前／旋後為螢幕估算回饋，並非醫學量度。此活動為虛擬煮食練習。');
    if(!state.qaMode){
      ensurePoseLandmarker().then(p=>{
        cook.poseOn = !!p;
        if(!p){
          advSetNote('姿勢追蹤（肩／肘）未能載入，已轉為手部動作練習：追蹤有限，可用「跳過此步」繼續。');
        } else {
          advSetNote('姿勢追蹤已啟用。前臂旋前／旋後為螢幕估算回饋，並非醫學量度。');
        }
        cookRenderPanel();
      });
    }
    cookAnnounce();
  } else if(advCurrent === 'mahjong'){
    mj.active = true; mj.reset(); mjStartRound(0);
  } else if(advCurrent === 'cards'){
    cards.active = true; cards.reset(); cardsNewBoard(false);
  } else if(advCurrent === 'laundry'){
    laundry.active = true; laundry.reset(); laundrySetup();
  } else if(advCurrent === 'flowers'){
    flowers.active = true; flowers.reset(); flowersSetup();
  }
}

function advTeardown(){
  const d = buildAdvDom();
  d.panel.style.display = 'none';
  d.note.style.display = 'none';
  d.reward.classList.remove('show');
  d.keep.classList.remove('show');
  cook.active = cards.active = laundry.active = flowers.active = mj.active = false;
  advCurrent = null;
  document.getElementById('persistentRules').style.display = '';
}

function advResizeCheck(){
  if(gameCanvas.width === advLastW && gameCanvas.height === advLastH) return;
  advLastW = gameCanvas.width; advLastH = gameCanvas.height;
  if(advCurrent === 'cooking') cook.layout = cookLayout();
  if(advCurrent === 'mahjong') mj.layout = mjLayout();
  if(advCurrent === 'cards')   cardsNewBoard(false);
  if(advCurrent === 'laundry') laundrySetup();
  if(advCurrent === 'flowers') flowersSetup();
}

function advUpdate(){
  advResizeCheck();
  if(rewardIsOpen()) return;                      // 慶祝畫面期間暫停操作
  if(advDom && advDom.keep.classList.contains('show')) return;
  if(advCurrent === 'cooking'){
    if(!state.qaMode && poseLandmarker && (advPoseFrame++ % 2 === 0)){
      detectPose(document.getElementById('gameVideo'));
    }
    cookDetect();
  }
  else if(advCurrent === 'mahjong') mjUpdate();
  else if(advCurrent === 'cards')   cardsUpdate();
  else if(advCurrent === 'laundry') laundryUpdate();
  else if(advCurrent === 'flowers') flowersUpdate();
}

function advRender(){
  const ctx = gameCtx;
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  if(advCurrent === 'cooking')      cookRender(ctx);
  else if(advCurrent === 'mahjong') mjRender(ctx);
  else if(advCurrent === 'cards')   cardsRender(ctx);
  else if(advCurrent === 'laundry') laundryRender(ctx);
  else if(advCurrent === 'flowers') flowersRender(ctx);
  fxUpdateDraw(ctx);
}

function advTextState(){
  const lines = [];
  lines.push('advGame=' + advCurrent);
  if(advCurrent === 'cooking'){
    const st = cook.step();
    lines.push('cookStep=' + (cook.idx+1) + '/' + COOK_STEPS.length + ' id=' + st.id +
      ' kind=' + st.kind + ' reps=' + cook.reps + '/' + st.need + ' done=' + cook.done);
    lines.push('cookText=' + st.text);
    lines.push('cookMetric=' + cook.metric);
    lines.push('poseOn=' + cook.poseOn + ' poseFailed=' + poseFailed);
  } else if(advCurrent === 'mahjong'){
    lines.push('mjRound=' + mj.roundNo + ' hand=' + mj.hand.length + '/14 need=' + mjNeed());
    lines.push('mjHand=' + mj.hand.join(','));
    lines.push('mjGroups=' + mj.groups.map(g=>g.id + ':' + g.tiles.join('') + (g.gone ? '(used)' : '')).join(' | '));
    lines.push('mjWins=' + mj.wins + ' streak=' + mj.streak + ' fanTotal=' + mj.fanTotal +
      ' tier=' + (mj.bestTier || '-'));
    if(mj.layout) lines.push('mjGroupPos=' + mj.layout.groups
      .map(g=>g.id + '@' + Math.round(g.x) + ',' + Math.round(g.y)).join(' | '));
  } else if(advCurrent === 'cards'){
    lines.push('cardsTier=' + cards.cfg().tier + ' suit=' + cards.suit +
      ' got=' + cards.got + '/' + cards.need + ' rounds=' + cards.rounds + ' combo=' + cards.combo);
    lines.push('cardsField=' + cards.field.filter(c=>!c.gone)
      .map(c=>c.suit + c.rank + '@' + Math.round(c.x) + ',' + Math.round(c.y)).join(' | '));
  } else if(advCurrent === 'laundry'){
    lines.push('laundryTier=' + laundry.tier + ' colors=' + laundry.colors.join(',') +
      ' correct=' + laundry.correct + ' wrong=' + laundry.wrong + ' cue=' + laundry.cueLevel);
    lines.push('garments=' + laundry.garments.filter(g=>!g.gone)
      .map(g=>g.color + g.name + '@' + Math.round(g.x) + ',' + Math.round(g.y)).join(' | '));
    lines.push('baskets=' + laundry.baskets
      .map(b=>b.color + '@' + Math.round(b.x) + ',' + Math.round(b.y)).join(' | '));
    lines.push('held=' + (carrier.heldId || 'none'));
  } else if(advCurrent === 'flowers'){
    lines.push('flowersPlaced=' + flowers.placed.length +
      ' name=' + (flowers.name ? 'set' : 'empty') + ' sigStrokes=' + flowers.sigStrokes.length);
    lines.push('palette=' + flowers.palette
      .map(p=>p.name + '@' + Math.round(p.x) + ',' + Math.round(p.y)).join(' | '));
    if(flowers.layout) lines.push('vase=@' + Math.round(flowers.layout.vase.x) + ',' +
      Math.round(flowers.layout.vase.y));
    lines.push('keepsakeOpen=' + !!(advDom && advDom.keep.classList.contains('show')));
  }
  lines.push('rewardOpen=' + rewardIsOpen());
  if(lastRewardLog.length){
    const r = lastRewardLog[lastRewardLog.length-1];
    lines.push('lastReward=' + r.achievement + ' | ' + r.detail + ' | ' + r.progress);
  }
  return lines;
}

/* 點心（原有配對遊戲）也套用同一套正向回饋 */
function dimsumReward(){
  const nextTier = correctCount < 5 ? 5 : correctCount < 10 ? 10 : correctCount < 15 ? 15 :
                   correctCount < 20 ? 20 : null;
  rewardSmall({
    achievement:'配對成功 ×' + correctCount,
    detail:'得分 ' + score,
    progressLabel: nextTier ? ('再 ' + (nextTier - correctCount) + ' 次到下一階段') : '已達最高階段',
    x: cursorX > 0 ? cursorX : gameCanvas.width/2,
    y: cursorY > 0 ? cursorY : gameCanvas.height/2,
    silent:true,
    tts: correctCount % 5 === 0 ? nextEncourage() : false,
  });
}

/* ==================================================================
   無相機 QA 模擬：以合成手部 / 姿勢 landmarks 真實觸發動作偵測
   （並非病人用功能，只供自動測試及治療師示範）
   ================================================================== */
function qaSyntheticHand(rollDeg, pinch){
  const cx = 0.5, cy = 0.5, a = (rollDeg || 0) * Math.PI / 180;
  const lm = [];
  for(let i=0;i<21;i++) lm.push({ x:cx, y:cy, z:0 });
  lm[0]  = { x:cx, y:cy + 0.10, z:0 };            // 手腕
  lm[9]  = { x:cx, y:cy, z:0 };                   // 中指根
  lm[5]  = { x:cx - 0.06*Math.cos(a), y:cy - 0.06*Math.sin(a), z:0 };  // 食指根
  lm[17] = { x:cx + 0.06*Math.cos(a), y:cy + 0.06*Math.sin(a), z:0 };  // 小指根
  const pd = (pinch == null) ? 1 : pinch;
  lm[4] = { x:cx - 0.02, y:cy - 0.05, z:0 };
  lm[8] = { x:cx - 0.02 + 0.095*pd, y:cy - 0.05, z:0 };
  lastHandLm = lm;
  // 同時設定「前臂垂直」的基準姿勢，令合成的旋轉角等於預期角度
  qaSyntheticPoseVertical();
  return lm;
}
function qaSyntheticPoseVertical(){
  const lm = [];
  for(let i=0;i<33;i++) lm.push({ x:0.5, y:0.5, z:0, visibility:0.05 });
  lm[12] = { x:0.50, y:0.72, visibility:1 };
  lm[14] = { x:0.50, y:0.52, visibility:1 };
  lm[16] = { x:0.50, y:0.32, visibility:1 };
  lastPoseLm = lm;
  return lm;
}
function qaSyntheticPose(elbowDeg){
  const t = (elbowDeg == null ? 170 : elbowDeg) * Math.PI / 180;
  const sh = { x:0.50, y:0.30, visibility:1 };
  const el = { x:0.50, y:0.50, visibility:1 };
  const wr = { x:el.x + 0.20*Math.sin(t), y:el.y - 0.20*Math.cos(t), visibility:1 };
  const lm = [];
  for(let i=0;i<33;i++) lm.push({ x:0.5, y:0.5, z:0, visibility:0.1 });
  lm[12] = sh; lm[14] = el; lm[16] = wr;                     // 右肩 / 右肘 / 右腕
  lm[11] = { x:0.42, y:0.30, visibility:0.05 };
  lm[13] = { x:0.42, y:0.50, visibility:0.05 };
  lm[15] = { x:0.42, y:0.70, visibility:0.05 };
  lastPoseLm = lm;
  return lm;
}
function qaMoveTo(px, py, ms){
  qaHand = qaHand || { nx:0.5, ny:0.5, isGrasping:false };
  qaHand.nx = px / gameCanvas.width;
  qaHand.ny = py / gameCanvas.height;
  dotEmaX = -1; dotEmaY = -1; posHistory = [];
  window.advanceTime(ms || 200);
}
/* 依目前步驟合成相應動作；成功推進步驟則回傳 true */
function cookSimulateStep(){
  const startIdx = cook.idx;
  const st = cook.step();
  const L = cook.layout || cookLayout();
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const cx = cw*0.5, cy = ch*0.5;
  qaHand = { nx:0.5, ny:0.5, isGrasping:false };
  const reps = st.need + 2;
  switch(st.kind){
    case 'grasp':
      for(let i=0;i<reps;i++){
        qaHand.isGrasping = true;  window.advanceTime(140);
        qaHand.isGrasping = false; window.advanceTime(140);
        if(cook.idx !== startIdx) break;
      }
      break;
    case 'circle':
      for(let loop=0; loop<reps && cook.idx === startIdx; loop++){
        for(let k=0;k<14;k++){
          const a = (k/14) * Math.PI*2;
          qaMoveTo(cx + Math.cos(a)*110, cy + Math.sin(a)*110, 60);
        }
      }
      break;
    case 'pronate':
      for(let i=0;i<reps*2 && cook.idx === startIdx; i++){
        qaSyntheticHand(i % 2 === 0 ? 65 : -65);
        window.advanceTime(120);
      }
      break;
    case 'elbow':
      for(let i=0;i<reps && cook.idx === startIdx; i++){
        qaSyntheticPose(55);  window.advanceTime(160);
        qaSyntheticPose(172); window.advanceTime(160);
      }
      break;
    case 'chop':
      qaMoveTo(cx, cy - 120, 200);
      for(let i=0;i<reps && cook.idx === startIdx; i++){
        qaMoveTo(cx, cy + 120, 140);
        qaMoveTo(cx, cy - 120, 140);
      }
      break;
    case 'reachHold':
      qaSyntheticPose(178);
      qaMoveTo(L.wok.x, L.wok.y, 200);
      window.advanceTime(2000);
      break;
    case 'tiltHold':
      qaSyntheticHand(70);
      window.advanceTime(1800);
      break;
    case 'tiltReturn':
      qaSyntheticHand(75); window.advanceTime(400);
      qaSyntheticHand(2);  window.advanceTime(400);
      break;
    case 'shake':
      qaMoveTo(cx, cy, 200);
      for(let i=0;i<reps*2 && cook.idx === startIdx; i++){
        qaMoveTo(cx + (i % 2 === 0 ? 90 : -90), cy, 120);
      }
      break;
    case 'pinchDrop':
      qaMoveTo(L.wok.x, L.wok.y, 240);
      if(state.gameType === 'grasp'){
        qaHand.isGrasping = true;  window.advanceTime(200);
        qaHand.isGrasping = false; window.advanceTime(200);
      } else {
        qaSyntheticHand(0, 0.25); window.advanceTime(200);
        qaSyntheticHand(0, 1.0);  window.advanceTime(200);
      }
      break;
    case 'knobDwell':
      qaMoveTo(L.knob.x, L.knob.y, 240);
      window.advanceTime(1800);
      break;
    case 'scoop':
      for(let i=0;i<reps && cook.idx === startIdx; i++){
        qaMoveTo(L.wok.x, L.wok.y, 200);
        qaMoveTo(L.plate.x, L.plate.y, 200);
      }
      break;
  }
  return cook.idx !== startIdx || cook.done;
}
