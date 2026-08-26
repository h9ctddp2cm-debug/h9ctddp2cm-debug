(function () {
  'use strict';

  const LANG_ZH = 'zh-Hant';
  const LANG_EN = 'en';
  let currentLanguage = LANG_ZH;
  let applying = false;
  let observer = null;
  const OBSERVER_OPTIONS = {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder', 'alt']
  };
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();

  /*
   * Patient- and therapist-facing copy used outside the existing PILOT_TEXT
   * research dictionary. Keep complete phrases here so English reads naturally;
   * the smaller phrase table below handles values assembled at runtime.
   */
  const EN = {
    '仁濟醫院職業治療部':'Yan Chai Hospital Occupational Therapy Department',
    '中風上肢訓練':'Stroke Upper-limb Training',
    '選擇 Level':'Choose a level',
    '必須由職業治療師選擇 FTHUE Level；本網站不作診斷或自動分級':'An occupational therapist must select the FTHUE level. This website does not diagnose or assign a level automatically.',
    '桌面承托訓練':'Supported tabletop training',
    '患臂桌面承托｜由中線向患側外滑，再返回':'Affected arm supported on the table: slide outward from midline, then return',
    '桌面肩水平外展：向外，再返回':'Tabletop shoulder horizontal abduction: outward, then return',
    '試玩':'Trial',
    '訓練':'Training',
    '詳情':'Details',
    '患側前臂放在桌面承托，由中線向患側外滑':'Support the affected forearm on the table and slide from midline toward the affected side.',
    '返回中線後，才開始下一次':'Return to midline before starting the next repetition.',
    '鏡頭只追蹤治療師選定的患側手臂；不會自動判定 FTHUE Level':'The camera tracks only the affected arm selected by the therapist; it does not assign an FTHUE level.',
    '肩屈曲 30–60°':'Shoulder flexion 30–60°',
    '患臂離桌｜個人化主動活動範圍':'Affected arm off the table; personalised active range',
    '主動肩屈曲 30–60°':'Active shoulder flexion 30–60°',
    '患臂離開桌面，每個物件均由 0° 穩定起步':'Keep the affected arm off the table. Every object begins from a stable 0° position.',
    '治療師選擇 30°／40°／50°／60° 目標':'The therapist selects a 30°/40°/50°/60° target.',
    '角度只屬相機訓練估算；FTHUE Level 必須由職業治療師選擇':'Angles are camera estimates for training only; the FTHUE level must be selected by an occupational therapist.',
    '肩屈曲 60° 或以上':'Shoulder flexion 60° or above',
    '患臂離桌｜個人化高位主動活動':'Affected arm off the table; personalised high-range activity',
    '主動肩屈曲 60° 或以上':'Active shoulder flexion 60° or above',
    '慢慢主動抬高手臂至治療師選定的 60° 或以上目標':'Slowly raise the arm actively to the therapist-selected target of 60° or above.',
    '相機不量度抓握或捏力；FTHUE Level 必須由職業治療師選擇':'The camera does not measure grip or pinch force; an occupational therapist must select the FTHUE level.',
    '患手握放練習':'Affected-hand grasp and release',
    '伸手 → 輕握 → 張手':'Reach → gently grasp → open hand',
    '輕握放':'Gentle grasp and release',
    '坐在椅子或輪椅，手臂離開桌面':'Sit in a chair or wheelchair with the arm off the table.',
    '伸出患手 → 輕輕合手 → 張開手':'Reach with the affected hand → gently close → open.',
    '空手模擬，不拿實物':'Practise without holding a real object.',
    '身體保持正中，避免過度側彎':'Keep the trunk centred and avoid excessive side bending.',
    '患手捏放練習':'Affected-hand pinch and release',
    '伸手 → 輕捏 → 張開手指':'Reach → light pinch → open fingers',
    '三種玩法：頭三指輕捏／衫夾／筷子':'Three modes: three-finger pinch, clothes peg, or chopsticks.',
    '伸出患手 → 手指輕捏 → 張開手指':'Reach with the affected hand → lightly pinch → open the fingers.',
    '衫夾':'Clothes peg',
    '筷子':'Chopsticks',
    '研究模式（Pilot Study）':'Research mode (Pilot Study)',
    '訓練由仁濟醫院職業治療師鄧姑娘設計，網頁由 AI 協助製作':'Training designed by Ms Tang, Occupational Therapist, Yan Chai Hospital. Website created with AI assistance.',
    '圖片來源 / Image credits':'Image credits',
    '選擇遊戲':'Choose a game',
    '返回主頁':'Back to home',
    '檯面肩水平外展':'Tabletop shoulder horizontal abduction',
    '患側前臂承托，由中線向患側外滑，再返回中線':'Support the affected forearm and slide from midline toward the affected side, then return.',
    '向患側外滑；返回中線後再開始下一次':'Slide toward the affected side; return to midline before the next repetition.',
    '向患側外滑':'Slide outward to the affected side',
    '好！返回中線':'Good! Return to the centre',
    '患手置中':'Affected hand at centre',
    '準備向外滑':'Get ready to slide outward',
    '荃灣街景':'Tsuen Wan scenes',
    '點心':'Dim sum',
    '抹窗':'Window wiping',
    '保齡':'Bowling',
    '洗麻雀':'Mahjong washing',
    '拍卡':'Tap card',
    '自動輪替':'Auto rotate',
    '按下可顯示／隱藏':'Tap to show or hide',
    '請由職業治療師選擇 FTHUE Level':'Ask an occupational therapist to select the FTHUE level.',
    '動作示範':'Movement demonstration',
    '患側方向':'Affected side',
    '請選擇':'Please select',
    '左患側':'Left affected side',
    '右患側':'Right affected side',
    '訓練方式':'Training method',
    '患臂主動':'Active affected arm',
    '主動':'Active',
    '雙手持 1 磅棍（主動輔助）':'Both hands on a 1 lb stick (active-assisted)',
    '患臂自行抬高｜Lift with affected arm':'Lift with the affected arm',
    '雙手握棍，健手協助｜Hold stick with both hands; unaffected hand assists':'Hold the stick with both hands; the unaffected hand assists',
    '患臂主動肩屈曲｜Active affected-arm shoulder flexion':'Active affected-arm shoulder flexion',
    '雙手持 1 lb 棍主動輔助｜Active-assisted with both hands on a 1 lb stick':'Active-assisted with both hands on a 1 lb stick',
    '雙手持 1 lb 棍':'Both hands with a 1 lb stick',
    '患臂自行抬高':'Raise the affected arm independently.',
    '肩屈曲目標':'Shoulder-flexion target',
    '目標':'Target',
    '治療師詳情':'Therapist details',
    '相機角度只供遊戲控制，並非量角器 ROM，亦不作診斷或自動 FTHUE 分級。':'The camera angle controls the game only. It is not goniometric ROM and does not diagnose or assign an FTHUE level.',
    '玩法':'Interaction mode',
    '空手（三指）':'Bare hand (three fingers)',
    '夾仔':'Clothes peg',
    '偵測三指輕捏':'Detect a light three-finger pinch',
    '偵測手部開合':'Detect visible hand opening and closing',
    '食指尖停留':'Hold the index fingertip still',
    '訓練模式':'Training mode',
    '單一任務':'Single task',
    '雙重任務':'Dual task',
    '遊戲時間':'Game duration',
    '目標保持':'Target hold',
    '物件停留':'Object dwell',
    '不用保持':'No hold',
    '字體大小':'Text size',
    '細':'Small',
    '中':'Medium',
    '大':'Large',
    '特大':'Extra large',
    '相機校準':'Camera calibration',
    '開始追蹤':'Start tracking',
    '相機：橫放，患側前斜約 30–45°；軀幹及全臂入鏡。':'Camera: landscape orientation, about 30–45° in front of the affected side; keep the trunk and whole arm in view.',
    '相機：患側前斜約 45°；肩、肘、腕及桌面入鏡。':'Camera: about 45° in front of the affected side; keep the shoulder, elbow, wrist and tabletop in view.',
    '相機：患手及手指入鏡。':'Camera: keep the affected hand and fingers in view.',
    '← 返回':'← Back',
    '← 設定':'← Settings',
    '← 遊戲':'← Games',
    '開始前安全確認':'Pre-session safety check',
    '職業治療師選定訓練':'Therapist-selected training',
    '治療師全程監督。':'Therapist supervision is required throughout.',
    '開始前由治療師核對':'Therapist checks before starting',
    '先試 3 次':'Practise three times first',
    '隨時休息／停止':'Rest or stop at any time',
    '慢、穩、不追求次數':'Move slowly and steadily; do not chase repetitions',
    '治療師已核對並全程監督':'The therapist has checked and will supervise throughout',
    '繼續':'Continue',
    '返回':'Back',
    '輔助訓練工具；不可取代治療師評估。':'Training aid only; not a substitute for therapist assessment.',
    '尚未偵測':'Not detected',
    '鏡頭對準':'Align with camera',
    '左右反轉':'Mirror horizontally',
    '○ 偵測':'○ Detection',
    '○ 張手':'○ Open hand',
    '○ 輕合手':'○ Gently close hand',
    '校準重點':'Calibration notes',
    '未能啟動相機':'Unable to start the camera',
    '重新嘗試':'Try again',
    '返回上一頁':'Back to previous page',
    '開始遊戲 ▶':'Start game ▶',
    '遊戲規則':'Game instructions',
    '讀完自動開始':'Starts automatically after the instructions',
    '立即開始 ▶':'Start now ▶',
    '動作示範':'Movement demo',
    '無聲錄影中 · 不錄頭部':'Silent recording · head excluded',
    '試玩 · 不錄影／不提示':'Trial · no recording or therapist alerts',
    '重試自動偵測':'Retry automatic detection',
    '取消自動標記':'Cancel automatic calibration',
    '屈肘':'Flexed',
    '伸肘':'Extended',
    '外展':'Outward',
    '已記錄屈肘起點':'Flexed start captured',
    '已記錄伸肘終點':'Extended end captured',
    '肩水平外展範圍':'Horizontal-abduction range',
    '治療師詳細資料 / Therapist details':'Therapist details',
    '得分':'Score',
    '正確':'Correct',
    '拿取':'Pickups',
    '達標':'Targets reached',
    '時間':'Time',
    '指令':'Instruction',
    '點心 → 同款碟':'Dim sum → matching dish',
    '目標：紅色圓形':'Target: red circle',
    '患者有回應':'Patient responded',
    '沒有回應':'No response',
    '休息':'Rest',
    '放下雙手，放鬆肩膀。':'Lower both arms and relax the shoulders.',
    '患者已準備好，繼續訓練':'Patient is ready; continue training',
    '暫停':'Paused',
    '患者已準備好，繼續':'Patient is ready; continue',
    '停止這一節':'Stop this session',
    '停止這一節？':'Stop this session?',
    '停止後會安全結束這一節，相機會關閉；已記錄的資料不會自動匯出或消失。':'Stopping safely ends this session and turns off the camera. Recorded data will not be exported or deleted automatically.',
    '患者要求停止':'Participant requested stop',
    '身體狀況（治療師記錄）':'Physical condition (therapist record)',
    '疲勞':'Fatigue',
    '技術或追蹤問題':'Technical or tracking issue',
    '其他原因':'Other reason',
    '取消，繼續訓練':'Cancel and continue training',
    '治療師觀察記錄（人手確認）':'Therapist observation record (manual confirmation)',
    '肩膊抬高':'Shoulder elevation',
    '軀幹傾斜':'Trunk lean',
    '疼痛':'Pain',
    '手指愈握愈緊':'Increasing finger flexion',
    '有效連續成功 0/15':'Valid success streak 0/15',
    '追蹤／校準問題，本次不計':'Tracking/calibration issue; this attempt is not counted',
    '治療師參考':'Therapist guidance',
    '本程式不會自動評估 FTHUE 級別，也不會自行更改級別；是否調整須由治療師確認。':'This program does not assess or change the FTHUE level automatically. Any adjustment requires therapist confirmation.',
    '接受建議並更新訓練級別':'Accept recommendation and update training level',
    '不接受，維持現有級別':'Decline and keep current level',
    '← 返回':'← Back',
    '代償觀察':'Compensation',
    'Ⅱ 暫停':'Ⅱ Pause',
    '停止':'Stop',
    '訓練完成':'Training complete',
    '試玩完成':'Trial complete',
    '總得分':'Total score',
    '正確次數':'Correct',
    '總拿取次數':'Total pickups',
    '準確率':'Accuracy',
    '再玩一次':'Repeat session',
    '即時動作回看':'Movement review',
    '不錄頭部 · 未自動上傳':'Head excluded · not uploaded',
    '影片只暫存在本頁。下載後請按研究方案及機構私隱要求處理。':'The video remains temporarily on this page. After downloading, handle it according to the study protocol and institutional privacy requirements.',
    '下載／儲存影片':'Download/save video',
    '刪除影片':'Delete video',
    '未重評':'Not reassessed',
    '完成，可納入分析':'Completed; include in analysis',
    '篩選不合格':'Screening failure',
    '排除／無效紀錄':'Excluded/invalid record',
    '相機估算訓練紀錄':'Camera-estimated training record',
    '茶樓飲茶':'Tea house',
    '荃灣街景相片':'Tsuen Wan street scenes',
    '抹窗擦霧':'Window wiping',
    '保齡球':'Bowling',
    '巴士拍卡':'Bus card tap',
    '衣物分類':'Laundry sorting',
    '啤牌分類':'Playing-card sorting',
    '啤牌':'Playing cards',
    '麻雀':'Mahjong',
    '煮蛋炒飯':'Cook egg fried rice',
    '插花':'Flower arranging',
    '容易':'Easy',
    '最容易':'Easiest',
    '容易至中等':'Easy to moderate',
    '中等':'Moderate',
    '中等至較難':'Moderate to challenging',
    '研究情境':'Research scenario',
    '等待偵測手部':'Waiting for hand detection',
    '手放鏡頭前':'Place the hand in front of the camera',
    '等待鏡頭':'Waiting for camera',
    '等待新相機畫面':'Waiting for a new camera frame',
    '請讓已選患側肩、肘及軀幹入鏡':'Keep the selected affected shoulder, elbow and trunk in view',
    '患側：左手臂':'Affected arm: left',
    '患側：右手臂':'Affected arm: right',
    '找起點':'Finding start',
    '現在':'Current',
    '中線拿取 → 肩屈曲至治療師選定的 30–60° 目標':'Start at the midline → raise the arm to the therapist-selected 30–60° target',
    '中線拿取 → 肩屈曲至治療師選定的 60° 或以上目標':'Start at the midline → raise the arm to the therapist-selected target of 60° or above',
    '肩屈曲追蹤未就緒':'Shoulder tracking is not ready',
    '肩屈曲模組未載入':'Shoulder-flexion module unavailable',
    '同一相機影像只會計算一次':'Each camera frame is counted once only',
    '已拿起':'Picked up',
    '保持停住':'Hold still',
    '已放下':'Released',
    '完成':'Complete',
    '移到目標':'Move to the target',
    '停在同款目標':'Hold over the matching target',
    '移動食指':'Move the index finger',
    '再抬高 · 保持':'Raise a little higher and hold',
    '好！':'Good!',
    '保持舉高':'Keep the arm raised',
    '慢慢返回':'Return slowly',
    '到起點':'Return to the start',
    '抬高至':'Raise to',
    '已放開':'Released',
    '慢慢來':'Take your time',
    '新一局。':'New round.',
    '新一輪。':'New round.',
    '相機':'Camera',
    '遊戲':'Game',
    '設定':'Settings',
    '主頁':'Home'
    ,'語言':'Language'
    ,'選擇語言':'Choose language'
    ,'繁體中文':'繁體中文'
    ,'主動肩屈曲 (Active shoulder flexion)':'Active shoulder flexion'
    ,'主動輔助肩屈曲 (Active-assisted shoulder flexion)':'Active-assisted shoulder flexion'
    ,'肩屈曲動作示範：患者以患手持杯，在三十至六十度範圍內重複抬高手臂':'Shoulder-flexion demonstration: the patient holds one cup in the affected hand and repeatedly raises the arm through the 30–60° range.'
    ,'肩屈曲動作示範：患者以患手持杯，由六十度或以上重複抬高手臂':'Shoulder-flexion demonstration: the patient holds one cup in the affected hand and repeatedly raises the arm from 60° or above.'
    ,'主動輔助肩屈曲示範：患者雙手持黃色彈性阻力棒，在三十至六十度範圍內重複抬高手臂':'Active-assisted shoulder-flexion demonstration: the patient holds a yellow flexible resistance bar with both hands and repeatedly raises the arms through the 30–60° range.'
    ,'主動輔助肩屈曲示範：患者雙手持黃色彈性阻力棒，由六十度或以上重複抬高手臂':'Active-assisted shoulder-flexion demonstration: the patient holds a yellow flexible resistance bar with both hands and repeatedly raises the arms from 60° or above.'
  };

  const PHRASES = [
    [' 分鐘', ' minutes'], ['秒', ' sec'], ['款', ' games'], ['目標 ', 'Target '],
    ['顯示 ', 'Show '], ['已清潔 ', 'Cleaned '], ['訓練級別', 'training level'],
    ['患側', 'affected side'], ['左', 'left'], ['右', 'right'], ['患者', 'patient'],
    ['治療師', 'therapist'], ['相機估算', 'camera-estimated'], ['相機', 'camera'],
    ['肩屈曲', 'shoulder flexion'], ['肩水平外展', 'horizontal shoulder abduction'],
    ['手肘', 'elbow'], ['手腕', 'wrist'], ['手臂', 'arm'], ['雙手', 'both hands'],
    ['張開', 'open'], ['輕捏', 'light pinch'], ['輕握', 'gentle grasp'],
    ['放下', 'release'], ['拿起', 'pick up'], ['返回', 'back'], ['開始', 'start'],
    ['繼續', 'continue'], ['停止', 'stop'], ['完成', 'complete'], ['成功', 'success'],
    ['偵測', 'detection'], ['校準', 'calibration'], ['記錄', 'record'],
    ['遊戲', 'game'], ['訓練', 'training'], ['目標', 'target'], ['物件', 'object'],
    ['同款', 'matching'], ['時間', 'time'], ['得分', 'score'], ['正確', 'correct'],
    ['次', ''], ['慢慢', 'slowly'], ['保持', 'hold'], ['抬高', 'raise'],
    ['屈肘', 'flex elbow'], ['伸肘', 'extend elbow'], ['向前', 'forward'],
    ['向外', 'outward'], ['中央', 'centre'], ['準備', 'ready'], ['等待', 'waiting'],
    ['請', 'please '], ['未能', 'unable to '], ['已', ''], ['不', 'not ']
  ];

  function stripDuplicateBilingual(value) {
    const text = String(value == null ? '' : value);
    const parts = text.split(/｜|\s\/\s/);
    if (parts.length > 1 && /[A-Za-z]{3}/.test(parts.slice(1).join(' '))) return parts[0].trim();
    return text;
  }

  function translateToEnglish(value) {
    const source = stripDuplicateBilingual(value);
    if (!source || !/[\u3400-\u9fff]/.test(source)) return source;
    if (EN[source]) return EN[source];
    let out = source;
    Object.keys(EN).sort((a, b) => b.length - a.length).forEach((key) => {
      if (out.includes(key)) out = out.split(key).join(EN[key]);
    });
    PHRASES.forEach(([zh, en]) => { if (out.includes(zh)) out = out.split(zh).join(en); });
    out = out.replace(/(\d+(?:\.\d+)?)\s*分鐘/g, '$1 minutes')
      .replace(/(\d+(?:\.\d+)?)\s*秒/g, '$1 sec')
      .replace(/[。；，]/g, (mark) => ({'。':'. ','；':'; ','，':', '}[mark]))
      .replace(/\s+/g, ' ').trim();
    if (/[\u3400-\u9fff]/.test(out)) {
      const fallback = source.length <= 12 ? 'Follow the instruction' : 'Follow the on-screen instruction.';
      return fallback;
    }
    return out;
  }

  function text(zh, en) {
    if (currentLanguage === LANG_EN) return en || translateToEnglish(zh);
    return stripDuplicateBilingual(zh);
  }

  function rememberAttributes(element) {
    if (originalAttributes.has(element)) return originalAttributes.get(element);
    const values = {};
    ['aria-label', 'title', 'placeholder', 'alt'].forEach((name) => {
      if (element.hasAttribute && element.hasAttribute(name)) values[name] = element.getAttribute(name);
    });
    originalAttributes.set(element, values);
    return values;
  }

  function applyNode(root) {
    if (!root) return;
    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
    else if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
    }
    nodes.forEach((node) => {
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const source = originalText.get(node);
      node.nodeValue = currentLanguage === LANG_EN ? translateToEnglish(source) : stripDuplicateBilingual(source);
    });
    const elements = root.nodeType === Node.ELEMENT_NODE
      ? [root, ...root.querySelectorAll('*')]
      : [...document.querySelectorAll('*')];
    elements.forEach((element) => {
      const attrs = rememberAttributes(element);
      Object.entries(attrs).forEach(([name, source]) => {
        element.setAttribute(name, currentLanguage === LANG_EN ? translateToEnglish(source) : stripDuplicateBilingual(source));
      });
    });
  }

  function apply(root) {
    const shouldResume = observer && document.body;
    if (shouldResume) observer.disconnect();
    applying = true;
    try {
      applyNode(root || document);
      if (observer) observer.takeRecords();
    } finally {
      applying = false;
      if (shouldResume) observer.observe(document.body, OBSERVER_OPTIONS);
    }
  }

  function updateMenu() {
    const button = document.getElementById('languageButton');
    const menu = document.getElementById('languageMenu');
    const english = currentLanguage === LANG_EN;
    document.documentElement.lang = english ? 'en' : LANG_ZH;
    document.documentElement.dataset.appLanguage = currentLanguage;
    if (button) {
      button.setAttribute('aria-label', english ? 'Choose language' : '選擇語言');
      button.title = english ? 'Language' : '語言';
    }
    if (menu) {
      menu.querySelectorAll('[data-language]').forEach((option) => {
        const selected = option.dataset.language === currentLanguage;
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-checked', selected ? 'true' : 'false');
      });
    }
  }

  function closeMenu() {
    const button = document.getElementById('languageButton');
    const menu = document.getElementById('languageMenu');
    if (menu) menu.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function setLanguage(language) {
    const next = language === LANG_EN ? LANG_EN : LANG_ZH;
    if (next === currentLanguage) {
      updateMenu();
      apply(document);
      return;
    }
    currentLanguage = next;
    updateMenu();
    apply(document);
    window.dispatchEvent(new CustomEvent('ychlanguagechange', { detail: { language: currentLanguage } }));
  }

  function init() {
    currentLanguage = LANG_ZH;
    updateMenu();
    apply(document);
    const button = document.getElementById('languageButton');
    const menu = document.getElementById('languageMenu');
    if (button && menu) {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = menu.hidden;
        menu.hidden = !willOpen;
        button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) menu.querySelector('[aria-checked="true"]')?.focus();
      });
      menu.addEventListener('click', (event) => {
        const option = event.target.closest('[data-language]');
        if (!option) return;
        setLanguage(option.dataset.language);
        closeMenu();
        button.focus();
      });
      document.addEventListener('click', (event) => {
        if (!event.target.closest('.language-switcher')) closeMenu();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { closeMenu(); button.focus(); }
      });
    }
    if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.__ychLanguagePatched) {
      const originalFillText = CanvasRenderingContext2D.prototype.fillText;
      const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
      CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
        return originalFillText.call(this, currentLanguage === LANG_EN ? translateToEnglish(value) : stripDuplicateBilingual(value), ...args);
      };
      CanvasRenderingContext2D.prototype.strokeText = function (value, ...args) {
        return originalStrokeText.call(this, currentLanguage === LANG_EN ? translateToEnglish(value) : stripDuplicateBilingual(value), ...args);
      };
      Object.defineProperty(CanvasRenderingContext2D.prototype, '__ychLanguagePatched', { value: true });
    }
    observer = new MutationObserver((mutations) => {
      if (applying) return;
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          originalText.set(mutation.target, mutation.target.nodeValue);
          apply(mutation.target);
        }
        if (mutation.type === 'attributes') {
          const element = mutation.target;
          const values = originalAttributes.get(element) || {};
          values[mutation.attributeName] = element.getAttribute(mutation.attributeName);
          originalAttributes.set(element, values);
          apply(element);
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) apply(node);
        });
      });
    });
    observer.observe(document.body, OBSERVER_OPTIONS);
  }

  window.YCHLanguage = {
    LANG_ZH, LANG_EN,
    get language() { return currentLanguage; },
    isEnglish() { return currentLanguage === LANG_EN; },
    text, translateToEnglish, apply, setLanguage, closeMenu
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
