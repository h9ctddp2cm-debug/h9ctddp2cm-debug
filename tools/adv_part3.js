/* ==================================================================
   麻雀 = 拼牌挑戰（組合出一手有效和牌）
   每局：一副未完成的牌 + 2–4 組候選牌（可以是順子／刻子／眼），
   病人選組拼出 14 隻的有效和牌；部分局有多條路線、番數不同，
   觀察花色就可以追求更大的糊。
   ⚠ 番數為簡化訓練計分，並非官方規則裁判。
   ================================================================== */

const MJ_WINDS = ['E','S','W','N'];
const MJ_DRAGONS = ['C','F','B'];
function mjIsHonor(t){ return MJ_WINDS.indexOf(t) >= 0 || MJ_DRAGONS.indexOf(t) >= 0; }
function mjSuit(t){ return mjIsHonor(t) ? null : t[0]; }

/* 將 12 隻牌分解成 4 組（順子／刻子）；回傳組合或 null */
function mjDecompose(counts){
  const codes = Object.keys(counts).filter(k=>counts[k] > 0).sort();
  if(!codes.length) return [];
  const c = codes[0];
  if(counts[c] >= 3){
    counts[c] -= 3;
    const r = mjDecompose(counts);
    counts[c] += 3;
    if(r) return [{ kind:'pung', t:c, tiles:[c,c,c] }].concat(r);
  }
  const su = mjSuit(c);
  if(su){
    const n = parseInt(c.slice(1), 10);
    if(n <= 7){
      const b = su + (n+1), d = su + (n+2);
      if(counts[b] > 0 && counts[d] > 0){
        counts[c]--; counts[b]--; counts[d]--;
        const r = mjDecompose(counts);
        counts[c]++; counts[b]++; counts[d]++;
        if(r) return [{ kind:'chow', t:c, tiles:[c,b,d] }].concat(r);
      }
    }
  }
  return null;
}

/* 簡化番數表（訓練用） */
const MJ_FAN_CAP = 13;
function mjScoreCombo(sets, pair){
  const tiles = [];
  sets.forEach(s=> tiles.push.apply(tiles, s.tiles));
  tiles.push(pair, pair);
  const suits = {};
  let honors = 0;
  tiles.forEach(t=>{ const s = mjSuit(t); if(s) suits[s] = 1; else honors++; });
  const suitCount = Object.keys(suits).length;
  const allPungs = sets.every(s=>s.kind === 'pung');
  const allChows = sets.every(s=>s.kind === 'chow');
  const dragonPungs = sets.filter(s=>s.kind === 'pung' && MJ_DRAGONS.indexOf(s.t) >= 0).length;
  const windPungs   = sets.filter(s=>s.kind === 'pung' && MJ_WINDS.indexOf(s.t) >= 0).length;
  const pairIsDragon = MJ_DRAGONS.indexOf(pair) >= 0;
  const pairIsWind = MJ_WINDS.indexOf(pair) >= 0;

  const names = [];
  let fan = 0;
  const add = (n, f)=>{ names.push(n + ' ' + f + '番'); fan += f; };

  if(suitCount === 0) add('字一色', 10);
  else if(suitCount === 1 && honors === 0) add('清一色', 7);
  else if(suitCount === 1 && honors > 0) add('混一色', 3);

  if(dragonPungs === 3) add('大三元', 10);
  else if(dragonPungs === 2 && pairIsDragon) add('小三元', 5);

  if(windPungs === 4) add('大四喜', 10);
  else if(windPungs === 3 && pairIsWind) add('小四喜', 6);

  if(allPungs) add('對對糊', 3);
  else if(allChows) add('平糊', 1);

  if(!names.length){ names.push('雞糊 1番'); fan = 1; }
  const raw = fan;
  const capped = Math.min(fan, MJ_FAN_CAP);
  return { names, fan:capped, raw, capped: raw > capped, sets, pair };
}

/* 檢查 14 隻牌是否有效和牌，並取最高番數組合 */
function mjEvaluate(tiles){
  if(!tiles || tiles.length !== 14) return null;
  const counts = {};
  tiles.forEach(t=> counts[t] = (counts[t] || 0) + 1);
  for(const k of Object.keys(counts)) if(counts[k] > 4) return null;
  let best = null;
  for(const k of Object.keys(counts)){
    if(counts[k] < 2) continue;
    const c2 = Object.assign({}, counts);
    c2[k] -= 2;
    const sets = mjDecompose(c2);
    if(sets && sets.length === 4){
      const sc = mjScoreCombo(sets, k);
      if(!best || sc.fan > best.fan) best = sc;
    }
  }
  return best;
}
function mjTier(fan){
  if(fan >= 10) return { key:'limit', label:'上限糊', color:'#8E2419' };
  if(fan >= 5)  return { key:'big',   label:'大糊',   color:'#C0392B' };
  if(fan >= 3)  return { key:'mid',   label:'中糊',   color:'#E07B39' };
  return          { key:'small', label:'細糊',   color:'#1A6B5A' };
}

