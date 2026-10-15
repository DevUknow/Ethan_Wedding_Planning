import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {initialData} from '../app/src/model.js';
import {saveExpense,savePayment} from '../app/src/budget-model.js';
import {saveHomeItem,setHomeBudget,linkHomeItemToBudget} from '../app/src/home-model.js';
import {saveHoneymoonSettings,saveHoneymoonItem,saveHoneymoonPackingItem,linkHoneymoonItemToBudget} from '../app/src/honeymoon-model.js';
import {toPublicInvitation} from '../app/src/invitation-model.js';

const blankStory = () => ({enabled:false,firstMetDate:'',firstMetText:'',groomMessage:'',brideMessage:'',promise:''});
const publicFields = ['groom','bride','date','time','greeting','heroPhoto','gallery','directionsNote','contactGroom','contactBride','theme','story'];

test('PostgreSQL restricts writes to verified approved emails and handles revisions',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users values
      ('00000000-0000-0000-0000-000000000001','admin@example.com',now()),
      ('00000000-0000-0000-0000-000000000002','guest@example.com',now()),
      ('00000000-0000-0000-0000-000000000003','unconfirmed@example.com',null);`);
  const sql=await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql); // Setup is repeatable and keeps existing records.
  await db.exec(`insert into private.wedding_admins values ('admin@example.com','송윤오'),('unconfirmed@example.com','박예은');set role anon;`);
  await assert.rejects(db.query('select * from public.wedding_state'), /permission denied/);
  const publicSeed=(await db.query('select * from public.wedding_invitation')).rows[0];
  assert.equal(publicSeed.data.groom,'송윤오');assert.equal(publicSeed.data.bride,'박예은');assert.equal(publicSeed.data.date,'');
  assert.deepEqual(Object.keys(publicSeed.data).sort(),publicFields.slice().sort());
  assert.equal(publicSeed.data.theme,'ivory');assert.deepEqual(publicSeed.data.story,blankStory());
  await assert.rejects(db.query("update public.wedding_invitation set data='{}'::jsonb"));
  await assert.rejects(db.query('update public.wedding_state set revision=999'));
  await assert.rejects(db.query("select * from public.save_wedding_state(0,'{}'::jsonb)"));
  await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`);
  assert.equal((await db.query('select public.get_wedding_role() as role')).rows[0].role,null);
  assert.equal((await db.query('select * from public.wedding_state')).rows.length,0);
  assert.equal((await db.query('select * from public.wedding_invitation')).rows.length,1);
  await assert.rejects(db.query('select private.invitation_projection($1::jsonb)',[JSON.stringify(initialData)]), /permission denied/);
  await assert.rejects(db.query('select * from public.save_wedding_state($1,$2::jsonb)',[0,JSON.stringify(initialData)]),/Administrator/);
  await assert.rejects(db.query('select * from private.wedding_admins'));
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);`);
  await assert.rejects(db.query('select * from public.save_wedding_state($1,$2::jsonb)',[0,JSON.stringify(initialData)]),/Administrator/);
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`);
  assert.equal((await db.query('select public.get_wedding_role() as role')).rows[0].role.name,'송윤오');
  assert.equal((await db.query('select * from public.wedding_state')).rows.length,1);
  await assert.rejects(db.query("update public.wedding_invitation set data='{}'::jsonb"));
  const data={...initialData,budget:15000000};
  const saved=await db.query('select * from public.save_wedding_state($1,$2::jsonb)',[0,JSON.stringify(data)]);
  assert.equal(saved.rows[0].revision,1);assert.equal(saved.rows[0].data.budget,15000000);
  let tactical=saveExpense(data,null,{title:'본식 스냅',category:'본식 사진·영상',vendor:'테스트 업체',plannedAmount:1000,actualAmount:1200,priority:'필수',dueDate:'2027-05-20',notes:'부가세 포함'},'budget-contract');
  tactical=savePayment(tactical,'budget-contract',{id:'deposit',title:'계약금',amount:200,date:'2026-10-13',method:'계좌이체',payer:'공동'});
  const detailed=await db.query('select * from public.save_wedding_state($1,$2::jsonb)',[1,JSON.stringify(tactical)]);
  assert.equal(detailed.rows[0].revision,2);assert.deepEqual(detailed.rows[0].data.expenses,tactical.expenses);
  let decorated=saveHomeItem(tactical,null,{name:'거실 소파',room:'거실',category:'가구',priority:'필수',status:'구매 예정',quantity:1,plannedUnit:1200000,actualUnit:1100000,width:210,depth:90,height:85,color:'아이보리',material:'패브릭',placement:'거실 오른쪽 벽',productUrl:'https://example.com/sofa',deliveryDate:'2027-05-10',notes:'현관과 엘리베이터 폭 확인'},'home-sofa');
  decorated=setHomeBudget(decorated,10000000);
  decorated=linkHomeItemToBudget(decorated,'home-sofa');
  const homeSaved=await db.query('select * from public.save_wedding_state($1,$2::jsonb)',[2,JSON.stringify(decorated)]);
  assert.equal(homeSaved.rows[0].revision,3);
  assert.deepEqual(homeSaved.rows[0].data.home,decorated.home);
  assert.deepEqual(homeSaved.rows[0].data.expenses,decorated.expenses);
  let trip=saveHoneymoonSettings(decorated,{destination:'발리',startDate:'2027-05-24',endDate:'2027-05-30',budget:6000000,notes:'우붓과 남부 해변에서 휴식'});
  trip=saveHoneymoonItem(trip,null,{title:'우붓 숙소',category:'숙소',area:'우붓',status:'예약 완료',date:'2027-05-24',time:'15:00',endDate:'2027-05-27',vendor:'테스트 숙소',plannedAmount:1200000,actualAmount:1100000,productUrl:'https://example.com/ubud-stay',notes:'체크인 시간 확인'},'trip-ubud-stay');
  trip=saveHoneymoonPackingItem(trip,null,{title:'충전기',done:true},'trip-packing-charger');
  trip=linkHoneymoonItemToBudget(trip,'trip-ubud-stay');
  const tripSaved=await db.query('select * from public.save_wedding_state($1,$2::jsonb)',[3,JSON.stringify(trip)]);
  assert.equal(tripSaved.rows[0].revision,4);
  assert.deepEqual(tripSaved.rows[0].data,trip);
  assert.deepEqual(tripSaved.rows[0].data.home,decorated.home);
  assert.deepEqual(tripSaved.rows[0].data.expenses.slice(0,decorated.expenses.length),decorated.expenses);
  assert.deepEqual(tripSaved.rows[0].data.expenses.find(expense=>expense.id==='trip-trip-ubud-stay').payments,[]);
  const photo={id:'public-photo',url:'https://example.com/wedding.jpg',alt:'우리의 사진',privateContract:'never public'};
  const story={enabled:true,firstMetDate:'2020-02-29',firstMetText:'우리가 처음 만난 날',groomMessage:'함께할 날들을 기대합니다.',brideMessage:'매일 서로의 편이 되어 줄게요.',promise:'작은 행복을 함께 나누겠습니다.',futurePrivate:'private-story-token'};
  const invitation={groom:'신랑 이름',bride:'신부 이름',time:'14:30',greeting:'함께해 주세요.',heroPhoto:photo,gallery:[photo],directionsNote:'대중교통 이용을 권장합니다.',contactGroom:'010-1234-5678',contactBride:'',theme:'briller-night',story,budget:'private invitation unknown key'};
  const invited={...trip,date:'2027-05-23',invitation};
  const invitationSaved=await db.query('select * from public.save_wedding_state($1,$2::jsonb)',[4,JSON.stringify(invited)]);
  assert.equal(invitationSaved.rows[0].revision,5);assert.deepEqual(invitationSaved.rows[0].data,invited);
  const publicInvitation=(await db.query('select * from public.wedding_invitation')).rows[0];
  assert.equal(publicInvitation.revision,5);assert.equal(publicInvitation.data.date,invited.date);
  assert.equal(publicInvitation.data.groom,invitation.groom);assert.equal(publicInvitation.data.bride,invitation.bride);
  assert.deepEqual(publicInvitation.data.heroPhoto,{id:photo.id,url:photo.url,alt:photo.alt});
  assert.deepEqual(publicInvitation.data.gallery,[{id:photo.id,url:photo.url,alt:photo.alt}]);
  assert.equal(publicInvitation.data.theme,'briller-night');
  assert.deepEqual(publicInvitation.data,toPublicInvitation(invited));
  assert.deepEqual(Object.keys(publicInvitation.data.story).sort(),Object.keys(blankStory()).sort());
  assert.equal(JSON.stringify(publicInvitation.data).includes('private-story-token'),false);
  for(const key of ['budget','tasks','expenses','guests','home','honeymoon','saved']) assert.equal(Object.hasOwn(publicInvitation.data,key),false);
  assert.equal((await db.query('select * from public.save_wedding_state($1,$2::jsonb)',[0,JSON.stringify(initialData)])).rows.length,0);
  assert.deepEqual((await db.query('select * from public.wedding_invitation')).rows[0],publicInvitation);
  for(const invalid of [
    {...invited,budget:0},
    {...invited,date:'2027-02-30'},
    {...invited,invitation:{...invitation,time:'25:00'}},
    {...invited,invitation:{...invitation,groom:''}},
    {...invited,invitation:{...invitation,heroPhoto:{...photo,url:'javascript:alert(1)'}}},
    {...invited,invitation:{...invitation,heroPhoto:{...photo,url:'https://user:secret@example.com/photo'}}},
    {...invited,invitation:{...invitation,gallery:[photo,photo]}},
    {...invited,invitation:{...invitation,contactBride:'not a phone'}},
    {...invited,invitation:{...invitation,greeting:'x'.repeat(3001)}},
    {...invited,invitation:{...invitation,heroPhoto:{id:'missing-url',alt:''}}},
    ...['',null,'night',false,{},[]].map(theme=>({...invited,invitation:{...invitation,theme}})),
    ...[
      null,[],{},'story',
      {...story,enabled:'true'},
      {...story,firstMetDate:'2027-02-29'},
      {...story,firstMetDate:null},
      {...story,firstMetText:null},
      {...story,firstMetText:'x'.repeat(1001)},
      {...story,groomMessage:'x'.repeat(1001)},
      {...story,brideMessage:5},
      {...story,promise:[]},
    ].map(story=>({...invited,invitation:{...invitation,story}})),
  ]) await assert.rejects(db.query('select * from public.save_wedding_state($1,$2::jsonb)',[5,JSON.stringify(invalid)]),/Invalid/);
  assert.deepEqual((await db.query('select * from public.wedding_invitation')).rows[0],publicInvitation);
  await db.exec('reset role;');await db.exec(sql);
  const upgrade=await readFile(new URL('../supabase/invitation-upgrade.sql',import.meta.url),'utf8');
  await db.exec(upgrade);await db.exec(upgrade);
  const preserved=(await db.query('select data,revision from public.wedding_state')).rows[0];
  assert.equal(preserved.revision,5);assert.deepEqual(preserved.data,invited);
  await db.exec('set role anon;');
  await assert.rejects(db.query('select * from public.wedding_state'), /permission denied/);
  const anonymous=(await db.query('select * from public.wedding_invitation')).rows[0];
  assert.deepEqual(anonymous,publicInvitation);
 }finally{await db.close()}
});

