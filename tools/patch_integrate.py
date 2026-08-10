#!/usr/bin/env python3
"""Integrate the advanced game modules into dimsum_project/index.html.

Applies exact-string edits (apply_patch is unavailable in this sandbox) and
inserts tools/adv_part{1..4}.js plus QA hooks inside the existing IIFE.
"""
import io, os, sys, re

ROOT = "/home/user/workspace/dimsum_project"
HTML = os.path.join(ROOT, "index.html")
src = io.open(HTML, encoding="utf-8").read()
orig = src


def sub(old, new, count=1, label=""):
    global src
    n = src.count(old)
    if n < count:
        print("!! NOT FOUND (%s): %r" % (label, old[:80]))
        sys.exit(1)
    src = src.replace(old, new, count)
    print("ok  %-34s (%d occurrence%s)" % (label, count, "" if count == 1 else "s"))


# ---------------------------------------------------------------- 1. modules
parts = "".join(io.open(os.path.join(ROOT, "tools", "adv_part%d.js" % i),
                        encoding="utf-8").read() + "\n"
                for i in (1, 2, 3, 4))

QA_ANCHOR = "/* ==================== QA / 自動測試 hooks（deterministic） ==================== */"
sub(QA_ANCHOR, parts + "\n" + QA_ANCHOR, 1, "insert adv modules")

# ------------------------------------------------- 2. keep last hand landmarks
sub("""let handDetected = false;
let gripActive = false;""",
    """let handDetected = false;
let lastHandLm = null;   // 最近一次手部 21 點（供煮飯動作估算 / QA 模擬）
let gripActive = false;""",
    1, "lastHandLm decl")

sub("""    handDetected = true;
    detectionHeldGrace = false;
    lastDetectedAt = now;""",
    """    handDetected = true;
    detectionHeldGrace = false;
    lastDetectedAt = now;
    if(res.lm) lastHandLm = res.lm;""",
    1, "capture hand landmarks")

sub("""    handDetected = false;
    detectionHeldGrace = false;
    cursorX = -1; cursorY = -1;""",
    """    handDetected = false;
    detectionHeldGrace = false;
    if(!state.qaMode) lastHandLm = null;
    cursorX = -1; cursorY = -1;""",
    1, "clear hand landmarks")

# ------------------------------------------------------- 3. initGame branching
sub("""  resizeGameCanvas();
  setupTargets();
  spawnInitialFoods();""",
    """  resizeGameCanvas();
  if(isAdvTheme()){
    // 進階活動（麻雀 / 啤牌 / 煮飯 / 插花 / 收衫）有各自的玩法模組
    advInit();
  } else {
    setupTargets();
    spawnInitialFoods();
  }""",
    1, "initGame branch")

sub("""  // 遊戲開始：顯示 tier 0 規則 banner
  showLevelUpBanner();""",
    """  // 遊戲開始：顯示 tier 0 規則 banner（進階活動有自己的引導面板）
  if(!isAdvTheme()) showLevelUpBanner();""",
    1, "skip level banner for adv")

# ---------------------------------------------------------- 4. gameLoop branch
sub("""  if(!state.paused){
    updateTracking();
    updateGameLogic();
    renderGame();
  }
  gameRAF = requestAnimationFrame(gameLoop);""",
    """  if(!state.paused){
    updateTracking();
    if(isAdvTheme()){ advUpdate(); advRender(); }
    else { updateGameLogic(); renderGame(); }
  }
  gameRAF = requestAnimationFrame(gameLoop);""",
    1, "gameLoop branch")

# ------------------------------------------------------- 5. advanceTime branch
sub("""    if(state.running && !state.paused && currentScreen === 'game'){
      updateTracking();
      updateGameLogic();
      renderGame();
    }""",
    """    if(state.running && !state.paused && currentScreen === 'game'){
      updateTracking();
      if(isAdvTheme()){ advUpdate(); advRender(); }
      else { updateGameLogic(); renderGame(); }
    }""",
    1, "advanceTime branch")

# ------------------------------------------------------------ 6. endGame hook
sub("""function endGame(){
  state.running = false;""",
    """function endGame(){
  state.running = false;
  if(isAdvTheme()) advTeardown();""",
    1, "endGame teardown")

# --------------------------------------------- 7. dim sum positive reinforcement
sub("""            showLevelUpBanner();""",
    """            showLevelUpBanner();
            dimsumReward();""",
    2, "dimsum reward")