/* 局定義：base（未完成的牌）+ 候選組（2–4 組）
   同一 excl 標籤的組互相排斥（同一款牌供應有限），選了一組另一組即撤下。*/
const MJ_ROUNDS = [
  { id:1, hint:'留意花色：全部同花色可以做大糊。',
    base:['s1','s2','s3','s4','s5','s6','s7','s7','s7','s9','s9'],
    groups:[ { tiles:['s2','s3','s4'] }, { tiles:['E','E','E'] }, { tiles:['p4','p5','p6'] } ] },
  { id:2, hint:'手上已經有筒子同字牌，選乜嘢可以保持一色？',
    base:['p1','p2','p3','p4','p5','p6','C','C','C','F','F'],
    groups:[ { tiles:['p7','p8','p9'] }, { tiles:['w1','w2','w3'] }, { tiles:['S','S','S'] } ] },
  { id:3, hint:'手上三副刻子：再加一副刻子＋一對眼，就係對對糊。',
    base:['p3','p3','p3','s5','s5','s5','w7','w7','w7'],
    groups:[ { tiles:['E','E','E'] }, { tiles:['p1','p2','p3'] },
             { tiles:['p9','p9'] }, { tiles:['F','F'] } ] },
  { id:4, hint:'中、發已成刻子；眼揀白板就湊成三元。',
    base:['C','C','C','F','F','F','s2','s3','s4','p5','p6','p7'],
    groups:[ { tiles:['B','B'] }, { tiles:['p9','p9'] } ] },
  { id:5, hint:'中發白齊全；如果全部都係字牌，仲會大好多。',
    base:['C','C','C','F','F','F','B','B','B'],
    groups:[ { tiles:['E','E','E'] }, { tiles:['p2','p3','p4'] },
             { tiles:['S','S'] }, { tiles:['w9','w9'] } ] },
  { id:6, hint:'東南西已成刻子；北風做刻子定做眼，分別好大。',
    base:['E','E','E','S','S','S','W','W','W'],
    groups:[ { tiles:['N','N','N'], excl:'N' }, { tiles:['N','N'], excl:'N' },
             { tiles:['p1','p2','p3'] }, { tiles:['p5','p5'] } ] },
  { id:7, hint:'全部筒子刻子；眼揀筒子就一色到底。',
    base:['p2','p2','p2','p6','p6','p6','p8','p8','p8'],
    groups:[ { tiles:['p4','p4','p4'] }, { tiles:['E','E','E'] },
             { tiles:['p9','p9'] }, { tiles:['C','C'] } ] },
  { id:8, hint:'全部萬子順子；加字牌就變混一色，加萬子就清一色。',
    base:['w2','w3','w4','w5','w6','w7','w7','w8','w9'],
    groups:[ { tiles:['w1','w2','w3'] }, { tiles:['C','C','C'] },
             { tiles:['w5','w5'] }, { tiles:['F','F'] } ] },
];

const mj = {
  active:false, roundNo:0, def:null, hand:[], groups:[], taken:[],
  wins:0, streak:0, bestStreak:0, fanTotal:0, bestTier:'', msg:'', hint:'',
  layout:null, seed:1,
  reset(){
    this.roundNo = 0; this.hand = []; this.groups = []; this.taken = [];
    this.wins = 0; this.streak = 0; this.bestStreak = 0; this.fanTotal = 0;
    this.bestTier = ''; this.msg = ''; this.seed = 1;
  },
};
/* 決定性偽隨機（每局排列不同但可重現） */
function mjRand(){ mj.seed = (mj.seed * 1103515245 + 12345) & 0x7fffffff; return mj.seed / 0x7fffffff; }

