const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '..');
const quiet = { log(){}, warn(){}, error(){} };
function load(file, globals = {}, dependencies = {}) {
  const filename = path.join(root, file);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, require: name => name in dependencies ? dependencies[name] : localRequire(name), __dirname: path.dirname(filename), console: quiet, process, URL, Date, setTimeout, clearTimeout, ...globals };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
async function esm(file) {
  return import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.join(root, file))).toString('base64'));
}
test('port validation and persistence preserve overlay settings', () => {
  const settings = require('../config/app-settings');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ots-settings-'));
  for (const value of [0, -1, 65536, '7244x', '', NaN]) assert.equal(settings.validPort(value), false);
  for (const value of [1, '7244', 65535]) assert.equal(settings.validPort(value), true);
  settings.writeSettings(dir, { overlay: { width: 900, height: 500 } });
  settings.writeSettings(dir, { port: 8123 });
  assert.equal(settings.readSettings(dir).overlay.width, 900);
  assert.equal(settings.readSettings(dir).port, 8123);
  fs.writeFileSync(path.join(dir, 'app-settings.json'), '{broken');
  assert.deepEqual(settings.readSettings(dir), {});
});
test('overlay size and anchor survive close and a fresh module; offscreen anchor recovers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ots-layout-'));
  const windows = [];
  class Window extends EventEmitter {
    constructor(options) { super(); this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height }; this.webContents = new EventEmitter(); this.webContents.send = () => {}; windows.push(this); }
    isDestroyed(){ return !!this.destroyed; }
    getBounds(){return {...this.bounds};} getPosition(){return [this.bounds.x,this.bounds.y];} getSize(){return [this.bounds.width,this.bounds.height];}
    setBounds(b){Object.assign(this.bounds,b);this.emit('resize');} setPosition(x,y){Object.assign(this.bounds,{x,y});this.emit('move');}
    setAlwaysOnTop(){} setVisibleOnAllWorkspaces(){} moveTop(){} setIgnoreMouseEvents(){}
    close(){this.emit('close');this.destroyed=true;this.emit('closed');}
  }
  const display = { workArea: {x:0,y:0,width:1920,height:1080} };
  const deps = { electron: { app: {getPath:()=>dir}, BrowserWindow: Window, screen:{getPrimaryDisplay:()=>display,getAllDisplays:()=>[display]} }, './load-window':()=>{} };
  let manager=load('windows/overlay-manager.js',{},deps);
  manager.openOverlay(); windows[0].setPosition(700,150); manager.resizeOverlay(900,500); manager.closeOverlay();
  manager=load('windows/overlay-manager.js',{},deps); manager.openOverlay();
  assert.equal(windows[3].bounds.width,900); assert.equal(windows[3].bounds.height,500); assert.equal(windows[2].bounds.x,700); assert.equal(windows[3].bounds.y,178);
  manager.closeOverlay();
  require('../config/app-settings').writeSettings(dir,{indicator:{x:99999,y:99999,width:250,height:30}});
  manager=load('windows/overlay-manager.js',{},deps); manager.openOverlay();
  assert.equal(windows[4].bounds.x,1650); manager.closeOverlay();
});
test('connection URLs preserve port and protocol; assets use the connected host', async()=>{
  const {connectionUrl,resolveAsset}=await esm('public/js/connection-target.js');
  assert.equal(connectionUrl('192.0.2.5:8123','http://localhost:7244'),'ws://192.0.2.5:8123/');
  assert.equal(connectionUrl('https://example.test','http://localhost:7244'),'wss://example.test/');
  assert.equal(connectionUrl('http://example.test:80','http://localhost:7244'),'ws://example.test/');
  assert.equal(connectionUrl('[::1]:8123','http://localhost:7244'),'ws://[::1]:8123/');
  assert.throws(()=>connectionUrl('file:///x','http://localhost:7244'));
  assert.equal(resolveAsset('/stamps/thumbs/a.png',{url:'ws://192.0.2.5:8123/'}),'http://192.0.2.5:8123/stamps/thumbs/a.png');
});
test('Vcast microphone capture disables processing and releases temporary streams',()=>{
  const main=fs.readFileSync(path.join(root,'electron-main.js'),'utf8');
  const overlay=fs.readFileSync(path.join(root,'public/js/overlay.js'),'utf8');
  const tab=fs.readFileSync(path.join(root,'public/js/tabs/vcast-tab-init.js'),'utf8');
  assert.match(main,/WebRtcAllowInputVolumeAdjustment/);
  for(const source of [overlay,tab]){
    assert.match(source,/autoGainControl:\s*false/);assert.match(source,/echoCancellation:\s*false/);assert.match(source,/noiseSuppression:\s*false/);
  }
  assert.match(tab,/permissionStream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(tab,/otsumamiTabChanged/);
  assert.match(overlay,/config\.enabled && config\.voiceReaction/);
});
test('absolute stamp URLs reorder/delete correctly; IP and source URL never leave manager', async()=>{
  const Manager=require('../server/stamp-manager');const manager=new Manager('unused');manager.save=async()=>{};
  manager.stampList={stamps:[{id:'a',url:'/stamps/a.png',addedIp:'192.0.2.1',sourceUrl:'private'},{id:'b',url:'/stamps/b.png'}]};
  assert.equal(manager.getStamps()[0].addedIp,undefined);assert.equal(manager.getStamps()[0].sourceUrl,undefined);
  await manager.reorderStamps(['http://host:8123/stamps/b.png','http://host:8123/stamps/a.png']);assert.equal(manager.getStamps()[0].id,'b');
  await manager.deleteStamps(['http://host:8123/stamps/a.png']);assert.equal(manager.getStamps().length,1);
});
test('category changes reject unregistered clients and unknown category; stamp usage sends history only',async()=>{
  let updates=0,broadcasts=[];const socket={};const manager={clients:new Map(),sendTo(){},checkRateLimit:()=>true,stampConfig:{getCategories:()=>[{id:'joy'}]},stampManager:{addCategoryToStamps:async()=>updates++,updateStampUsage:async filename=>({url:filename,lastUsedAt:123})},broadcast:m=>broadcasts.push(m)};
  require('../server/websocket-stamp-handlers')(manager);
  await manager.handleStampCategoryAdd(socket,{urls:['/stamps/a.png'],category:'joy'});assert.equal(updates,0);
  manager.clients.set(socket,{role:'viewer'});await manager.handleStampCategoryAdd(socket,{urls:['/stamps/a.png'],category:'fake'});assert.equal(updates,0);
  manager.broadcastStampList=async()=>{};await manager.handleStampCategoryAdd(socket,{urls:['/stamps/a.png'],category:'joy'});assert.equal(updates,1);
  await manager.handleStamp(socket,{payload:{filename:'/stamps/a.png'}});assert.deepEqual(broadcasts.map(x=>x.type),['stamp-used','stamp']);
  assert.equal(broadcasts[0].url,'/stamps/a.png');
});
test('listener stamp additions are limited per IP while host additions are exempt',async()=>{
  let additions=0;const errors=[];const viewer={_socket:{remoteAddress:'::ffff:203.0.113.1'}};const manager={clients:new Map([[viewer,{role:'viewer'}]]),stampDownloadRateLimit:new Map(),normalizeAddress:value=>value.replace(/^::ffff:/,''),sendTo(_ws,message){if(message.type==='error')errors.push(message.message);},broadcast(){},stampHandler:{addStampFromDiscord:async(_url,id)=>({id,url:`/stamps/${id}.png`,filename:`${id}.png`,fileSizeBytes:1})},stampManager:{addStamp:async()=>additions++,getStamps:()=>[]},stampConfig:{config:{maxFileSize:5},canListenerAddStamp:()=>true,isFileSizeValid:()=>true,getCategories:()=>[]}};
  require('../server/websocket-stamp-handlers')(manager);manager.broadcastStampList=async()=>{};const message={url:'https://cdn.discordapp.com/a.png'};
  for(let i=0;i<6;i++)await manager.handleStampAdd(viewer,message);assert.equal(additions,5);assert.match(errors.at(-1),/5分間に5件/);
  const reconnected={_socket:{remoteAddress:'203.0.113.1'}};manager.clients.set(reconnected,{role:'viewer'});await manager.handleStampAdd(reconnected,message);assert.equal(additions,5);
  const host={_socket:{remoteAddress:'127.0.0.1'}};manager.clients.set(host,{role:'host'});for(let i=0;i<6;i++)await manager.handleStampAdd(host,message);assert.equal(additions,11);
});
test('profile broadcasts include extended fields and empty arrays but no bans',()=>{
  const Profile=require('../server/profile-config');const profile=new Profile('unused');profile.config.profile.nickname='test';profile.config.profile.links=[];profile.config.bannedIps=['private'];
  const socket={};let message;const manager={clients:new Map([[socket,{role:'host'}]]),profileConfig:profile,broadcast:m=>message=m,sendTo(){}};
  require('../server/websocket-extra-handlers')(manager);manager.handleProfileConfigUpdated(socket,{config:{profile:{name:'partial'}}});
  assert.equal(message.config.profile.nickname,'test');assert.deepEqual(message.config.profile.links,[]);assert.equal(message.config.bannedIps,undefined);assert.ok(message.config.features);
});
test('missing ffmpeg rejects instead of leaving thumbnail generation pending',async()=>{
  const spawn=()=>{const child=new EventEmitter();child.stderr=new EventEmitter();process.nextTick(()=>child.emit('error',new Error('ENOENT')));return child;};
  const Handler=load('server/stamp-handler.js',{}, {'child_process':{spawn},sharp:()=>{}});
  const handler=new Handler('unused');await assert.rejects(handler.createVideoStaticThumbnail('a.mp4','a'),/ENOENT/);
});
test('two auto-next triggers send only one request and cancel on playback',async()=>{
  const {scheduleQueueAutoplay,resetQueueAutoplay}=await esm('public/js/queue-autoplay.js');let sends=0,playState=0;
  const state={role:'host',ws:{readyState:1,send(){sends++;}},videoQueue:[{}],player:{getPlayerState:()=>playState}};
  scheduleQueueAutoplay(state,5);scheduleQueueAutoplay(state,5);await new Promise(r=>setTimeout(r,20));assert.equal(sends,1);
  scheduleQueueAutoplay(state,5);await new Promise(r=>setTimeout(r,20));assert.equal(sends,1);
  resetQueueAutoplay();playState=1;scheduleQueueAutoplay(state,5);await new Promise(r=>setTimeout(r,20));assert.equal(sends,1);resetQueueAutoplay();
});
test('main and video window factories retain their APIs and use the configured port',()=>{
 const previous=process.env.PORT;process.env.PORT='8123';const urls=[];
 class Window extends EventEmitter {constructor(options){super();this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};}isDestroyed(){return false;}focus(){}}
 const dependencies={electron:{app:{getAppPath:()=>root},BrowserWindow:Window,Menu:{setApplicationMenu(){}},shell:{openExternal(){}}},'./load-window':(window,url)=>urls.push(url)};
 try{const main=load('windows/main-window.js',{},dependencies);const video=load('windows/video-window.js',{},dependencies);assert.equal(main.createMainWindow(),main.getMainWindow());assert.equal(video.createVideoWindow(),video.getVideoWindow());assert.deepEqual(urls,['http://localhost:8123','http://localhost:8123/video.html']);}
 finally{if(previous===undefined)delete process.env.PORT;else process.env.PORT=previous;}
});
test('remote management requests are forbidden and public settings omit passwords',()=>{
 const uses=[],gets=new Map();const router={use(...args){uses.push(args);},get(route,fn){gets.set(route,fn);},post(){},delete(){}};
 const setup=load('server/routes.js',{}, {express:{static:()=>()=>{}},'../config/default':{UPNP:{PUBLIC_PORT:8123},SERVER:{IMAGE_DIR:'unused',IMAGE_PUBLIC_PATH:'/images',STAMP_DIR:'unused'},API:{YP_TIMEOUT:100}}});
 setup(router,{}, {},null,{getAll:()=>({discordPassword:'secret',discordServerPasswords:{a:'secret'},maxFileSize:5})});
 let status,body;const res={status(code){status=code;return this;},json(value){body=value;return this;}};
 const middleware=uses.find(x=>x[0]==='/api')[1];let next=false;middleware({method:'POST',ip:'198.51.100.1',headers:{host:'example.test'},protocol:'http'},res,()=>next=true);assert.equal(status,403);assert.equal(next,false);
 gets.get('/api/stamp-config')({ip:'198.51.100.1'},res);assert.equal(body.config.discordPassword,undefined);assert.equal(body.config.discordServerPasswords,undefined);assert.equal(body.config.maxFileSize,5);
});
