import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function functionSource(name){
  const marker=`function ${name}(`;
  const start=html.indexOf(marker);
  assert.ok(start>=0,`missing ${name}`);
  const open=html.indexOf('{',start);
  let depth=0;
  for(let i=open;i<html.length;i++){
    if(html[i]==='{') depth++;
    else if(html[i]==='}'&&--depth===0) return html.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('Level 6 gameplay uses one Hand model path, never Pose plus Hand per frame',()=>{
  const startup=functionSource('initGame');
  const tracking=functionSource('updateTracking');
  assert.match(functionSource('needsGrossPoseInference'),/isGrossTabletop\(\) && !isLevel6\(\)/);
  assert.match(startup,/if\(needsGrossPoseInference\(\)\) ensurePoseLandmarker\(\)/);
  assert.match(startup,/if\(isLevel6\(\)\) ensureHandLandmarker\(\)/);
  assert.doesNotMatch(startup,/if\(isGrossTabletop\(\)\) ensurePoseLandmarker\(\)/);
  assert.match(tracking,/if\(needsGrossPoseInference\(\)\)\{/);
  assert.match(tracking,/const res = needsGrossPoseInference\(\)\s*\? readGrossPoseHand\(grossPose\) : readHand\(frame\)/);
  assert.doesNotMatch(tracking,/isLevel6ToolGestureTask\(\)\s*\?\s*readHand/);
});

test('public Level 5 and Level 6 both bypass stacked median and EMA cursor lag',()=>{
  const tracking=functionSource('updateTracking');
  assert.match(tracking,/const publicLevel56Realtime = !research\.active\s*&& \(state\.level === '5' \|\| state\.level === '67'\)/);
  assert.match(tracking,/const stablePoint = publicLevel56Realtime\s*\? \{x:mapped\.x, y:mapped\.y\}\s*:\s*stabiliseTrackingPoint/);
  assert.match(tracking,/if\(publicLevel56Realtime\)\{\s*dotEmaX = px;\s*dotEmaY = py;/);
});

test('large public monitor canvas is capped while iPad and research stay native',()=>{
  const source=functionSource('publicCanvasBackingSize');
  const make=new vm.Script(`
    const PUBLIC_CANVAS_MAX_EDGE=1600;
    const PUBLIC_CANVAS_MAX_PIXELS=1440000;
    let research={active:false};
    ${source}
    ({size:publicCanvasBackingSize,research});
  `).runInNewContext();

  assert.deepEqual({...make.size(1180,820)},{width:1180,height:820,scale:1});
  const hd=make.size(1920,1080);
  assert.ok(hd.width<=1600&&hd.height<=1600);
  assert.ok(hd.width*hd.height<=1440000);
  assert.ok(Math.abs(hd.width/hd.height-16/9)<.002);
  const fourK=make.size(3840,2160);
  assert.ok(fourK.width<=1600&&fourK.width*fourK.height<=1440000);
  assert.ok(Math.abs(fourK.width/fourK.height-16/9)<.002);

  make.research.active=true;
  assert.deepEqual({...make.size(3840,2160)},{width:3840,height:2160,scale:1});
});