function mjStartRound(idx){
  mj.roundNo++;
  const def = MJ_ROUNDS[(idx != null ? idx : (mj.roundNo - 1)) % MJ_ROUNDS.length];
  mj.def = def;
  mj.hand = def.base.slice();
  mj.taken = [];
  mj.seed = 1000 + mj.roundNo * 7919;
  const gs = def.groups.map((g, i)=>({
    id:'g' + i, tiles:g.tiles.slice(), excl:g.excl || null, gone:false, wrong:false,
  }));
  // 決定性洗牌，令每局排列有變化
  for(let i = gs.length - 1; i > 0; i--){
    const j = Math.floor(mjRand() * (i + 1));
    const t = gs[i]; gs[i] = gs[j]; gs[j] = t;
  }
  mj.groups = gs;
  mj.msg = '';
  mj.hint = def.hint;
  picker.reset();
  mjPanel();
  speakCantonese('新一局。手上有 ' + mj.hand.length + ' 隻牌，仲需要 ' + (14 - mj.hand.length) +
    ' 隻。睇清楚，揀一組牌拼出和牌。');
}

function mjNeed(){ return 14 - mj.hand.length; }

function mjPanel(){
  const nextTierFan = mj.fanTotal < 3 ? 3 : mj.fanTotal < 5 ? 5 : mj.fanTotal < 10 ? 10 : null;
  advSetPanel({
    stepNo:'第 ' + mj.roundNo + ' 局 · 拼牌挑戰 · 累積 ' + mj.fanTotal + ' 番',
    text:'仲需要 ' + mjNeed() + ' 隻牌',
    goal: mj.msg || mj.hint,
    metric:'番數為簡化訓練計分，並非官方規則裁判。' +
      (nextTierFan ? '　下一個目標：累積 ' + nextTierFan + ' 番' : '　已達上限級別'),
    pct: 1 - mjNeed() / Math.max(1, (14 - mj.def.base.length)),
    buttons:[
      { label:'🔊 讀出提示', onClick:()=> speakCantonese(mj.hint) },
      { label:'退回上一組', onClick:()=> mjUndo() },
      { label:'換一局', warn:true, onClick:()=> mjStartRound() },
    ],
  });
}

function mjUndo(){
  if(!mj.taken.length){ mj.msg = '未有選過牌。'; mjPanel(); return; }
  const last = mj.taken.pop();
  const g = mj.groups.find(x=>x.id === last);
  if(g){
    g.gone = false;
    if(g.excl) mj.groups.forEach(o=>{ if(o.excl === g.excl) o.gone = false; });
    g.tiles.forEach(t=>{
      const i = mj.hand.lastIndexOf(t);
      if(i >= 0) mj.hand.splice(i, 1);
    });
  }
  mj.msg = '已退回。可以再揀。';
  mjPanel();
}

function mjPick(groupId){
  const g = mj.groups.find(x=>x.id === groupId);
  if(!g || g.gone) return;
  if(mj.hand.length + g.tiles.length > 14){
    mj.msg = '呢組會超過 14 隻牌，揀細一組。';
    playWrongSound(); mjPanel(); return;
  }
  g.gone = true;
  mj.taken.push(g.id);
  if(g.excl) mj.groups.forEach(o=>{ if(o !== g && o.excl === g.excl) o.gone = true; });
  mj.hand = mj.hand.concat(g.tiles);
  playCorrectSound();
  if(mj.hand.length < 14){
    mj.msg = '好，仲需要 ' + mjNeed() + ' 隻。';
    mjPanel();
    return;
  }
  const res = mjEvaluate(mj.hand);
  if(!res){
    // 保護：退回最後一組，不扣分
    mj.msg = '呢個組合未能和牌，已自動退回，換另一組試。';
    playWrongSound();
    triggerFeedback(false);
    mjUndo();
    return;
  }
  mjWinRound(res);
}

function mjOtherRoutes(res){
  // 列出本局其他有效路線（供教學：原來可以做更大）
  const base = mj.def.base;
  const groups = mj.def.groups;
  const need = 14 - base.length;
  const out = [];
  const walk = (i, chosen, size, exclUsed)=>{
    if(size === need){
      const tiles = base.slice();
      chosen.forEach(g=> tiles.push.apply(tiles, g.tiles));
      const r = mjEvaluate(tiles);
      if(r) out.push({ groups:chosen.slice(), res:r });
      return;
    }
    if(i >= groups.length || size > need) return;
    const g = groups[i];
    if(size + g.tiles.length <= need && !(g.excl && exclUsed[g.excl])){
      const e2 = Object.assign({}, exclUsed);
      if(g.excl) e2[g.excl] = 1;
      walk(i+1, chosen.concat([g]), size + g.tiles.length, e2);
    }
    walk(i+1, chosen, size, exclUsed);
  };
  walk(0, [], 0, {});
  const cur = res.fan;
  const better = out.filter(o=>o.res.fan > cur)
    .sort((a,b)=>b.res.fan - a.res.fan)[0];
  return { all:out, better };
}