# ----------------------------------------------------- 8. rules text per theme
sub("""// 根據目前活動（theme）及級別更新規則文字及廣東話內容
function updateRulesForActivity(){
  const th = getTheme();""",
    """/* 進階活動的規則說明（每個活動玩法唔同） */
const ADV_RULES = {
  cooking:{
    lines:[
      '跟住指示，一步一步煮一碟蛋炒飯（共 12 步）',
      '每一步都要做夠指定動作，系統會數次數',
      '治療師可以按「跳過此步」',
    ],
    tail:'手腕／前臂旋轉為螢幕估算回饋，並非醫學量度。',
    tts:'煮飯。跟住指示，一步一步煮一碟蛋炒飯，總共十二步。每一步做夠動作就會自動去下一步。',
  },
  mahjong:{
    lines:[
      '拼牌挑戰：手上有一副未完成的牌',
      '揀一組候選牌，拼成 14 隻的和牌',
      '有時有幾條路線，睇清花色可以做大糊',
    ],
    tail:'番數為簡化訓練計分，並非官方規則裁判。',
    tts:'麻雀拼牌挑戰。手上有一副未完成的牌。揀一組候選牌，拼成十四隻和牌。留意花色，可以做大糊。',
  },
  cards:{
    lines:[
      '睇清楚指定花色（紅心／黑桃／紅磚／梅花）',
      '收集足夠張數同花色的牌就完成一輪',
      '一輪完成會換新花色，之後升級',
    ],
    tail:'揀錯花色會扣分，慢慢睇清楚。',
    tts:'啤牌。睇清楚指定花色，收集足夠張數同花色的牌，就完成一輪。',
  },
  laundry:{
    lines:[
      '拿起衣物，放入相同顏色的衫籃',
      '每件衣物同衫籃都有顏色名稱',
      '做得多會加多顏色同款式',
    ],
    tail:'顏色提示會逐步減弱，但顏色名稱一直保留。',
    tts:'收衫。拿起衣物，放入相同顏色的衫籃。每件衣物同衫籃都有顏色名稱。',
  },
  flowers:{
    lines:[
      '自由創作：揀花材，插入花瓶',
      '可以旋轉、放大、縮小，隨意擺放',
      '完成後可以寫名、簽名，下載作品',
    ],
    tail:'此活動不計分，慢慢享受創作。名字只保留在此頁，不會儲存。',
    tts:'插花。自由創作。揀花材，插入花瓶。可以旋轉、放大、縮小。完成之後可以寫上名字，下載作品。',
  },
};

// 根據目前活動（theme）及級別更新規則文字及廣東話內容
function updateRulesForActivity(){
  const th = getTheme();
  if(isAdvTheme()){
    const r = ADV_RULES[state.theme];
    const verbHint = state.level === '45'
      ? '（Level 4–5：握拳選取／張開放下）'
      : '（Level 6–7：食指瞄準，停留選取）';
    const rulesEl0 = document.getElementById('rulesContent');
    if(rulesEl0){
      rulesEl0.innerHTML =
        `<div style="font-size:22px;font-weight:800;color:#0a7d75;margin-bottom:14px;">${th.title}</div>` +
        r.lines.map((t, i)=>
          `<div style="margin-bottom:14px;"><span style="display:inline-block; width:40px; height:40px; line-height:40px; text-align:center; background:#1a1a1a; color:#fff; border-radius:50%; font-weight:800; margin-right:12px; font-size:22px;">${i+1}</span>${t}</div>`
        ).join('') +
        `<div style="padding-top:14px; margin-top:8px; border-top:1px dashed #d0c9be; color:#5a5a5a; font-size:19px;">${verbHint}<br>${r.tail}<br>慢慢做，唔使急。</div>`;
    }
    window.__CURRENT_RULES_CANTONESE = r.tts + '慢慢來，唔使急。';
    return;
  }""",
    1, "adv rules")

# ------------------------------------------------- 9. activity card描述 update
sub("""    id:'mahjong', title:'麻雀', goal:'打牌配對：把牌放去相同的牌位，練習手眼協調。',
    itemWord:'麻雀牌', difficulty:'難度：易', targetStyle:'panel',""",
    """    id:'mahjong', title:'麻雀 · 拼牌挑戰',
    goal:'睇牌組合：由候選牌組拼出一手有效和牌，有時有幾條路線，可以追求更大番數（簡化訓練計分）。',
    itemWord:'麻雀牌', difficulty:'難度：中 · 認知＋手眼', targetStyle:'panel',""",
    1, "mahjong card text")

