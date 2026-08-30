import {chromium} from 'playwright'; import path from 'node:path'; import {pathToFileURL} from 'node:url';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1180,height:820}}); await p.goto(pathToFileURL(path.resolve('/home/user/workspace/ych_rehab_games_advanced/index.html')).href);
for(const task of ['chopsticks','peg']){console.log(task,await p.evaluate(t=>{window.__qa.startGame({level:'67',level6Task:t,duration:60});return window.__qa.level67Layout()},task));}
await b.close();
