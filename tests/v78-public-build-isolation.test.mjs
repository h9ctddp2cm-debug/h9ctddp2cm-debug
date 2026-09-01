import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicIndex=path.join(root,'dist/public/index.html');
const source=readFileSync(path.join(root,'index.html'),'utf8');

test('public build pipeline has deterministic stripping and fail-closed study guards',()=>{
  const build=readFileSync(path.join(root,'scripts/build-dist.sh'),'utf8');
  const sanitizer=readFileSync(path.join(root,'scripts/sanitize-public.cjs'),'utf8');
  assert.match(build,/node "\$ROOT\/scripts\/sanitize-public\.cjs" "\$DIST\/index\.html" "\$DIST\/localization\.js"/);
  assert.match(build,/research DOM, state, function, or event handler remains/);
  assert.match(build,/research-only code or localization remains anywhere/);
  assert.match(sanitizer,/EXPECTED_TERSER_SHA256/);
  assert.match(sanitizer,/PUBLIC_BUILD_REMOVE_START/);
  assert.match(sanitizer,/research\\\.active\\s\*=\\s\*\(\?:true\|false\)/);
  assert.match(sanitizer,/research\\\.active\\b\/g, 'false'/);
  assert.match(sanitizer,/hidden\/direct research entry route/);
  assert.match(source,/PUBLIC_BUILD_REMOVE_START: complete research setup form/);
  assert.match(source,/PUBLIC_BUILD_REMOVE_START: research result DOM and export controls/);
});

test('dist public index contains no study DOM, state, handlers, functions, exports, or entry route',()=>{
  assert.ok(existsSync(publicIndex),'run scripts/build-dist.sh before the release suite');
  const html=readFileSync(publicIndex,'utf8');
  const forbidden=[
    /\bresearch(?:[A-Z_$]|\b|\.)/i,
    /\bpilot(?:[A-Z_$]|\b|\.)/i,
    /\b(?:RESEARCH|PILOT)_[A-Z0-9_]+/,
    /screen-research|data-feedback|btnDownloadResearch|btnReturnSessionRecord/i,
    /applyInterventionDeepLink|role=.intervention|autostart|research\/login/i,
    /downloadResearch|exportFormal|exportNonFormal|researchArchive/i,
    /<[^>]+\b(?:id|class|name|for|data-testid)=["'][^"']*(?:research|pilot)/i,
  ];
  for(const pattern of forbidden) assert.doesNotMatch(html,pattern);
  for(const required of [
    'screen-level','screen-library','screen-game','sessionRestOverlay',
    'safetyPauseOverlay','stopConfirmOverlay','btnGameRest','btnGameStop',
  ]) assert.match(html,new RegExp(`id=["']${required}["']`));
});

test('dist public localization contains no research-only dictionary or protocol copy',()=>{
  const localization=readFileSync(path.join(root,'dist/public/localization.js'),'utf8');
  assert.doesNotMatch(localization,/\bresearch\b|\bpilot\b|study protocol|研究模式|研究情境|研究方案/i);
  assert.match(localization,/Rest or stop at any time/,'public safety localization remains');
});

let browser=null;
before(async()=>{
  try{
    const {chromium}=await import('playwright');
    browser=await chromium.launch();
  }catch(error){
    console.warn('playwright unavailable; public isolation browser probe skipped:',error.message);
  }
});
after(async()=>{ if(browser) await browser.close(); });

test('browser cannot activate hidden/direct research calibration while public safety remains live',async t=>{
  if(!browser) return t.skip('playwright unavailable');
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  const url=new URL(pathToFileURL(publicIndex));
  url.search='?role=intervention&autostart=1&participant=P999';
  url.hash='#research';
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(250);
  const probe=await page.evaluate(()=>{
    const forbiddenDom=[...document.querySelectorAll('*')].filter(element=>{
      const attributes=['id','class','name','for','data-testid']
        .map(name=>element.getAttribute(name)||'').join(' ');
      return /research|pilot/i.test(attributes);
    }).map(element=>element.id||element.tagName);
    // Try all ordinary activation vectors a hidden route might listen to.
    window.dispatchEvent(new Event('load'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    document.documentElement.dataset.screen='research';
    document.querySelectorAll('[id*="research" i],[class*="research" i],[id*="pilot" i]')
      .forEach(element=>{
        element.hidden=false;
        element.classList.add('active','show');
        element.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      });
    const calibrationActive=document.getElementById('screen-calib')?.classList.contains('active');
    const initialActive=[...document.querySelectorAll('.screen.active')].map(element=>element.id);

    // Prove the retained rest/stop safety layer is functional, not only present.
    window.startRest();
    const restShown=document.getElementById('sessionRestOverlay').classList.contains('show');
    window.endRest();
    window.showSafetyPause('測試暫停','安全提示',{reason:'release-check'});
    const safetyShown=document.getElementById('safetyPauseOverlay').classList.contains('show');
    window.resetSafetyRuntime();
    const level5Button=document.querySelector(
      '[data-session-level="5"][data-session-mode="training"]',
    ) || document.getElementById('btnLevel5');
    level5Button.click();
    const level5Opened=document.getElementById('screen-library').classList.contains('active');
    return {
      forbiddenDom,
      calibrationActive,
      initialActive,
      restShown,
      safetyShown,
      level5Opened,
      globals:{
        qa:typeof window.__qa,
        researchState:typeof window.researchState,
        startResearch:typeof window.startResearch,
        intervention:typeof window.applyInterventionDeepLink,
      },
    };
  });
  await context.close();
  assert.deepEqual(probe.forbiddenDom,[]);
  assert.equal(probe.calibrationActive,false);
  assert.equal(probe.initialActive.includes('screen-calib'),false);
  assert.deepEqual(probe.globals,{
    qa:'undefined',researchState:'undefined',startResearch:'undefined',intervention:'undefined',
  });
  assert.equal(probe.restShown,true);
  assert.equal(probe.safetyShown,true);
  assert.equal(probe.level5Opened,true);
  assert.deepEqual(pageErrors,[]);
});