sub("""    id:'cards', title:'啤牌', goal:'玩紙牌：把牌分類放去相同花色的牌堆。',
    itemWord:'啤牌', difficulty:'難度：易', targetStyle:'panel',""",
    """    id:'cards', title:'啤牌 · 花色收集',
    goal:'指定一個花色，在牌堆中收集足夠張數；完成一輪換新花色，逐級加牌加限時獎勵。',
    itemWord:'啤牌', difficulty:'難度：易→中 · 選擇性注意', targetStyle:'panel',""",
    1, "cards card text")

sub("""    id:'cooking', title:'煮飯', goal:'廚房備餐：把食材放入正確的鍋具，練習分類。',
    itemWord:'食材', difficulty:'難度：中', targetStyle:'panel',""",
    """    id:'cooking', title:'煮飯 · 蛋炒飯 12 步',
    goal:'一步一步完成一碟蛋炒飯：抓鬆冷飯、打蛋、拌飯、洗蔥、切蔥、熱鍋、落油、倒飯、落鹽、落蔥花、熄火、上碟。',
    itemWord:'食材', difficulty:'難度：中→高 · 肩肘腕動作', targetStyle:'panel',""",
    1, "cooking card text")

sub("""    id:'flowers', title:'插花', goal:'插花擺設：把花插入同一顏色的花瓶，練習顏色配對。',
    itemWord:'花', difficulty:'難度：中', targetStyle:'panel',""",
    """    id:'flowers', title:'插花 · 自由創作',
    goal:'自由揀花材、擺放、旋轉、縮放，插出獨一無二的花束；完成後可寫名簽名，下載作品留念（不計分）。',
    itemWord:'花', difficulty:'難度：最易 · 自由創作', targetStyle:'panel',""",
    1, "flowers card text")

sub("""    id:'laundry', title:'收衫／晾衫', goal:'處理衣物：上衣去晾衫架，襪子放入衫籃。',
    itemWord:'衣物', difficulty:'難度：中', targetStyle:'panel',""",
    """    id:'laundry', title:'收衫 · 顏色分類',
    goal:'把襪、短褲、背心、T恤、外套、長褲放入相同顏色的衫籃；顏色由 2 種逐步加到 4 種。',
    itemWord:'衣物', difficulty:'難度：易→中 · 顏色分類', targetStyle:'panel',""",
    1, "laundry card text")

# -------------------------------------------------------- 10. text state hook
sub("""  if(currentScreen === 'rules'){
    lines.push('rules=' +""",
    """  if((currentScreen === 'game' || currentScreen === 'result') && isAdvTheme() && advCurrent){
    lines.push.apply(lines, advTextState());
  }
  if(currentScreen === 'rules'){
    lines.push('rules=' +""",
    1, "render_game_to_text adv")

