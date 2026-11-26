import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// v144 — therapist feedback (26 Nov): a patient said Level 3 is "just reaching".
// The Level 3/4 Tsuen Wan photo scene becomes a first-person Hong Kong tour:
//   arrive at a stop → the view ahead is hazy → every lift raises the binoculars
//   and clears one quarter of the view → after four looks the landmark is named
//   and becomes a shiny collectible card that flies into the album → ride to the
//   next (unknown) stop.
// It is a visual / audio reward layer only: the shoulder controller, the target
// decision, the score and the v137 re-arm rules are untouched.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const localization = readFileSync(path.join(root, 'localization.js'), 'utf8');
const sources = JSON.parse(readFileSync(path.join(root, 'image-sources.json'), 'utf8'));

const modStart = html.indexOf('/* ==================== v144 香港遊');
const modEnd = html.indexOf('\nfunction drawShoulderFlexionGuide(');
assert.ok(modStart > 0 && modEnd > modStart, 'v144 module is present');
const moduleSrc = html.slice(modStart, modEnd);

function loadModule(randomValues){
  let clock = 1000, ri = 0;
  const sandbox = {
    Math: Object.assign(Object.create(Math), randomValues ? { random: () => randomValues[ri++ % randomValues.length] } : {}),
    Image: function(){ this.complete = false; this.naturalWidth = 0; },
    document: { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) },
    isShoulderFlexionLevel: () => true,
    research: { active: false },
    state: { theme: 'tsuenwan' },
    nowMs: () => clock,
    dealText: (zh) => zh,
    Number, Object, Array, JSON,
  };
  vm.createContext(sandbox);
  vm.runInContext(moduleSrc + '\nthis.api={HK_CARDS,photoCards,isPhotoCardTheme,startPhotoCardDraw,photoCardRewardMs,finishPhotoCardDraw,resetPhotoCards,photoCardSummaryText,photoCardCollectedUnique,ensurePhotoCard,HK_LOOK_MS,HK_CARD_TAIL_MS,HK_CARD_NAME_MS,HK_CARD_FLY_MS,HK_RIDE_MS,HK_CARD_PIECES};', sandbox);
  return { api: sandbox.api, sandbox, tick: ms => { clock += ms; } };
}

test('at least 50 landmark cards, each with a name, district, English text, stars and a compact local photo', () => {
  const { api } = loadModule();
  assert.ok(api.HK_CARDS.length >= 50, 'at least 50 cards, got ' + api.HK_CARDS.length);
  const ids = new Set();
  for(const c of api.HK_CARDS){
    assert.match(c.id, /^[a-z0-9_]+$/);
    assert.ok(!ids.has(c.id), 'unique id ' + c.id); ids.add(c.id);
    assert.ok(c.zh && c.dist && c.en && c.distEn, c.id + ' has Chinese and English text');
    assert.ok([1, 2, 3].includes(c.stars), c.id + ' stars');
    const file = path.join(root, 'img/cards', c.id + '.jpg');
    assert.equal(existsSync(file), true, 'img/cards/' + c.id + '.jpg');
    assert.ok(statSync(file).size < 160000, c.id + ' stays tablet-friendly');
  }
  const stars = [1, 2, 3].map(n => api.HK_CARDS.filter(c => c.stars === n).length);
  assert.ok(stars.every(n => n >= 8), 'all three star levels are used: ' + stars.join('/'));
  assert.ok(api.HK_CARDS.some(c => c.dist === '荃灣'), 'the home district is included');
});