test('story-only rollout preserves private records, policies and revisions and keeps hidden drafts private',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await db.exec(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
  const settings={groom:'송윤오',bride:'박예은',time:'',greeting:'우리의 결혼식에 초대합니다.',heroPhoto:null,gallery:[],directionsNote:'',contactGroom:'',contactBride:''};
  const draft={enabled:false,firstMetDate:'2020-02-29',firstMetText:'private-first-met-token',groomMessage:'private-groom-token',brideMessage:'private-bride-token',promise:'private-promise-token',futurePrivate:'private-story-future-token'};
  const privateData={...initialData,invitation:{...settings,theme:'briller-night',story:draft,futurePrivate:'private-invitation-future-token'}};
  await db.query("update public.wedding_state set data=$1::jsonb,revision=34,updated_at='2026-10-15T08:00:00Z' where id='main'",[JSON.stringify(privateData)]);
  const before=(await db.query('select * from public.wedding_state')).rows[0];
  // Simulate the already-deployed ten-field public envelope from the earlier frontend.
  await db.query("update public.wedding_invitation set data=$1::jsonb,revision=34,updated_at='2026-10-15T08:00:00Z' where id='main'",[JSON.stringify({date:privateData.date,...settings})]);
  const policies=(await db.query("select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by schemaname,tablename,policyname")).rows;
  const rpc=(await db.query("select pg_get_functiondef('public.save_wedding_state(bigint,jsonb)'::regprocedure) as definition")).rows[0];
  const upgrade=await readFile(new URL('../supabase/invitation-story-upgrade.sql',import.meta.url),'utf8');
  await db.exec(upgrade);await db.exec(upgrade);
  assert.deepEqual((await db.query('select * from public.wedding_state')).rows[0],before);
  assert.deepEqual((await db.query("select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by schemaname,tablename,policyname")).rows,policies);
  assert.deepEqual((await db.query("select pg_get_functiondef('public.save_wedding_state(bigint,jsonb)'::regprocedure) as definition")).rows[0],rpc);
  const published=(await db.query('select * from public.wedding_invitation')).rows[0];
  assert.equal(published.revision,34);assert.deepEqual(published.updated_at,before.updated_at);
  assert.deepEqual(published.data,toPublicInvitation(privateData));
  assert.deepEqual(published.data.story,blankStory());
  assert.equal(JSON.stringify(published.data).includes('private-'),false);
  // A concurrent save can publish a newer revision while rollout reads its
  // snapshot. Reseeding must never roll that public revision back.
  await db.exec("update public.wedding_invitation set revision=35,data=jsonb_set(data,'{greeting}','\"newer public revision\"'::jsonb) where id='main'");
  const newerPublic=(await db.query('select * from public.wedding_invitation')).rows[0];
  await db.exec(upgrade);
  assert.deepEqual((await db.query('select * from public.wedding_invitation')).rows[0],newerPublic);
  assert.deepEqual((await db.query('select * from public.wedding_state')).rows[0],before);
  const enabled={...privateData,invitation:{...privateData.invitation,story:{...draft,enabled:true}}};
  assert.deepEqual((await db.query('select private.invitation_projection($1::jsonb) as data',[JSON.stringify(enabled)])).rows[0].data,toPublicInvitation(enabled));
  assert.equal((await db.query('select private.valid_invitation_settings($1::jsonb) as valid',[JSON.stringify(settings)])).rows[0].valid,true);
  assert.deepEqual((await db.query('select private.invitation_projection($1::jsonb) as data',[JSON.stringify({...initialData,invitation:settings})])).rows[0].data,toPublicInvitation({...initialData,invitation:settings}));
  await db.exec('set role anon;');
  await assert.rejects(db.query('select * from public.wedding_state'),/permission denied/);
  await assert.rejects(db.query('select private.valid_invitation_story($1::jsonb)',[JSON.stringify(draft)]),/permission denied/);
  assert.deepEqual((await db.query('select data from public.wedding_invitation')).rows[0].data.story,blankStory());
 }finally{await db.close()}
});