function mjWinRound(res){
  const tier = mjTier(res.fan);
  mj.wins++; mj.streak++;
  if(mj.streak > mj.bestStreak) mj.bestStreak = mj.streak;
  mj.fanTotal += res.fan;
  mj.bestTier = tier.label;
  score += res.fan * 10;
  correctCount++; grabCount++;
  updateHUD();

  const routes = mjOtherRoutes(res);
  let detail = '<b>' + res.names.join(' + ') + '</b>　共 ' + res.fan + ' 番' +
    (res.capped ? '（已封頂 ' + MJ_FAN_CAP + ' 番）' : '');
  detail += '<br>連勝 ' + mj.streak + ' 局 · 累積 ' + mj.fanTotal + ' 番';
  if(routes.better){
    detail += '<br><small>觀察一下：如果揀 ' +
      routes.better.groups.map(g=>g.tiles.map(mjLabel).join('')).join(' + ') +
      '，可以做到 ' + routes.better.res.names.join(' + ') + '（' + routes.better.res.fan + ' 番）。</small>';
  }
  detail += '<br><small>番數為簡化訓練計分，並非官方規則裁判。</small>';

  const nextTierFan = mj.fanTotal < 3 ? 3 : mj.fanTotal < 5 ? 5 : mj.fanTotal < 10 ? 10 : null;
  rewardBig({
    tier: tier.label + ' · ' + res.fan + ' 番',
    title:'和牌！',
    sub: res.names.join('　'),
    detail,
    progressLabel: nextTierFan
      ? '累積 ' + mj.fanTotal + ' 番 → 下一個目標 ' + nextTierFan + ' 番'
      : '累積 ' + mj.fanTotal + ' 番 · 已達最高級別',
    progressPct: nextTierFan ? mj.fanTotal / nextTierFan : 1,
    canvasH: 250,
    draw:(c,w,h)=> mjDrawWinHand(c, w, h, res),
    tts:'和牌！' + res.names.join('，') + '，' + res.fan + '番。' + nextEncourage(),
    continueLabel:'再嚟一局 ▶',
    onContinue:()=> mjStartRound(),
  });
}

/* 和牌畫面：按組顯示（參考綠檯 + 組別括號） */
function mjDrawWinHand(c, w, h, res){
  c.fillStyle = '#2F7A4F'; c.fillRect(0,0,w,h);
  c.fillStyle = 'rgba(255,255,255,0.08)';
  rrPath(c, 12, 12, w-24, h-24, 14); c.fill();
  const groups = res.sets.map(s=>s.tiles).concat([[res.pair, res.pair]]);
  const totalTiles = 14;
  const gapG = 14;
  const tileW = Math.min(58, (w - 40 - gapG * groups.length) / totalTiles);
  const th = tileW * MJ_ATLAS.ch / MJ_ATLAS.cw;
  let totalW = gapG * (groups.length - 1);
  groups.forEach(g=> totalW += g.length * (tileW + 2));
  let x = (w - totalW) / 2;
  const y = h * 0.52;
  groups.forEach((g, gi)=>{
    const gx0 = x;
    g.forEach(t=>{
      drawTile(c, t, x + tileW/2, y, tileW);
      x += tileW + 2;
    });
    const gx1 = x - 2;
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(gx0, y - th/2 - 12); c.lineTo(gx0, y - th/2 - 18);
    c.lineTo(gx1, y - th/2 - 18); c.lineTo(gx1, y - th/2 - 12);
    c.stroke();
    c.fillStyle = '#EAF7EF';
    c.font = 'bold 13px "PingFang TC","Noto Sans TC",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    const label = gi === groups.length - 1 ? '眼'
      : (res.sets[gi].kind === 'pung' ? '刻子' : '順子');
    c.fillText(label, (gx0 + gx1)/2, y - th/2 - 22);
    x += gapG;
  });
  c.fillStyle = '#fff';
  c.font = 'bold 18px "PingFang TC","Noto Sans TC",sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillText(res.names.join(' + ') + '　' + res.fan + '番', w/2, y + th/2 + 16);
}