test('every card photo is credited with an open licence and none comes from the tourism board site', () => {
  const byPath = new Map(sources.images.map(i => [i.local_path, i]));
  const { api } = loadModule();
  for(const c of api.HK_CARDS){
    const s = byPath.get('img/cards/' + c.id + '.jpg');
    assert.ok(s, 'image-sources.json lists ' + c.id);
    assert.match(s.source_url, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(s.license, /^(CC0( 1\.0)?|Public domain|CC BY(-SA)? [1-4]\.[0-9]( \w+)?)$/);
    assert.match(s.license_url, /^https:\/\/creativecommons\.org\//);
    assert.ok(s.author && !/No machine-readable|^\[/.test(s.author), c.id + ' has a named author');
    assert.match(s.changes, /Cropped/);
  }
  assert.doesNotMatch(html + JSON.stringify(sources), /discoverhongkong|hktb/i);
  assert.match(html, /香港地標相片（Level 3／4「香港遊」/);
  assert.match(html, /href="image-sources\.json"/);
});

test('four looks finish one stop: a card is collected and the next stop is a different place', () => {
  const { api } = loadModule();
  assert.equal(api.isPhotoCardTheme(), true);
  api.ensurePhotoCard();
  const first = api.photoCards.card.id;
  assert.equal(api.photoCards.stop, 1);
  for(let i = 1; i <= 4; i++){
    api.startPhotoCardDraw();
    assert.equal(api.photoCards.anim.phase, 'look');
    assert.equal(api.photoCards.revealed, i);
    assert.equal(api.photoCards.anim.done, i === 4);
    if(i < 4){
      assert.equal(api.photoCardRewardMs(), api.HK_LOOK_MS + api.HK_CARD_TAIL_MS);
      api.finishPhotoCardDraw();
      assert.equal(api.photoCards.shown.filter(Boolean).length, i);
    }
  }
  assert.equal(api.photoCardRewardMs(), api.HK_LOOK_MS + api.HK_CARD_NAME_MS + api.HK_CARD_FLY_MS + api.HK_RIDE_MS + 100);
  assert.deepEqual(Array.from(api.photoCards.collected), [first]);
  api.finishPhotoCardDraw();
  assert.notEqual(api.photoCards.card.id, first);
  assert.equal(api.photoCards.stop, 2);
  assert.equal(api.photoCards.revealed, 0);
  assert.deepEqual(Array.from(api.photoCards.shown), [false, false, false, false]);
  assert.match(api.photoCardSummaryText(), /集到 1 張閃咭/);
});

test('a second lift during the animation is ignored and the four quarters are each cleared once', () => {
  const { api } = loadModule();
  api.ensurePhotoCard();
  api.startPhotoCardDraw();
  const piece = api.photoCards.anim.piece;
  api.startPhotoCardDraw();
  assert.equal(api.photoCards.revealed, 1);
  assert.equal(api.photoCards.anim.piece, piece);
  api.finishPhotoCardDraw();
  const seen = [piece];
  for(let i = 0; i < 3; i++){ api.startPhotoCardDraw(); seen.push(api.photoCards.anim.piece); if(i < 2) api.finishPhotoCardDraw(); }
  assert.deepEqual(seen.slice().sort(), [0, 1, 2, 3]);
});

test('every landmark is visited once before any repeats, and reset clears the album', () => {
  const { api } = loadModule();
  const n = api.HK_CARDS.length, seen = new Set();
  api.ensurePhotoCard();
  for(let k = 0; k < n; k++){
    seen.add(api.photoCards.card.id);
    for(let i = 0; i < 4; i++){ api.startPhotoCardDraw(); api.finishPhotoCardDraw(); }
  }
  assert.equal(seen.size, n);
  assert.equal(api.photoCards.collected.length, n);
  assert.equal(api.photoCardCollectedUnique().length, n);
  api.resetPhotoCards();
  assert.equal(api.photoCards.collected.length, 0);
  assert.equal(api.photoCards.card, null);
  assert.equal(api.photoCardSummaryText(), '');
});

test('the scene is public Level 3/4 only and stays a reward layer on top of the shared detection', () => {
  assert.match(moduleSrc, /return isShoulderFlexionLevel\(\)&&!research\.active&&state\.theme==='tsuenwan'&&HK_CARDS\.length>0;/);
  // it only reads the lift progress; it never writes the controller state or decides a repetition
  assert.doesNotMatch(moduleSrc, /shoulderFlexionState\.[A-Za-z]+\s*=[^=]/);
  assert.doesNotMatch(moduleSrc, /targetReady|shoulderFlexionController|repetitionReady|score\s*[+\-]?=/);
  assert.doesNotMatch(moduleSrc, /ctx\.filter/);
  assert.match(html, /if\(isPhotoCardTheme\(\)\)startPhotoCardDraw\(\);/);
  assert.match(html, /return Math\.max\(SHOULDER_REWARD_MIN_MS,photoCardRewardMs\(\)\);/);
  assert.match(html, /finishPhotoCardDraw\(\);/);
  assert.match(html, /resetPhotoCards\(\);/);
  assert.match(html, /if\(isPhotoCardTheme\(\)\)\{ drawPhotoCardScene\(ctx,cw,ch\); return; \}/);
  assert.match(html, /if\(isPhotoCardTheme\(\)\)\{ targets=\[\]; return; \}/);
  assert.match(html, /if\(correct&&isPhotoCardTheme\(\)\) return;/);
  // the Level 5 photo matching game and its six photos are unchanged
  assert.match(html, /id:'tsuenwan',title:'荃灣街景相片',goal:'把荃灣街景相片送到同名的大型相片目標'/);
  assert.match(html, /\['tak_wah_park','德華公園','img\/advanced\/tsuenwan_tak_wah_park\.jpg'\]/);
});

test('the scene card, the result page and the English text are wired up', () => {
  assert.match(html, /shoulderTitle:'香港遊'/);
  assert.match(html, /shoulderGoal:'到站落車，舉起望遠鏡睇風景，望清楚就影到一張閃咭'/);
  assert.match(html, /shoulderThumbnail:'img\/advanced\/hk_tour_thumb\.jpg'/);
  assert.equal(existsSync(path.join(root, 'img/advanced/hk_tour_thumb.jpg')), true);
  assert.match(html, /<div id="cardAlbumSummary" class="card-album" hidden><\/div>/);
  assert.match(html, /renderPhotoCardAlbumSummary\(\);/);
  assert.match(html, /const cardLine=isPhotoCardTheme\(\)\?photoCardSummaryText\(\):'';/);
  assert.match(localization, /'香港遊':'Hong Kong Tour'/);
  assert.match(localization, /'到站落車，舉起望遠鏡睇風景，望清楚就影到一張閃咭':/);
  for(const en of ['Lift the binoculars', 'Next stop: \\?\\?\\?', 'We have arrived!', 'Where is this\\?']){
    assert.match(moduleSrc, new RegExp(en));
  }
});
