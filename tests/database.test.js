import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {initialData} from '../app/src/model.js';

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
  assert.equal((await db.query('select * from public.save_wedding_state($1,$2::jsonb)',[0,JSON.stringify(initialData)])).rows.length,0);
  await assert.rejects(db.query('select * from public.save_wedding_state($1,$2::jsonb)',[1,JSON.stringify({...data,budget:0})]),/Invalid/);
  await db.exec('reset role;');await db.exec(sql);
  assert.equal((await db.query('select data from public.wedding_state')).rows[0].data.budget,15000000);
 }finally{await db.close()}
});