/* ---------- 麻雀場景排版 / 繪製 ---------- */
function mjLayout(){
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const narrow = cw < 700;
  const handRows = narrow ? 2 : 1;
  const tileW = Math.max(30, Math.min(narrow ? 52 : 62, (cw - 40) / (14 / handRows) - 4));
  const th = tileW * MJ_ATLAS.ch / MJ_ATLAS.cw;
  const handTop = ch * (narrow ? 0.40 : 0.36);
  const groups = mj.groups.map((g, i)=>{
    const n = mj.groups.length;
    const gw = Math.min(cw / n - 16, tileW * 3.4 + 26);
    const gx = cw * ((i + 0.5) / n);
    const gy = ch * (narrow ? 0.76 : 0.74);
    return { id:g.id, x:gx, y:gy, w:gw, h:th * 1.6,
             r: Math.max(gw, th*1.6) * 0.5, ref:g };
  });
  return { tileW, th, handTop, handRows, groups, narrow };
}

function mjRender(ctx){
  const cw = gameCanvas.width, ch = gameCanvas.height;
  const L = mj.layout = mjLayout();

  // 綠檯背景（半透明，仍見得到鏡頭畫面）
  ctx.save();
  ctx.fillStyle = 'rgba(47,122,79,0.86)';
  rrPath(ctx, 8, ch*0.30, cw-16, ch*0.66, 20); ctx.fill();
  ctx.restore();

  // 手牌
  ctx.save();
  ctx.fillStyle = '#EAF7EF';
  ctx.font = 'bold 15px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('你的牌（' + mj.hand.length + ' / 14）', 20, L.handTop - L.th*0.72);
  ctx.restore();

  const per = Math.ceil(mj.hand.length / L.handRows) || 1;
  mj.hand.forEach((t, i)=>{
    const row = Math.floor(i / per), col = i % per;
    const rowCount = Math.min(per, mj.hand.length - row * per);
    const totalW = rowCount * (L.tileW + 3);
    const x0 = (cw - totalW) / 2;
    const isNew = i >= mj.def.base.length;
    drawTile(ctx, t, x0 + col * (L.tileW + 3) + L.tileW/2,
      L.handTop + row * (L.th + 8), L.tileW);
    if(isNew){
      ctx.save();
      ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 3;
      rrPath(ctx, x0 + col*(L.tileW+3), L.handTop + row*(L.th+8) - L.th/2,
        L.tileW, L.th, L.tileW*0.14);
      ctx.stroke(); ctx.restore();
    }
  });

  // 候選組
  ctx.save();
  ctx.fillStyle = '#EAF7EF';
  ctx.font = 'bold 15px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('揀一組牌（' + mj.groups.filter(g=>!g.gone).length + ' 個選擇）',
    cw/2, L.groups.length ? L.groups[0].y - L.th - 6 : ch*0.6);
  ctx.restore();

  const hover = picker.hoverId;
  L.groups.forEach((g, gi)=>{
    const gone = g.ref.gone;
    ctx.save();
    ctx.globalAlpha = gone ? 0.28 : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    rrPath(ctx, g.x - g.w/2, g.y - g.h/2, g.w, g.h, 16); ctx.fill();
    ctx.lineWidth = hover === g.id && !gone ? 8 : 4;
    ctx.strokeStyle = hover === g.id && !gone ? '#E07B39' : '#1A6B5A';
    rrPath(ctx, g.x - g.w/2, g.y - g.h/2, g.w, g.h, 16); ctx.stroke();
    const n = g.ref.tiles.length;
    const tw = Math.min(L.tileW, (g.w - 22) / n - 3);
    const tot = n * (tw + 3);
    let tx = g.x - tot/2 + tw/2;
    g.ref.tiles.forEach(t=>{ drawTile(ctx, t, tx, g.y - 6, tw); tx += tw + 3; });
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 14px "PingFang TC","Noto Sans TC",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(g.ref.tiles.map(mjLabel).join('·'), g.x, g.y + g.h/2 - 22);
    if(gone){
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = 'bold 16px "PingFang TC",sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('已用', g.x, g.y);
    }
    ctx.restore();
  });

  // 分數列
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  rrPath(ctx, 12, ch*0.31, 250, 34, 12); ctx.fill();
  ctx.fillStyle = '#12564a';
  ctx.font = 'bold 15px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('和牌 ' + mj.wins + ' · 連勝 ' + mj.streak + ' · 累積 ' + mj.fanTotal + ' 番',
    22, ch*0.31 + 17);
  ctx.restore();

  advDrawCursor(ctx, picker.pct);
}

function mjUpdate(){
  const L = mj.layout || mjLayout();
  const items = L.groups.filter(g=>!g.ref.gone)
    .map(g=>({ id:g.id, x:g.x, y:g.y, r:Math.max(g.w, g.h)*0.5, gone:false }));
  const hit = picker.poll(items);
  if(hit) mjPick(hit);
}
