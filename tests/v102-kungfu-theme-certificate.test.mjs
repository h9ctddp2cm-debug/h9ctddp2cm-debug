// v102 — 港式神功修煉主題、Level 2 卡片收埋、Level 3 治療師 GIF、參與嘉許狀
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const loc = fs.readFileSync(path.join(root, 'localization.js'), 'utf8');
const BUILD = 'v104-20260905-landing-copy-horizontal-cert';

test('v102+ build markers are aligned across index, service worker and manifest', () => {
  const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const manifest = fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
  assert.match(html, new RegExp(`LEVEL_APP_BUILD\\s*=\\s*['"]${BUILD}['"]`));
  assert.match(sw, new RegExp(`CACHE_VERSION\\s*=\\s*"fthue-rehab-${BUILD}"`));
  assert.match(manifest, new RegExp(`start_url[^\\n]*${BUILD}`));
  assert.match(html, /perf v104 {2}/);
});

test('landing title block: service title above and larger than the kung-fu brand line', () => {
  const head = html.slice(html.indexOf('LEVEL LANDING SCREEN'), html.indexOf('id="btnLevel2"'));
  const i1 = head.indexOf('仁濟醫院職業治療部');
  const i2 = head.indexOf('中風上肢復康訓練');
  const i3 = head.indexOf('港式神功修煉');
  const i4 = head.indexOf('欲要成功，必先勤功！');
  assert.ok(i1 > -1 && i1 < i2 && i2 < i3 && i3 < i4, 'order: 部門 → 中風上肢復康訓練 → 港式神功修煉 → 口號');
  assert.match(head, /<h2 class="service-title"[^>]*>中風上肢復康訓練<\/h2>/);
  assert.match(head, /<p class="brand-title"[^>]*><span class="brand-en">FTHUE-HK<\/span> 港式神功修煉<\/p>/);
  // 中風上肢復康訓練（h2）字體要大過 港式神功修煉（p.brand-title）
  const h2 = /\.home-head \.service-title\s*\{[^}]*font-size\s*:\s*clamp\(\s*(\d+)px/.exec(html);
  const brand = /\.home-head \.brand-title\s*\{[^}]*font-size\s*:\s*clamp\(\s*(\d+)px/.exec(html);
  assert.ok(h2 && brand, 'both font-size rules present');
  assert.ok(Number(h2[1]) > Number(brand[1]), `service title ${h2[1]}px > brand ${brand[1]}px`);
});

test('Level 2 card is archived (hidden) but not deleted; Level 2 code paths remain', () => {
  assert.match(html, /<article class="level-card level-card--archived" hidden data-archived-level="2">/);
  assert.match(html, /\.level-card\.level-card--archived\s*\{\s*display:none\s*!important/);
  assert.match(html, /id="btnLevel2"/);
  assert.match(html, /getElementById\('btnLevel2'\)/);
  assert.match(html, /桌面承托訓練/);
});

test('Levels 3–6 cards carry kung-fu names, slogans and the clinical name', () => {
  const pairs = [
    ['佛光初現', '初現曙光，神功開竅', '膊頭屈曲 30–60°'],
    ['大鵬展翅', '舉高膊頭，生龍活虎', '膊頭屈曲 60° 或以上'],
    ['如來神掌', '揮灑自如，大開大合', null],
    ['萬佛朝宗', '終極境界，彈指神通', null],
  ];
  for (const [name, slogan, clinical] of pairs) {
    // v104：Level 5/6 唔再顯示臨床名稱；Level 3/4 用「膊頭屈曲」
    const tail = clinical ? `\\s*<p class="lv-clinical">${clinical}</p>` : `\\s*(?!<p class="lv-clinical">)`;
    const re = new RegExp(`<h3 class="kungfu">${name}</h3>\\s*<p class="lv-kungfu-sub">${slogan}</p>${tail}`);
    assert.match(html, re, name);
    assert.ok(loc.includes(`'${name}'`), `EN entry for ${name}`);
    assert.ok(loc.includes(`'${slogan}'`), `EN entry for ${slogan}`);
  }
  assert.ok(loc.includes("'中風上肢復康訓練'"));
  assert.ok(loc.includes("'港式神功修煉'"));
  assert.ok(loc.includes("'欲要成功，必先勤功！'"));
});

test('Level 3 active demo uses the therapist cartoon GIF; original SVG retained', () => {
  assert.match(html, /data-testid="demo-level-3-active"/);
  assert.match(html, /img\/advanced\/level3_therapist_shoulder_30_60\.gif"\s*\n?\s*alt="[^"]+"\s*\n?\s*data-testid="demo-level-3-active"/);
  const gif = path.join(root, 'img', 'advanced', 'level3_therapist_shoulder_30_60.gif');
  assert.ok(fs.existsSync(gif));
  const buf = fs.readFileSync(gif);
  assert.equal(buf.subarray(0, 6).toString('latin1'), 'GIF89a');
  assert.ok(buf.length > 50_000 && buf.length < 1_000_000, 'GIF size sane');
  assert.ok(fs.existsSync(path.join(root, 'img', 'advanced', 'shoulder_active_30_60.svg')));
  assert.ok(fs.existsSync(path.join(root, 'img', 'advanced', 'shoulder_assisted_30_60.svg')));
  assert.match(html, /img\/advanced\/shoulder_assisted_30_60\.svg/);
});

test('certificate.html exists, is linked from the landing page, and carries the approved wording', () => {
  const certPath = path.join(root, 'certificate.html');
  assert.ok(fs.existsSync(certPath));
  const cert = fs.readFileSync(certPath, 'utf8');
  assert.match(html, /<a class="cert-entry" id="lnkCertificate" href="certificate\.html" target="_blank" rel="noopener"/);
  assert.match(html, /頒發參與嘉許狀/);
  assert.ok(loc.includes("'頒發參與嘉許狀'"));
  for (const s of [
    '證書', '中風上肢復康訓練', '參與嘉許狀',
    '在仁濟醫院職業治療部完成十天的',
    '『<span class="latin">FTHUE-HK</span> 港式神功修煉』遊戲，',
    '全程意志堅強、毅力超人、', '可喜可賀！', '特發此獎，以茲紀念！',
    '仁濟醫院職業治療師', '鄧姑娘', '列印／儲存 PDF', 'img/cert/yan_chai_logo_full.png',
  ]) assert.ok(cert.includes(s), `certificate contains ${s}`);
  assert.doesNotMatch(cert, /10日完成證書|十日完成證書/);
  assert.doesNotMatch(cert, /佛光初現|大鵬展翅|如來神掌|萬佛朝宗/, 'no stage names on the certificate');
  assert.doesNotMatch(cert, /祝賀[^<]*<span class="line"/, 'no line after 祝賀');
  assert.doesNotMatch(cert, /\bresearch\b|\bpilot\b|研究/i);
  assert.match(cert, /@page\s*\{[^}]*size\s*:\s*A4 landscape/);
  assert.ok(fs.existsSync(path.join(root, 'img', 'cert', 'yan_chai_logo_full.png')));
  assert.ok(fs.existsSync(path.join(root, 'img', 'cert', 'inkwash_bg.jpg')));
  const build = fs.readFileSync(path.join(root, 'scripts', 'build-dist.sh'), 'utf8');
  assert.match(build, /cp "\$ROOT\/certificate\.html" "\$DIST\/certificate\.html"/);
});

test('certificate logo PNG has a transparent background (no white box)', () => {
  const buf = fs.readFileSync(path.join(root, 'img', 'cert', 'yan_chai_logo_full.png'));
  // PNG IHDR: colour type at byte 25 (6 = RGBA)
  assert.equal(buf.readUInt8(25), 6, 'PNG colour type RGBA');
  assert.match(buf.subarray(0, 8).toString('hex'), /^89504e470d0a1a0a$/);
});

test('v102 dim-sum chopstick slots are deterministic (no overlap)', () => {
  assert.match(html, /slotRatios/);
  assert.match(html, /\[\[0\.20,\s*0\.30\],\s*\[0\.50,\s*0\.34\],\s*\[0\.80,\s*0\.30\]\]/);
  assert.match(html, /\[\[0\.22,\s*0\.45\],\s*\[0\.50,\s*0\.45\],\s*\[0\.78,\s*0\.45\]\]/);
});
