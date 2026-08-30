import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1180,height:820}});
await p.goto(pathToFileURL('/home/user/workspace/ych_rehab_games_advanced/index.html').href);
const out=await p.evaluate(()=>{
 const log=[]; const snap=(tag)=>log.push({tag,...window.__qa.level6ToolState()});
 window.__qa.startGame({level:'67',level6Task:'chopsticks',shoulderTargetDeg:90,duration:60,affectedSide:'right'});snap('start');
 for(let i=0;i<18;i++){window.__qa.setLevel6ToolFrame({gesture:'open',shoulderAngle:25,stepMs:120}); if([0,5,11,14,17].includes(i))snap('open'+i)}
 for(let i=0;i<5;i++){window.__qa.setLevel6ToolFrame({gesture:'closed',shoulderAngle:25,stepMs:120});snap('close'+i)}
 for(let i=0;i<14;i++){window.__qa.setLevel6ToolFrame({gesture:'closed',shoulderAngle:118,stepMs:120});snap('move'+i)}
 for(let i=0;i<8;i++){window.__qa.setLevel6ToolFrame({gesture:'open',shoulderAngle:118,stepMs:120});snap('release'+i)}
 return log;
}); console.dir(out,{depth:5});await b.close();