test('two-phase invitation upgrade preserves records and only approved admins manage public photos',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
    grant usage on schema public to anon,authenticated;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users values
      ('00000000-0000-0000-0000-000000000001','admin@example.com',now()),
      ('00000000-0000-0000-0000-000000000002','guest@example.com',now());
    create schema private;
    create table private.wedding_admins(email text primary key,name text);
    insert into private.wedding_admins values ('admin@example.com','송윤오');
    revoke all on schema private from public,anon,authenticated;
    create function private.is_wedding_admin() returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from auth.users u join private.wedding_admins a on lower(u.email)=a.email where u.id=auth.uid() and u.email_confirmed_at is not null);
    $$;
    revoke all on function private.is_wedding_admin() from public,anon,authenticated;
    create table public.wedding_state(id text primary key,data jsonb not null,revision bigint not null default 0,updated_at timestamptz not null default now());
    alter table public.wedding_state enable row level security;
    grant select on public.wedding_state to anon,authenticated;
    create policy wedding_read on public.wedding_state for select to anon,authenticated using (id='main');
    create schema storage;grant usage on schema storage to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id text primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  const prior={...initialData,date:'2027-06-13',budget:31000000,invitation:{groom:'malformed missing fields',budget:'must stay private'}};
  await db.query("insert into public.wedding_state(id,data,revision,updated_at) values ('main',$1::jsonb,17,'2026-10-15T00:00:00Z')",[JSON.stringify(prior)]);
  const before=(await db.query('select * from public.wedding_state')).rows[0];
  const prep=await readFile(new URL('../supabase/invitation-prepare.sql',import.meta.url),'utf8');
  await db.exec(prep);await db.exec(prep);
  assert.deepEqual((await db.query('select * from public.wedding_state')).rows[0],before);
  const bucket=(await db.query("select * from storage.buckets where id='wedding-invitation'")).rows[0];
  assert.equal(bucket.public,true);assert.equal(bucket.file_size_limit,10485760);
  assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp','image/avif']);
  await db.exec('set role anon;');
  assert.equal((await db.query('select * from public.wedding_state')).rows.length,1); // Preparation leaves the old frontend working.
  const publicSeed=(await db.query('select * from public.wedding_invitation')).rows[0];
  assert.equal(publicSeed.revision,17);assert.equal(publicSeed.data.date,prior.date);
  assert.equal(publicSeed.data.groom,'송윤오');assert.equal(publicSeed.data.bride,'박예은');
  assert.equal(Object.hasOwn(publicSeed.data,'budget'),false);
  await assert.rejects(db.query("insert into storage.objects values ('unauthorized','wedding-invitation','photo.jpg')"),/row-level security/);
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);");
  await assert.rejects(db.query("insert into storage.objects values ('unauthorized','wedding-invitation','photo.jpg')"),/row-level security/);
  await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);");
  await db.exec("insert into storage.objects values ('approved','wedding-invitation','photo.jpg');update storage.objects set name='replacement.jpg' where id='approved';");
  assert.equal((await db.query("select name from storage.objects where id='approved'")).rows[0].name,'replacement.jpg');
  await assert.rejects(db.query("update storage.objects set bucket_id='private-contracts' where id='approved'"),/row-level security/);
  await db.exec("reset role;set role anon;");
  assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  assert.equal((await db.query("delete from storage.objects where id='approved' returning *")).rows.length,0);
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);");
  assert.equal((await db.query("update storage.objects set name='unauthorized.jpg' where id='approved' returning *")).rows.length,0);
  await db.exec('reset role;');
  const final=await readFile(new URL('../supabase/invitation-upgrade.sql',import.meta.url),'utf8');
  await db.exec(final);await db.exec(final);
  assert.deepEqual((await db.query('select * from public.wedding_state')).rows[0],before);
  await db.exec('set role anon;');
  await assert.rejects(db.query('select * from public.wedding_state'),/permission denied/);
  assert.deepEqual((await db.query('select * from public.wedding_invitation')).rows[0],publicSeed);
  await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);");
  await db.exec("delete from storage.objects where id='approved';");
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 }finally{await db.close()}
});
