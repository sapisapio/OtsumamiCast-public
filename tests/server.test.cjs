const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const os=require('os');const path=require('path');const net=require('net');const {spawn}=require('child_process');const WebSocket=require('ws');
const root=path.resolve(__dirname,'..');
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
function connect(port,role){return new Promise((resolve,reject)=>{const socket=new WebSocket(`ws://127.0.0.1:${port}`);const messages=[];socket.on('message',x=>messages.push(JSON.parse(x)));socket.on('error',reject);socket.on('open',()=>{socket.send(JSON.stringify({type:'join',roomId:'otsumamicast',role}));resolve({socket,messages});});});}
async function until(fn){const end=Date.now()+10000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out');}
test('real server on a custom port: profile, thumbnails, public/private API, WS updates', {timeout:20000}, async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ots-server-'));const port=await freePort();const origin=`http://127.0.0.1:${port}`;
 fs.mkdirSync(path.join(dir,'stamps','thumbs'),{recursive:true});
 fs.writeFileSync(path.join(dir,'stamps','thumbs','s_1.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=','base64'));
 fs.writeFileSync(path.join(dir,'stamp-list.json'),JSON.stringify({version:1,stamps:[{id:'s_1',url:'/stamps/s_1.png',thumbUrl:'/stamps/thumbs/s_1.png',category:[],addedIp:'PRIVATE_IP',sourceUrl:'PRIVATE_SOURCE'}]}));
 let output='';const child=spawn(process.execPath,['server/index.js'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',OTS_USER_DATA:dir},windowsHide:true});child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);t.after(()=>child.kill());
 await until(async()=>{if(child.exitCode!==null)throw Error(output);try{return (await fetch(origin+'/')).ok;}catch{return false;}});
 assert.equal((await fetch(origin+'/stamps/thumbs/s_1.png')).status,200);
 assert.equal((await fetch(origin+'/stamp-config.json')).status,404);
 assert.equal((await fetch(origin+'/api/stamp-config/save-all',{method:'POST',headers:{Origin:'http://evil.test','Content-Type':'application/json'},body:'{}'})).status,403);
 const publicRes=await fetch(origin+'/api/public/ohinerimaki-config');assert.equal(publicRes.headers.get('access-control-allow-origin'),'*');assert.ok((await publicRes.json()).config.links);
 let response=await fetch(origin+'/api/profile-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:{name:'fixture',nickname:'nick',links:[],freeFormItems:[]},features:{stamps:true},bannedIps:['PRIVATE_BAN']})});assert.equal(response.status,200);
 assert.equal((await (await fetch(origin+'/api/profile-config')).json()).config.bannedIps,undefined);
 const host=await connect(port,'host');t.after(()=>host.socket.terminate());await until(()=>host.messages.some(x=>x.type==='joined'));
 const viewer=await connect(port,'viewer');t.after(()=>viewer.socket.terminate());await until(()=>viewer.messages.some(x=>x.type==='profile-config-sync'));
 const profile=viewer.messages.find(x=>x.type==='profile-config-sync');assert.equal(profile.config.profile.nickname,'nick');assert.equal(profile.config.bannedIps,undefined);
 const stamps=viewer.messages.find(x=>x.type==='stamp-list');assert.equal(stamps.stamps[0].addedIp,undefined);assert.equal(stamps.stamps[0].sourceUrl,undefined);
 host.socket.send(JSON.stringify({type:'profile-config-updated',config:{profile:{name:'partial'}}}));await until(()=>viewer.messages.some(x=>x.type==='profile-config-updated'));assert.deepEqual(viewer.messages.find(x=>x.type==='profile-config-updated').config.profile.links,[]);
 const before=viewer.messages.filter(x=>x.type==='stamp-list').length;viewer.socket.send(JSON.stringify({type:'stamp',payload:{filename:'/stamps/s_1.png'}}));await until(()=>host.messages.some(x=>x.type==='stamp'));assert.equal(viewer.messages.filter(x=>x.type==='stamp-list').length,before);
 host.socket.send(JSON.stringify({type:'register',role:'host'}));await until(()=>host.messages.some(x=>x.type==='registered'));assert.equal(host.messages.find(x=>x.type==='registered').role,'host');
 host.socket.close();await until(()=>viewer.messages.some(x=>x.type==='roomClosed'));
});
