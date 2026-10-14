import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {initialData} from '../app/src/model.js';
import {saveExpense,savePayment} from '../app/src/budget-model.js';
import {saveHomeItem,setHomeBudget,linkHomeItemToBudget} from '../app/src/home-model.js';
import {saveHoneymoonSettings,saveHoneymoonItem,saveHoneymoonPackingItem,linkHoneymoonItemToBudget} from '../app/src/honeymoon-model.js';

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
  assert.equal((await db.query('select * from public.wedding_state')).rows.length,1);
  await assert.rejects(db.query('update public.wedding_state set revision=999'));
  await assert.rejects(db.query("select * from public.save_wedding_state(0,'{}'::jsonb)"));
  await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`);
  assert.equal((await db.query('select public.get_wedding_role() as role')).rows[0].role,null);
  await assert.rejects(db.query('select * from public.save_wedding_state($1,$2::jsonb)',[0,JSON.stringify(initialData)]),/Administrator/);
  await assert.rejects(db.query('select * from private.wedding_admins'));
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);`);
  await assert.rejects(db.query('select * from public.save_wedding_state($1,$2::jsonb)',[0,JSON.stringify(initialData)]),/Administrator/);
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`);
  assert.equal((await db.query('select public.get_wedding_role() as role')).rows[0].role.name,'송윤오');
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
  assert.equal((await db.query('select * from public.save_wedding_state($1,$2::jsonb)',[0,JSON.stringify(initialData)])).rows.length,0);
  await assert.rejects(db.query('select * from public.save_wedding_state($1,$2::jsonb)',[1,JSON.stringify({...data,budget:0})]),/Invalid/);
  await db.exec('reset role;');await db.exec(sql);
  const preserved=(await db.query('select data,revision from public.wedding_state')).rows[0];
  assert.equal(preserved.revision,4);assert.deepEqual(preserved.data,trip);
 }finally{await db.close()}
});
