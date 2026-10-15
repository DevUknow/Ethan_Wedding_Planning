import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {toPublicInvitation,validInvitation} from '../app/src/invitation-model.js';

// This fixture never contacts a real account, uploads a real private photo, or
// changes production records. It exercises the deployed cloud code with RLS-like
// responses, including a separate public invitation table and Storage bucket.
const output='/tmp/our-chapter-cloud-test';
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',output],{stdio:'inherit',env:{...process.env,VITE_SUPABASE_URL:'https://sync-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const filename=path.resolve(output,'.'+(requested==='/'?'/index.html':requested));if(!filename.startsWith(output+'/'))throw Error();const content=await readFile(filename);res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');res.end(content)}catch{res.statusCode=404;res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
let row={id:'main',revision:0,data:{couple:'송윤오 ♥ 박예은',date:'2027-04-17',budget:30000000,tasks:[],expenses:[],guests:[],saved:[],futurePrivateSecret:'private-future-token'}};
let publicRow={id:'main',revision:0,data:toPublicInvitation(row.data)};
let writes=0,conflicts=0,injectConflict=false,holdNextWrite=false,releaseWrite=null;
const sockets=new Set(),errors=[],requests=[],otpRequests=[],publicResponses=[],storage=new Map();
const user={id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated',email:'admin@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:new Date().toISOString()};
const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
function publish(table){const record=table==='wedding_state'?row:publicRow;for(const socket of sockets)if(socket.table===table)socket.send('postgres_changes',{ids:[1],data:{schema:'public',table,type:'UPDATE',columns:[{name:'id',type:'text'},{name:'data',type:'jsonb'},{name:'revision',type:'int8'}],record,old_record:{},commit_timestamp:new Date().toISOString()}})}
function commit(data){writes++;row={...row,revision:row.revision+1,data};publicRow={...publicRow,revision:row.revision,data:toPublicInvitation(data)};publish('wedding_state');publish('wedding_invitation')}
async function context(label){
 const context=await browser.newContext({locale:'ko-KR',timezoneId:'Asia/Seoul',viewport:{width:1440,height:1000}});
 await context.route('https://fonts.googleapis.com/**',route=>route.abort());
 await context.route('https://sync-test.supabase.co/**',async route=>{
  const request=route.request(),p=new URL(request.url()).pathname,authorized=request.headers().authorization===`Bearer ${token}`,probe=request.headers()['x-security-probe']==='1';
  requests.push({label,path:p,method:request.method(),authorized,probe});
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return}
  let body;try{body=request.postDataJSON()}catch{}
  let data,status=200;
  if(p==='/rest/v1/wedding_state'){
   if(!authorized){status=403;data={message:'Administrator required',code:'42501'}}else data=row;
  }else if(p==='/rest/v1/wedding_invitation'){data=publicRow;publicResponses.push(structuredClone(data.data))}
  else if(p==='/auth/v1/otp'){
   otpRequests.push({label,probe,body});
   if(body?.create_user!==false){status=422;data={code:'signup_disabled',message:'Signups not allowed for otp'}}
   else if(body.email!==user.email){status=422;data={code:'otp_disabled',message:'Signups not allowed for otp'}}
   else data={};
  }
  else if(p==='/auth/v1/verify')data={access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user};
  else if(p==='/auth/v1/user'){if(authorized)data=user;else{status=401;data={message:'Invalid token'}}}
  else if(p==='/auth/v1/logout'){status=204;data=null}
  else if(p==='/rest/v1/rpc/get_wedding_role')data=authorized?{role:'admin',name:'송윤오'}:null;
  else if(p==='/rest/v1/rpc/save_wedding_state'){
   if(!authorized){status=403;data={message:'Administrator required',code:'42501'}}
   else{
    if(holdNextWrite){holdNextWrite=false;await new Promise(resolve=>{releaseWrite=resolve})}
    if(injectConflict){injectConflict=false;commit({...row.data,tasks:[...row.data.tasks,{id:'external-task',title:'비공개 동시 수정 보존',category:'기타',due:'',done:false}]})}
    if(body._expected_revision!==row.revision){conflicts++;data=[]}
    else{commit(body._new_data);data=[row]}
   }
  }else if(p.startsWith('/storage/v1/object/public/wedding-invitation/')){
   const object=storage.get(p.replace('/storage/v1/object/public/',''));
   if(object){await route.fulfill({status:200,headers,contentType:object.type,body:object.bytes});return}
   status=404;data={message:'Not found'};
  }else if(p.startsWith('/storage/v1/object/wedding-invitation/')&&request.method()==='POST'){
   if(!authorized){status=403;data={message:'Administrator required'}}else{
    const objectPath=p.replace('/storage/v1/object/','');
    let type=request.headers()['content-type']||'image/jpeg',bytes=request.postDataBuffer();
    if(type.startsWith('multipart/form-data')){
     const form=await new Request(request.url(),{method:'POST',headers:{'content-type':type},body:bytes}).formData();
     const image=form.get('');type=image.type;bytes=Buffer.from(await image.arrayBuffer());
    }
    assert.equal(type,'image/jpeg');assert.equal(bytes.subarray(0,2).toString('hex'),'ffd8');
    storage.set(objectPath,{type,bytes});
    data={Key:objectPath,Id:crypto.randomUUID()};
   }
  }else{status=404;data={message:'Unexpected fixture request '+p}}
  await route.fulfill({status,headers,contentType:'application/json',...(status===204?{}:{body:JSON.stringify(data)})});
 });
 await context.routeWebSocket('wss://sync-test.supabase.co/**',ws=>{
  const channels=new Map();
  ws.onMessage(raw=>{
   const decoded=JSON.parse(raw),array=Array.isArray(decoded);
   const msg=array?{join_ref:decoded[0],ref:decoded[1],topic:decoded[2],event:decoded[3],payload:decoded[4]}:decoded;
   const reply=payload=>ws.send(JSON.stringify(array?[msg.join_ref,msg.ref,msg.topic,'phx_reply',payload]:{...msg,event:'phx_reply',payload}));
   if(msg.event==='phx_join'){
    const table=msg.payload.config?.postgres_changes?.[0]?.table;
    requests.push({label,path:`realtime/${table}`,method:'SUBSCRIBE',authorized:msg.payload.access_token===token,probe:false});
    const channel={table,send(event,payload){ws.send(JSON.stringify(array?[msg.join_ref,null,msg.topic,event,payload]:{join_ref:msg.join_ref,ref:null,topic:msg.topic,event,payload}))}};
    channels.set(msg.topic,channel);sockets.add(channel);
    reply({status:'ok',response:{postgres_changes:[{id:1,event:'UPDATE',schema:'public',table,filter:'id=eq.main'}]}});
   }else if(msg.event==='phx_leave'){sockets.delete(channels.get(msg.topic));channels.delete(msg.topic);reply({status:'ok',response:{}})}
   else if(msg.event==='heartbeat')reply({status:'ok',response:{}});
  });
  ws.onClose(()=>{for(const channel of channels.values())sockets.delete(channel)});
 });
 context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 return context;
}
async function login(page){
 await page.goto(url);await expect(page.getByLabel('관리자 이메일')).toBeVisible();
 await page.getByLabel('이름',{exact:true}).fill('송윤오');await page.getByLabel('별명').fill('예쁜강아지');await page.getByLabel('관리자 이메일').fill('admin@example.com');
 const otpResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/auth/v1/otp');
 await page.getByRole('button',{name:'인증 메일 받기'}).click();
 const sent=await otpResponse;assert.equal(sent.request().postDataJSON().create_user,false,'Administrator OTP login must never create a new account');assert.equal(sent.status(),200);
 await page.getByLabel('이메일 인증 코드').fill('123456');await page.getByRole('button',{name:'인증하고 들어가기'}).click();
 await expect(page.locator('.role-badge')).toHaveText('송윤오 · 관리자');
 await expect(page.locator('.sync-banner')).toContainText('공유 기록이 연결되어 있어요');
}
const privatePath=request=>request.path==='/rest/v1/wedding_state'||request.path==='/rest/v1/rpc/save_wedding_state'||request.path==='realtime/wedding_state';
async function expectPublic(page){
 await expect(page.locator('.invitation-paper')).toBeVisible();
 await expect(page.getByRole('heading',{name:'우리, 결혼합니다',exact:true})).toBeVisible();
 await expect(page.locator('.invitation-paper')).toContainText('브리에홀');
 for(const name of ['예산 관리','체크리스트','하객 관리','신혼집 꾸미기','신혼여행','백업','복원'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
 for(const secret of ['비공개 준비 할 일','비공개 동시 수정 보존','비공개 하객','비공개 웨딩홀','비공개 원목 식탁','비공개 우붓 숙소','private-future-token'])await expect(page.locator('body')).not.toContainText(secret);
}
try{
 const admin=await context('admin'),otherAdmin=await context('other-admin'),guest=await context('guest'),direct=await context('direct');
 const a=await admin.newPage(),b=await otherAdmin.newPage(),g=await guest.newPage(),d=await direct.newPage();
 await g.goto(url);await g.getByRole('button',{name:'게스트로 보기',exact:true}).click();await expectPublic(g);
 await d.goto(url+'/?invite=1');await expectPublic(d);
 assert.equal(requests.filter(request=>['guest','direct'].includes(request.label)&&privatePath(request)).length,0,'Public entry must never read or subscribe to private planning records');
 await login(a);await login(b);
 assert.equal(otpRequests.filter(request=>!request.probe).length,2);
 assert.ok(otpRequests.filter(request=>!request.probe).every(request=>request.body.create_user===false));
 const signupProbe=await g.evaluate(async()=>{
  const response=await fetch('https://sync-test.supabase.co/auth/v1/otp',{method:'POST',headers:{'content-type':'application/json',apikey:'sb_publishable_test','x-security-probe':'1'},body:JSON.stringify({email:'new-user@example.com',create_user:true})});
  return {status:response.status,body:await response.json()};
 });
 assert.equal(signupProbe.status,422);assert.equal(signupProbe.body.code,'signup_disabled');

 // A forced compare-and-swap conflict stands for a concurrent device update.
 injectConflict=true;
 await a.getByRole('button',{name:'체크리스트',exact:true}).click();await b.getByRole('button',{name:'체크리스트',exact:true}).click();
 await a.getByRole('button',{name:'할 일 추가',exact:true}).click();await a.getByLabel('할 일',{exact:true}).fill('비공개 준비 할 일');await a.getByRole('button',{name:'저장하기'}).click();
 await expect(b.getByText('비공개 준비 할 일',{exact:true})).toBeVisible();await expect(b.getByText('비공개 동시 수정 보존',{exact:true})).toBeVisible();
 await a.getByRole('button',{name:'비공개 준비 할 일 완료',exact:true}).click();await expect(b.getByRole('button',{name:'비공개 준비 할 일 완료 취소',exact:true})).toBeVisible();
 assert.ok(conflicts>=1);assert.equal(row.data.tasks.length,2);
 await a.getByRole('button',{name:'하객 관리',exact:true}).click();await a.getByRole('button',{name:'하객 추가'}).click();await a.getByLabel('이름',{exact:true}).fill('비공개 하객');await a.getByRole('button',{name:'저장하기'}).click();
 await a.getByLabel('비공개 하객 참석 여부').selectOption('참석');await expect.poll(()=>row.data.guests[0]?.status).toBe('참석');

 await a.getByRole('button',{name:'예산 관리',exact:true}).click();await b.getByRole('button',{name:'예산 관리',exact:true}).click();
 await a.getByRole('button',{name:'예산 항목 추가'}).click();await a.getByLabel('예산 항목',{exact:true}).fill('비공개 웨딩홀');await a.getByLabel('계획 금액 (원)',{exact:true}).fill('1000000');await a.getByLabel('계약·확정 금액 (원)').fill('1200000');await a.getByRole('button',{name:'예산 항목 저장'}).click();
 await expect(b.getByRole('button',{name:'비공개 웨딩홀',exact:true})).toBeVisible();
 await a.getByRole('button',{name:'비공개 웨딩홀 결제 기록 추가'}).click();await a.getByLabel('결제 금액 (원)').fill('200000');await a.getByRole('button',{name:'결제 기록 저장'}).click();
 await a.getByRole('button',{name:'비공개 웨딩홀 항목 수정'}).click();await a.getByLabel('계약·확정 금액 (원)').fill('1500000');await a.getByRole('button',{name:'예산 항목 저장'}).click();
 await expect(b.locator('.budget-summary-grid article').nth(3)).toContainText('1,300,000');
 const weddingPayments=structuredClone(row.data.expenses[0].payments);assert.equal(weddingPayments[0].amount,200000);

 await a.getByRole('button',{name:'신혼집 꾸미기',exact:true}).click();
 await a.getByRole('button',{name:'꾸미기 예산 설정',exact:true}).click();await a.getByLabel('꾸미기 예산 (원)',{exact:true}).fill('3000000');await a.getByRole('button',{name:'꾸미기 예산 저장',exact:true}).click();
 await a.getByRole('button',{name:'꾸미기 항목 추가',exact:true}).click();
 for(const [label,value] of [['품목명','비공개 원목 식탁'],['방·공간','주방·다이닝'],['계획 단가 (원)','400000'],['실구매 단가 (원)','450000'],['수량','2'],['가로 (cm)','160'],['깊이 (cm)','80'],['높이 (cm)','75'],['색상','오크'],['소재','원목'],['배치 위치','주방 창가'],['상품 링크','https://example.com/table'],['배송·설치 예정일','2027-04-10'],['메모','비공개 반입 동선']])await a.getByLabel(label,{exact:true}).fill(value);
 await a.getByRole('button',{name:'꾸미기 항목 저장',exact:true}).click();
 const homeCard=a.locator('.home-item-card').filter({has:a.getByRole('heading',{name:'비공개 원목 식탁',exact:true})});
 await expect(homeCard).toContainText('900,000');await a.getByLabel('비공개 원목 식탁 준비 상태',{exact:true}).selectOption('배송 중');
 await homeCard.getByRole('button',{name:'예산에 연결',exact:true}).click();await a.getByRole('dialog',{name:'결혼 예산에 반영',exact:true}).getByRole('button',{name:'예산에 연결하기',exact:true}).click();
 await expect(a.getByRole('dialog',{name:'결혼 예산에 반영',exact:true})).toHaveCount(0);
 await expect.poll(()=>row.data.expenses.length).toBe(2);
 const homeExpenseId=row.data.home.items[0].expenseId;assert.equal(row.data.expenses.length,2);assert.equal(row.data.expenses.find(item=>item.id===homeExpenseId).actualAmount,900000);
 await b.getByRole('button',{name:'신혼집 꾸미기',exact:true}).click();await expect(b.locator('.home-item-card')).toContainText('배송 중');

 await a.getByRole('button',{name:'신혼여행',exact:true}).click();await a.getByRole('button',{name:'여행 설정',exact:true}).click();
 for(const [label,value] of [['여행 시작일','2027-04-18'],['여행 종료일','2027-04-26'],['신혼여행 예산 (원)','7000000'],['여행 메모','비공개 둘만의 여행 메모']])await a.getByLabel(label,{exact:true}).fill(value);
 await a.getByRole('button',{name:'여행 설정 저장',exact:true}).click();await a.getByRole('button',{name:'예약 항목 추가',exact:true}).click();
 await a.getByLabel('예약·일정 이름',{exact:true}).fill('비공개 우붓 숙소');await a.getByRole('dialog').getByRole('combobox',{name:/^여행 분류/}).selectOption('숙소');
 for(const [label,value] of [['여행 지역','우붓'],['일정 날짜','2027-04-18'],['시작 시간','15:00'],['종료 날짜','2027-04-21'],['계획 금액 (원)','900000'],['확정 금액 (원)','850000'],['업체·숙소','비공개 숙소 업체'],['예약 링크','https://example.com/ubud'],['예약 메모','비공개 조식 포함']])await a.getByLabel(label,{exact:true}).fill(value);
 await a.getByRole('button',{name:'예약 항목 저장',exact:true}).click();
 const tripCard=a.locator('.honeymoon-item-card').filter({has:a.getByRole('heading',{name:'비공개 우붓 숙소',exact:true})});
 await a.getByLabel('비공개 우붓 숙소 예약 상태',{exact:true}).selectOption('예약 완료');await tripCard.getByRole('button',{name:'예산에 연결',exact:true}).click();await a.getByRole('dialog',{name:'결혼 예산에 반영',exact:true}).getByRole('button',{name:'예산에 연결하기',exact:true}).click();
 await expect(a.getByRole('dialog',{name:'결혼 예산에 반영',exact:true})).toHaveCount(0);
 await a.getByRole('tab',{name:/^준비물/}).click();await a.getByRole('button',{name:'준비물 추가',exact:true}).click();await a.getByLabel('준비물 이름',{exact:true}).fill('여행용 어댑터');await a.getByRole('button',{name:'준비물 저장',exact:true}).click();await a.getByRole('checkbox',{name:'여행용 어댑터',exact:true}).click();
 await expect.poll(()=>row.data.honeymoon.packing[0]?.done).toBe(true);assert.equal(row.data.expenses.length,3);assert.deepEqual(row.data.expenses[0].payments,weddingPayments);

 // Upload is a draft operation; only the explicit save publishes card settings.
 await a.getByRole('button',{name:'모바일 청첩장',exact:true}).click();
 const beforeInvitation=writes;
 for(const [label,value] of [['신랑 이름','윤오'],['신부 이름','예은'],['예식 날짜','2027-05-22'],['예식 시간','13:30'],['초대 글','우리의 새로운 시작에 함께해 주세요.'],['추가 교통 안내','지하철 평촌역에서 만나 뵙겠습니다.'],['신랑 연락처','010-1234-5678'],['신부 연락처','010-2345-6789']])await a.getByLabel(label,{exact:true}).fill(value);
 await a.getByLabel('대표 사진 업로드',{exact:true}).setInputFiles('app/src/assets/venue/briller-hall.webp');
 await expect(a.getByLabel('대표 사진 설명',{exact:true})).toBeVisible();await a.getByLabel('대표 사진 설명',{exact:true}).fill('공개 초대장 대표 사진');
 assert.equal(writes,beforeInvitation);assert.equal(storage.size,1);
 await a.getByRole('button',{name:'청첩장 저장',exact:true}).click();
 await expect.poll(()=>row.data.invitation?.groom).toBe('윤오');assert.equal(row.data.date,'2027-05-22');assert.equal(row.data.invitation.time,'13:30');
 assert.match(row.data.invitation.heroPhoto.url,/\/storage\/v1\/object\/public\/wedding-invitation\/hero\/.+\.jpg$/);
 await expect(g.locator('.invitation-paper')).toContainText('우리의 새로운 시작에 함께해 주세요.');
 await expect(g.locator('.invitation-paper')).toContainText('오후 1시 30분');await expectPublic(g);
 for(const page of [g,d]){await page.reload();await expectPublic(page);await expect(page.locator('.invitation-paper')).toContainText('우리의 새로운 시작에 함께해 주세요.')}
 await g.setViewportSize({width:390,height:844});await g.screenshot({path:'/tmp/our-chapter-cloud-invitation-mobile.png',fullPage:true});
 await expect.poll(()=>g.locator('.invitation-paper img').first().evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
 assert.equal(await g.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const publicReads=requests.filter(request=>['guest','direct'].includes(request.label)&&request.path==='/rest/v1/wedding_invitation');assert.ok(publicReads.length>=4);
 assert.ok(publicResponses.every(validInvitation));for(const published of publicResponses)assert.equal(JSON.stringify(published).includes('비공개'),false);
 assert.equal(requests.filter(request=>['guest','direct'].includes(request.label)&&privatePath(request)&&!request.probe).length,0);

 // A forged browser request still receives a server-side denial in this fixture.
 const denied=await g.evaluate(async()=>{
  const headers={'content-type':'application/json',apikey:'sb_publishable_test','x-security-probe':'1'};
  const read=await fetch('https://sync-test.supabase.co/rest/v1/wedding_state?select=*',{headers});
  const write=await fetch('https://sync-test.supabase.co/rest/v1/rpc/save_wedding_state',{method:'POST',headers,body:JSON.stringify({_expected_revision:0,_new_data:{budget:1}})});
  return {read:read.status,write:write.status};
 });assert.deepEqual(denied,{read:403,write:403});

 // A private request that finishes after logout must not restore the dashboard.
 await a.getByRole('button',{name:'체크리스트',exact:true}).click();await a.getByRole('button',{name:'할 일 추가',exact:true}).click();await a.getByLabel('할 일',{exact:true}).fill('비공개 로그아웃 대기 기록');
 holdNextWrite=true;await a.getByRole('button',{name:'저장하기'}).click();await expect.poll(()=>typeof releaseWrite).toBe('function');await a.keyboard.press('Escape');await a.getByRole('button',{name:'접속 화면으로 돌아가기',exact:true}).click();
 await expect(a.getByRole('button',{name:'게스트로 보기',exact:true})).toBeVisible();releaseWrite();releaseWrite=null;
 await a.getByRole('button',{name:'게스트로 보기',exact:true}).click();await expectPublic(a);await expect(a.locator('body')).not.toContainText('비공개 로그아웃 대기 기록');
 assert.deepEqual(errors,[]);
 console.log('Mock cloud browser passed: verified existing-account OTP with account creation disabled, signup rejection, private admin access, two-device realtime, conflict retry, budgets/payments, home and Bali records, separate public invitation, draft photo upload and explicit publication, guest privacy, anonymous denial and logout callback guard. Production Auth settings and RLS still require separate validation.');
}finally{releaseWrite?.();await browser.close();await new Promise(resolve=>server.close(resolve))}
