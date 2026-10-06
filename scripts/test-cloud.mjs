import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';

const output='/tmp/our-chapter-cloud-test';
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',output],{stdio:'inherit',env:{...process.env,VITE_SUPABASE_URL:'https://sync-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}});
const server=createServer(async(req,res)=>{try{const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const filename=path.resolve(output,'.'+(requested==='/'?'/index.html':requested));if(!filename.startsWith(output+'/'))throw Error();const content=await readFile(filename);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(filename)]||'application/octet-stream');res.end(content)}catch{res.statusCode=404;res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
let row={id:'main',revision:0,data:{couple:'송윤오 ♥ 박예은',date:'',budget:30000000,tasks:[],expenses:[],guests:[],saved:[]}};
let writes=0;const sockets=new Set(),errors=[];
const user={id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated',email:'admin@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:new Date().toISOString()};
const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
function publish(){for(const socket of sockets)socket.send('postgres_changes',{ids:[1],data:{schema:'public',table:'wedding_state',type:'UPDATE',columns:[{name:'id',type:'text'},{name:'data',type:'jsonb'},{name:'revision',type:'int8'}],record:row,old_record:{},commit_timestamp:new Date().toISOString()}})}
async function context(){
 const context=await browser.newContext();
 await context.route('https://fonts.googleapis.com/**',route=>route.abort());
 await context.route('https://sync-test.supabase.co/**',async route=>{
  const request=route.request(),p=new URL(request.url()).pathname,body=request.postDataJSON(),authorized=request.headers().authorization===`Bearer ${token}`;
  let data,status=200;
  if(p==='/rest/v1/wedding_state')data=row;
  else if(p==='/auth/v1/otp')data={};
  else if(p==='/auth/v1/verify')data={access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user};
  else if(p==='/auth/v1/user')data=user;
  else if(p==='/auth/v1/logout'){status=204;data=null}
  else if(p==='/rest/v1/rpc/get_wedding_role')data=authorized?{role:'admin',name:'송윤오'}:null;
  else if(p==='/rest/v1/rpc/save_wedding_state'){
   if(!authorized){status=403;data={message:'Administrator required',code:'42501'}}
   else if(body._expected_revision!==row.revision)data=[];
   else{writes++;row={...row,revision:row.revision+1,data:body._new_data};data=[row];publish()}
  }else{status=404;data={message:'Unexpected fixture request '+p}}
  await route.fulfill({status,contentType:'application/json',...(status===204?{}:{body:JSON.stringify(data)})});
 });
 await context.routeWebSocket('wss://sync-test.supabase.co/**',ws=>{
  let channel;
  ws.onMessage(raw=>{
   const decoded=JSON.parse(raw),array=Array.isArray(decoded);
   const msg=array?{join_ref:decoded[0],ref:decoded[1],topic:decoded[2],event:decoded[3],payload:decoded[4]}:decoded;
   function send(event,payload){ws.send(JSON.stringify(array?[msg.join_ref,null,msg.topic,event,payload]:{join_ref:msg.join_ref,ref:null,topic:msg.topic,event,payload}))}
   if(msg.event==='phx_join'){
    channel={send};sockets.add(channel);
    const payload={status:'ok',response:{postgres_changes:[{id:1,event:'UPDATE',schema:'public',table:'wedding_state',filter:'id=eq.main'}]}};
    ws.send(JSON.stringify(array?[msg.join_ref,msg.ref,msg.topic,'phx_reply',payload]:{...msg,event:'phx_reply',payload}));
   }else if(msg.event==='heartbeat')ws.send(JSON.stringify(array?[msg.join_ref,msg.ref,msg.topic,'phx_reply',{status:'ok',response:{}}]:{...msg,event:'phx_reply',payload:{status:'ok',response:{}}}));
  });
  ws.onClose(()=>sockets.delete(channel));
 });
 return context;
}
try{
 const admin=await context(),guest=await context(),a=await admin.newPage(),g=await guest.newPage();
 for(const page of [a,g])page.on('pageerror',error=>errors.push(error.message));
 await a.goto(url);await expect(a.getByLabel('관리자 이메일')).toBeVisible();
 await a.getByLabel('이름',{exact:true}).fill('송윤오');await a.getByLabel('별명').fill('예쁜강아지');await a.getByLabel('관리자 이메일').fill('admin@example.com');
 await a.getByRole('button',{name:'인증 메일 받기'}).click();await a.getByLabel('이메일 인증 코드').fill('123456');await a.getByRole('button',{name:'인증하고 들어가기'}).click();
 await expect(a.locator('.role-badge')).toHaveText('송윤오 · 관리자');
 await g.goto(url);await g.getByRole('button',{name:'게스트로 보기'}).click();
 await g.getByRole('button',{name:'체크리스트',exact:true}).click();
 await a.getByRole('button',{name:'체크리스트',exact:true}).click();await a.getByRole('button',{name:'할 일 추가',exact:true}).click();await a.getByLabel('할 일',{exact:true}).fill('동기화 테스트 할 일');await a.getByRole('button',{name:'저장하기'}).click();
 await expect(g.getByText('동기화 테스트 할 일',{exact:true})).toBeVisible();
 await a.getByRole('button',{name:'동기화 테스트 할 일 완료',exact:true}).click();
 await expect(g.getByRole('button',{name:'동기화 테스트 할 일 완료 취소'})).toBeDisabled();
 const check=g.getByRole('button',{name:'동기화 테스트 할 일 완료 취소'});await check.evaluate(button=>button.disabled=false);await check.click();assert.equal(writes,2);
 await a.getByRole('button',{name:'하객 관리',exact:true}).click();await a.getByRole('button',{name:'하객 추가'}).click();await a.getByLabel('이름',{exact:true}).fill('동기화 친구');await a.getByRole('button',{name:'저장하기'}).click();
 await g.getByRole('button',{name:'하객 관리',exact:true}).click();await expect(g.getByText('동기화 친구',{exact:true})).toBeVisible();
 await a.getByLabel('동기화 친구 참석 여부').selectOption('참석');await expect(g.getByText('참석',{exact:true})).toBeVisible();assert.equal(row.data.guests[0].status,'참석');
 await a.reload();await expect(a.locator('.role-badge')).toHaveText('송윤오 · 관리자');assert.equal(row.data.tasks[0].done,true);assert.deepEqual(errors,[]);
 console.log('Mock cloud browser passed: email flow, two-device realtime, shared persistence, guest write guard. Live Supabase validation still required.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