# ------------------------------------------------------------- 11. QA additions
QA_TAIL = """  themes(){ return THEME_ORDER.map(id=>({ id, title:THEMES[id].title,
    categories: THEMES[id].categoriesFor(state.level).map(c=>({type:c.type, item:c.itemLabel, target:c.targetLabel})) })); },
};"""
QA_NEW = """  themes(){ return THEME_ORDER.map(id=>({ id, title:THEMES[id].title,
    categories: THEMES[id].categoriesFor(state.level).map(c=>({type:c.type, item:c.itemLabel, target:c.targetLabel})) })); },

  /* ---------- 進階活動 QA hooks（無需相機） ---------- */
  adv:{
    state(){ return advTextState().join('\\n'); },
    game(){ return advCurrent; },
    rewardOpen(){ return rewardIsOpen(); },
    closeReward(){ if(rewardIsOpen()) rewardClose(); return window.render_game_to_text(); },
    // 在畫布座標處完成一次「選取」（依級別用握拳或停留）
    pickAt(px, py){
      qaHand = { nx:px / gameCanvas.width, ny:py / gameCanvas.height, isGrasping:false };
      dotEmaX = -1; dotEmaY = -1; posHistory = [];
      window.advanceTime(320);
      if(state.gameType === 'grasp'){
        qaHand.isGrasping = true;  window.advanceTime(160);
        qaHand.isGrasping = false; window.advanceTime(160);
      } else {
        window.advanceTime(DWELL_MS + 250);
      }
      return true;
    },
    // 由 (fx,fy) 拿起，搬到 (tx,ty) 放下
    carryTo(fx, fy, tx, ty){
      qaHand = { nx:fx / gameCanvas.width, ny:fy / gameCanvas.height, isGrasping:false };
      dotEmaX = -1; dotEmaY = -1; posHistory = [];
      window.advanceTime(320);
      if(state.gameType === 'grasp'){ qaHand.isGrasping = true; window.advanceTime(200); }
      else { window.advanceTime(DWELL_MS + 250); }
      qaHand.nx = tx / gameCanvas.width; qaHand.ny = ty / gameCanvas.height;
      dotEmaX = -1; dotEmaY = -1; posHistory = [];
      window.advanceTime(320);
      if(state.gameType === 'grasp'){ qaHand.isGrasping = false; window.advanceTime(700); }
      else { window.advanceTime(DWELL_MS + 250); }
      return true;
    },
  },
  cook:{
    step(){ const s = cook.step(); return { idx:cook.idx, id:s.id, kind:s.kind,
      text:s.text, need:s.need, reps:cook.reps, done:cook.done, metric:cook.metric,
      poseOn:cook.poseOn, poseFailed:poseFailed }; },
    // 以合成手部／姿勢資料真實觸發動作偵測（無相機模擬）
    simulate(){ return cookSimulateStep(); },
    completeStep(){ cook.reps = cook.step().need; cookAdvance(true); return cook.idx; },
    skip(){ cookAdvance(false); return cook.idx; },
    runAll(useSim){
      const log = [];
      for(let i=0;i<COOK_STEPS.length + 2 && !cook.done;i++){
        const before = cook.idx;
        const st = cook.step();
        let ok = useSim ? cookSimulateStep() : false;
        if(!ok && !cook.done && cook.idx === before){ cook.reps = st.need; cookAdvance(true); }
        log.push((before+1) + ':' + st.id + (ok ? ' sim' : ' forced'));
        if(cook.done) break;
      }
      return log;
    },
    forcePose(on){ if(!on){ poseFailed = true; poseLandmarker = null; cook.poseOn = false; }
      return { poseOn:cook.poseOn, poseFailed:poseFailed }; },
  },
  mj:{
    state(){ return { round:mj.roundNo, hand:mj.hand.slice(), need:mjNeed(),
      groups:mj.groups.map(g=>({ id:g.id, tiles:g.tiles.slice(), gone:g.gone })),
      wins:mj.wins, streak:mj.streak, fanTotal:mj.fanTotal }; },
    pick(idx){ const g = mj.groups.filter(x=>!x.gone)[idx || 0]; if(!g) return null;
      mjPick(g.id); return window.__qa.mj.state(); },
    pickTiles(sig){ const g = mj.groups.find(x=>!x.gone && x.tiles.join('') === sig);
      if(!g) return null; mjPick(g.id); return window.__qa.mj.state(); },
    pickAtGroup(idx){
      const L = mj.layout || mjLayout();
      const vis = L.groups.filter(g=>!g.ref.gone);
      const g = vis[idx || 0]; if(!g) return null;
      window.__qa.adv.pickAt(g.x, g.y);
      return window.__qa.mj.state();
    },
    round(i){ mjStartRound(i); return window.__qa.mj.state(); },
    evaluate(tiles){ return mjEvaluate(tiles); },
    // 驗證所有局定義：每局都要至少一條有效路線，並列出各路線番數
    verifyAll(){
      const out = [];
      MJ_ROUNDS.forEach((def, i)=>{
        const need = 14 - def.base.length;
        const routes = [];
        const walk = (k, chosen, size, excl)=>{
          if(size === need){
            const tiles = def.base.concat.apply(def.base, chosen.map(g=>g.tiles));
            const r = mjEvaluate(tiles);
            routes.push({ groups:chosen.map(g=>g.tiles.join('')),
              valid:!!r, fan:r ? r.fan : 0, names:r ? r.names : [] });
            return;
          }
          if(k >= def.groups.length || size > need) return;
          const g = def.groups[k];
          if(size + g.tiles.length <= need && !(g.excl && excl[g.excl])){
            const e2 = Object.assign({}, excl);
            if(g.excl) e2[g.excl] = 1;
            walk(k+1, chosen.concat([g]), size + g.tiles.length, e2);
          }
          walk(k+1, chosen, size, excl);
        };
        walk(0, [], 0, {});
        const valid = routes.filter(r=>r.valid);
        out.push({ round:def.id, need, totalRoutes:routes.length,
          validRoutes:valid.length, fans:valid.map(v=>v.fan),
          maxFan:valid.reduce((a,b)=>Math.max(a, b.fan), 0),
          distinctFans:Array.from(new Set(valid.map(v=>v.fan))).sort((a,b)=>a-b),
          names:valid.map(v=>v.names.join('+')) });
      });
      return out;
    },
  },
  cards:{
    state(){ return { tier:cards.cfg().tier, suit:cards.suit, got:cards.got,
      need:cards.need, rounds:cards.rounds, combo:cards.combo,
      field:cards.field.filter(c=>!c.gone).map(c=>({ id:c.id, suit:c.suit, rank:c.rank,
        x:Math.round(c.x), y:Math.round(c.y) })) }; },
    pickCorrect(){
      const c = cards.field.find(f=>!f.gone && f.suit === cards.suit);
      if(!c) return null;
      window.__qa.adv.pickAt(c.x, c.y);
      return window.__qa.cards.state();
    },
    pickWrong(){
      const c = cards.field.find(f=>!f.gone && f.suit !== cards.suit);
      if(!c) return null;
      window.__qa.adv.pickAt(c.x, c.y);
      return window.__qa.cards.state();
    },
    clearBoard(){
      let guard = 0;
      while(cards.got < cards.need && guard++ < 12){
        if(!window.__qa.cards.pickCorrect()) break;
      }
      return window.__qa.cards.state();
    },
  },
  laundry:{
    state(){ return { tier:laundry.tier, colors:laundry.colors.slice(),
      correct:laundry.correct, wrong:laundry.wrong, cue:laundry.cueLevel,
      garments:laundry.garments.filter(g=>!g.gone).map(g=>({ id:g.id, color:g.color,
        name:g.name, x:Math.round(g.x), y:Math.round(g.y) })),
      baskets:laundry.baskets.map(b=>({ color:b.color, x:Math.round(b.x), y:Math.round(b.y) })) }; },
    sortOne(wrongOnPurpose){
      const g = laundry.garments.find(x=>!x.gone);
      if(!g) return null;
      const b = wrongOnPurpose
        ? laundry.baskets.find(x=>x.color !== g.color)
        : laundry.baskets.find(x=>x.color === g.color);
      if(!b) return null;
      window.__qa.adv.carryTo(g.x, g.y, b.x, b.y);
      return window.__qa.laundry.state();
    },
    sortMany(n){
      const log = [];
      for(let i=0;i<(n || 4);i++){
        if(rewardIsOpen()) rewardClose();
        const s = window.__qa.laundry.sortOne(false);
        if(!s) break;
        log.push('tier' + s.tier + ' correct' + s.correct);
      }
      return { log, state:window.__qa.laundry.state() };
    },
  },
  flowers:{
    state(){ return { placed:flowers.placed.length, sel:flowers.sel,
      name:flowers.name, sig:flowers.sigStrokes.length,
      palette:flowers.palette.map(p=>({ id:p.id, name:p.name,
        x:Math.round(p.x), y:Math.round(p.y) })),
      vase: flowers.layout ? { x:Math.round(flowers.layout.vase.x),
        y:Math.round(flowers.layout.vase.y) } : null,
      keepsakeOpen: !!(advDom && advDom.keep.classList.contains('show')) }; },
    placeOne(i){
      const p = flowers.palette[i || 0];
      if(!p || !flowers.layout) return null;
      const v = flowers.layout.vase;
      window.__qa.adv.carryTo(p.x, p.y, v.x + ((i || 0) - 3) * 14, v.y - v.h*0.9);
      return window.__qa.flowers.state();
    },
    rotate(){ flowersAdjust('rot'); return window.__qa.flowers.state(); },
    scaleUp(){ flowersAdjust('big'); return window.__qa.flowers.state(); },
    scaleDown(){ flowersAdjust('small'); return window.__qa.flowers.state(); },
    undo(){ flowersUndo(); return window.__qa.flowers.state(); },
    finish(){ flowersFinish(); return window.__qa.flowers.state(); },
    setName(n){ flowers.name = String(n || '').slice(0,12);
      const el = document.getElementById('ksName'); if(el) el.value = flowers.name;
      ksRedraw(); return flowers.name; },
    signStroke(){
      const st = [];
      for(let i=0;i<24;i++) st.push({ x:120 + i*28, y:140 + Math.sin(i/2.2)*44 });
      flowers.sigStrokes.push(st); ksRedraw();
      return flowers.sigStrokes.length;
    },
    exportPNG(){ const url = ksDownload(); return { length:url.length,
      prefix:url.slice(0, 22) }; },
  },
};"""
sub(QA_TAIL, QA_NEW, 1, "QA hooks")

io.open(HTML, "w", encoding="utf-8").write(src)
print("\nwrote %s  (%d -> %d bytes)" % (HTML, len(orig), len(src)))
