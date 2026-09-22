const {app,BrowserWindow}=require('electron');const fs=require('fs');const path=require('path');const os=require('os');const net=require('net');const {spawn}=require('child_process');const assert=require('assert/strict');
const root=path.resolve(__dirname,'..');const WS=require(path.join(root,'node_modules/ws'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ots-render-'));app.setPath('userData',path.join(temp,'electron'));app.disableHardwareAcceleration();
const children=[];let host,view;
async function until(fn){for(let i=0;i<200;i++){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out');}
async function port(){let s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));let n=s.address().port;await new Promise(r=>s.close(r));return n;}
async function server(name,port){const dir=path.join(temp,name);fs.mkdirSync(dir,{recursive:true});if(name==='remote'){
fs.mkdirSync(path.join(dir,'stamps','thumbs'),{recursive:true});const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=','base64');fs.writeFileSync(path.join(dir,'stamps','thumbs','s_1.png'),png);fs.writeFileSync(path.join(dir,'stamps','s_1.png'),png);
fs.writeFileSync(path.join(dir,'stamp-list.json'),JSON.stringify({version:1,stamps:[{id:'s_1',url:'/stamps/s_1.png',thumbUrl:'/stamps/thumbs/s_1.png',category:['joy'],createdAt:1}]}));
fs.writeFileSync(path.join(dir,'profile-config.json'),JSON.stringify({profile:{name:'接続テスト配信者',nickname:'REMOTE-NICK',skin:'basic',links:[],freeFormItems:[]},features:{stamps:true,otsumami:true,ohinerimaki:true},bannedIps:[]}));}
const child=spawn(process.execPath,[path.join(root,'server/index.js')],{cwd:root,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PORT:String(port),HOST:'127.0.0.1',OTS_USER_DATA:dir}});children.push(child);let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);await until(async()=>{if(child.exitCode!==null)throw Error(logs);try{return (await fetch(`http://127.0.0.1:${port}/`)).ok;}catch{return false;}});}
app.whenReady().then(async()=>{try{
const localPort=await port(),remotePort=await port();await server('local',localPort);await server('remote',remotePort);process.env.PORT=String(localPort);process.env.OTS_USER_DATA=app.getPath('userData');
host=new WS(`ws://127.0.0.1:${remotePort}`);await new Promise(r=>host.on('open',r));host.send(JSON.stringify({type:'join',role:'host',roomId:'otsumamicast'}));
view=new BrowserWindow({show:false,width:1100,height:850,webPreferences:{preload:path.join(root,'preload.js'),contextIsolation:true,nodeIntegration:false}});
require(path.join(root,'ipc/handlers')).registerIpcHandlers({getMainWindow:()=>view}, {}, { sendToOverlay(){}, setClickThrough(){}, resizeIndicator(){}, resizeOverlay(){} });
const networkEvents=[];
view.webContents.session.webRequest.onCompleted(details=>{if(details.url.includes('/stamps/thumbs/'))networkEvents.push({url:details.url,fromCache:details.fromCache});});
const errors=[];view.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);void 0});
view.webContents.session.webRequest.onBeforeRequest((details,cb)=>{let u=new URL(details.url);cb({cancel:['http:','https:'].includes(u.protocol)&&!['localhost','127.0.0.1'].includes(u.hostname)});});
console.log('loading',localPort);view.loadURL(`http://localhost:${localPort}/`).catch(console.error);await new Promise(r=>setTimeout(r,2000));console.log('loaded wait');await until(()=>view.webContents.executeJavaScript("!!window.state && !!document.getElementById('profileName') && !document.getElementById('serverPortSettings').hidden"));
await view.webContents.executeJavaScript(`import('./js/websocket.js').then(m=>m.connectWs('http://127.0.0.1:${remotePort}'))`);
await until(()=>view.webContents.executeJavaScript("window.otsumamiRemoteProfile?.profile?.nickname === 'REMOTE-NICK'"));
await view.webContents.executeJavaScript("document.getElementById('stampsTab').click()");
await until(()=>view.webContents.executeJavaScript("document.querySelectorAll('#stampCategorySelect option').length === 5 && !!document.querySelector('#stampList img')?.naturalWidth"));
const data=await view.webContents.executeJavaScript(`({src:document.querySelector('#stampList img').src,categories:document.querySelectorAll('#stampCategorySelect option').length,port:document.getElementById('serverPort').value,profile:document.getElementById('profileNickname')?.value})`);
assert.ok(data.src.startsWith(`http://127.0.0.1:${remotePort}/`));assert.equal(data.port,String(localPort));assert.equal(data.profile,'REMOTE-NICK');
await view.webContents.executeJavaScript("document.getElementById('staticThumbnailPreview').click()");await until(()=>view.webContents.executeJavaScript("!!document.querySelector('#stampList img')?.naturalWidth"));
const before=networkEvents.filter(e=>!e.fromCache).length;
await view.webContents.executeJavaScript("window.otsumamiStamp.renderStampList();window.otsumamiStamp.renderStampList();window.otsumamiStamp.renderStampList()");
await new Promise(r=>setTimeout(r,500));
assert.equal(networkEvents.filter(e=>!e.fromCache).length,before,'redrawing must reuse thumbnail cache');
host.send(JSON.stringify({type:'sync',payload:{action:'load',videoId:'test-video'}}));
await new Promise(r=>setTimeout(r,500));
assert.equal(await view.webContents.executeJavaScript("document.querySelector('.tab.active').dataset.tab"),'stamps');
assert.equal(await view.webContents.executeJavaScript("window.state.lastSyncPayload.videoId"),'test-video');
await view.webContents.executeJavaScript("document.getElementById('serverPort').value='8123';document.getElementById('saveServerPort').click()");await until(()=>view.webContents.executeJavaScript("document.getElementById('serverPortStatus').textContent.includes('保存しました')"));assert.equal(JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'app-settings.json'))).port,8123);
await view.webContents.executeJavaScript("document.getElementById('hostBtn').click()");
await new Promise(r=>setTimeout(r,300));
await view.webContents.executeJavaScript("document.querySelector('input[name=stampSound][value=sound3]').checked=true;document.getElementById('stampSoundVolume').value='0';window.saveAllSettings()");
const savedSound=JSON.parse(fs.readFileSync(path.join(temp,'local','stamp-config.json')));
assert.equal(savedSound.stampSound,'sound3');assert.equal(savedSound.stampSoundVolume,0);
await view.webContents.executeJavaScript("document.querySelector('input[name=stampSound][value=sound1]').checked=true;window.dispatchEvent(new Event('otsumamiRoleChanged'))");
await until(()=>view.webContents.executeJavaScript("document.querySelector('input[name=stampSound]:checked').value==='sound3' && document.getElementById('stampSoundVolume').value==='0'"));

console.log(JSON.stringify({passed:true,data,networkEvents,errors},null,2));
}catch(e){console.error(e);process.exitCode=1;}finally{host?.terminate();view?.destroy();for(const child of children)child.kill();app.exit(process.exitCode||0);}});
setTimeout(()=>{console.error('Renderer test timeout');for(const child of children)child.kill();app.exit(1);},60000);
