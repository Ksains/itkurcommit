// Run against an isolated Chrome started with --remote-debugging-port=9223.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {createServer}=require('../server.cjs');
const {build}=require('../scripts/build.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'team-browser-test-'));
 const project=path.resolve(__dirname,'..');
 await fs.mkdir(path.join(root,'participants'));await fs.mkdir(path.join(root,'assets'));
 for(const file of ['index.html','assets/app.js','assets/profiles.js','assets/style.css','assets/avatar.svg','assets/ui.js','assets/golos-text.ttf','assets/font-license.txt'])await fs.copyFile(path.join(project,file),path.join(root,file));
 const sample={name:'Анна',github:'@anna',direction:'Frontend',skills:['HTML','CSS'],fact:'Мне нравится создавать полезные интерфейсы.',projectTitle:'Навигатор для новичков',projectDescription:'Хочу собрать инструкции для новых участников в одном удобном приложении.'};
 for(const[login,name]of [['anna','Анна'],['amir','Амир']])await fs.writeFile(path.join(root,`participants/${login}.json`),JSON.stringify({...sample,name,github:'@'+login}));
 const server=createServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 const targets=await(await fetch('http://127.0.0.1:9223/json')).json();
 const socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
 await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
 let id=0;const pending=new Map();
 socket.addEventListener('message',event=>{const result=JSON.parse(event.data);const task=pending.get(result.id);if(task){pending.delete(result.id);clearTimeout(task.timer);result.error?task.reject(Error(JSON.stringify(result.error))):task.resolve(result.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(Error('Timeout: '+method));},15000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);return response.result.value;};
 const ready=count=>evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(document.querySelectorAll('#team-list article').length===${count})resolve(true);else if(Date.now()-start>10000)reject(Error('Team did not load'));else setTimeout(check,50);};check();})`);
 let staticServer;
 try{
  await send('Page.enable');await send('Page.navigate',{url});await ready(2);
  assert.match(await evaluate(`document.getElementById('team-list').textContent`),/Навигатор для новичков/);
  await evaluate(`document.querySelectorAll('details').forEach(el=>el.open=true)`);
  for(const width of [320,390,760,1280]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<800});
   const layout=await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})');assert.ok(layout.content<=layout.width,`Overflow at ${width}`);
   if(width===390 || width===1280){
    await evaluate(`document.documentElement.style.scrollBehavior='auto';document.getElementById('team').scrollIntoView()`);
    const cards=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await fs.writeFile(path.join(os.tmpdir(),`onboarding-cards-${width}.png`),Buffer.from(cards.data,'base64'));
   }
  }
  console.log('PASS: two real fixture files render with projects; responsive at 320, 390, 760, 1280 px');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await evaluate(`document.querySelector('summary').focus()`);
  assert.equal(await evaluate('document.activeElement.tagName'),'SUMMARY');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  assert.equal(await evaluate(`document.querySelector('details').open`),false);
  assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineStyle`),'solid');
  await evaluate(`document.querySelector('details').open=true;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}});document.querySelector('[data-copy]').click()`);
  assert.equal(await evaluate('window.copied'),await evaluate(`document.getElementById('command-version').textContent`));
  await evaluate(`navigator.clipboard.writeText=async()=>{throw Error('Denied')};document.querySelector('[data-copy]').click()`);
  assert.equal(await evaluate('getSelection().toString()'),await evaluate(`document.getElementById('command-version').textContent`));
  await evaluate('getSelection().removeAllRanges()');
  console.log('PASS: keyboard accordion, visible focus, command copy and denied-clipboard fallback');
  await evaluate(`window.blobs=[];window.downloadName='';URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:test';};HTMLAnchorElement.prototype.click=function(){downloadName=this.download;};document.getElementById('onboarding').requestSubmit();`);
  assert.equal(await evaluate('blobs.length'),0);
  await evaluate(`const data={name:'Мария',github:'Maria',direction:'Backend',skills:'Python, SQL',fact:'Изучаю создание полезных приложений.',projectTitle:'Бот команды',projectDescription:'Хочу сделать бота, который поможет новичкам найти ответы на частые вопросы.'};for(const[key,value]of Object.entries(data)){const el=document.getElementById('onboarding').elements.namedItem(key);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}document.getElementById('onboarding').requestSubmit();`);
  const exported=await evaluate('blobs[0].text()');assert.equal(await evaluate('downloadName'),'maria.json');assert.match(JSON.parse(exported).projectDescription,/бота/);
  assert.equal(await evaluate(`document.querySelectorAll('#team-list article').length`),2);
  await fs.writeFile(path.join(root,'participants/maria.json'),exported);
  await send('Page.reload');await ready(3);
  assert.match(await evaluate(`document.getElementById('team-list').textContent`),/Бот команды/);
  assert.equal(await evaluate(`document.getElementById('onboarding').elements.namedItem('projectTitle').value`),'Бот команды');
  console.log('PASS: export named by login, draft separate from team, added file visible after reload');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(os.tmpdir(),'team-mobile.png'),Buffer.from(shot.data,'base64'));
  await build(root);
  const routes=new Map(['/index.html','/assets/app.js','/assets/profiles.js','/assets/style.css','/assets/avatar.svg','/assets/ui.js','/assets/golos-text.ttf','/assets/font-license.txt','/data/participants.json'].map(route=>['/project'+route,route]));routes.set('/project/','/index.html');
  staticServer=http.createServer(async(req,res)=>{const file=routes.get(req.url);if(!file){res.writeHead(404);res.end();return;}const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain'})[ext]);res.end(await fs.readFile(path.join(root,'dist',file)));});
  await new Promise(resolve=>staticServer.listen(0,'127.0.0.1',resolve));
  await send('Page.navigate',{url:`http://127.0.0.1:${staticServer.address().port}/project/`});await ready(3);
  console.log('PASS: built static site loads all cards under /project/ like GitHub Pages');
  await send('Page.navigate',{url:'http://127.0.0.1:8000'});
  await evaluate(`new Promise(resolve=>{const check=()=>document.getElementById('team-message')?.textContent.includes('пока нет')?resolve(true):setTimeout(check,50);check();})`);
  assert.equal(await evaluate(`document.querySelectorAll('#team-list article').length`),0);
  assert.equal(await evaluate(`document.getElementById('team-empty').hidden`),false);
  await evaluate('document.fonts.ready');
  assert.equal(await evaluate(`document.fonts.check('16px "Golos Text"')`),true);
  for(const [name,width,target] of [['desktop',1280,'main'],['empty',1280,'team'],['guide',1280,'guide'],['mobile',390,'main'],['mobile-guide',390,'guide'],['mobile-form',390,'editor']]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});
   await evaluate(`document.documentElement.style.scrollBehavior='auto';${target==='main'?'window.scrollTo(0,0)':`document.getElementById('${target}').scrollIntoView()`}`);
   const screen=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   await fs.writeFile(path.join(os.tmpdir(),`onboarding-${name}.png`),Buffer.from(screen.data,'base64'));
  }
  console.log('PASS: real workspace has a clear empty state, no fabricated participants');
 }finally{
  await send('Browser.close').catch(()=>{});socket.close();await new Promise(resolve=>server.close(resolve));if(staticServer)await new Promise(resolve=>staticServer.close(resolve));
  assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('team-browser-test-'));await fs.rm(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});




