import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData} from '../app/src/model.js';
import {createSynchronizer} from '../app/src/sync-core.js';
import {saveExpense,savePayment,expenseTotals} from '../app/src/budget-model.js';

function sharedBackend(){
 let row={revision:0,data:structuredClone(initialData)},failNext=false;const listeners=new Set();
 return {read:async()=>structuredClone(row),write:async(revision,data)=>{if(failNext){failNext=false;throw Error('Network failure')}if(row.revision!==revision)return null;row={revision:revision+1,data:structuredClone(data)};for(const fn of listeners)fn(structuredClone(row));return structuredClone(row)},listen(onData){listeners.add(onData);return ()=>listeners.delete(onData)},fail(){failNext=true},broadcast(row){for(const fn of listeners)fn(row)}};
}
test('concurrent devices retain both edits and receive realtime updates',async()=>{
 const backend=sharedBackend();let first,second;
 const a=createSynchronizer(backend,{onData:data=>first=data,onStatus(){},onError(){}});
 const b=createSynchronizer(backend,{onData:data=>second=data,onStatus(){},onError(){}});
 await Promise.all([a.start(),b.start()]);
 await Promise.all([a.change(data=>({...data,expenses:[...data.expenses,{id:'a',title:'예약금',category:'기타',amount:100}]})),b.change(data=>({...data,guests:[...data.guests,{id:'b',name:'친구',side:'함께',status:'참석'}]}))]);
 assert.equal(first.expenses.length,1);assert.equal(first.guests.length,1);assert.deepEqual(first,second);
 backend.broadcast({revision:0,data:initialData});assert.equal(first.guests.length,1);
 a.stop();b.stop();
});
test('failed writes preserve data and later writes remain possible',async()=>{
 const backend=sharedBackend();let data;const errors=[];
 const sync=createSynchronizer(backend,{onData:next=>data=next,onStatus(){},onError:error=>errors.push(error.message)});await sync.start();
 backend.fail();await assert.rejects(sync.change(old=>({...old,budget:200})),/Network failure/);
 assert.equal(data.budget,initialData.budget);
 await sync.change(old=>({...old,budget:400}));assert.equal(data.budget,400);
 await assert.rejects(sync.change(old=>({...old,budget:-1})),/형식/);assert.equal(data.budget,400);assert.equal(errors.length,2);sync.stop();
});
test('simultaneous deposits on one contract preserve both payments',async()=>{
 const backend=sharedBackend();let first,second;
 const a=createSynchronizer(backend,{onData:data=>first=data,onStatus(){},onError(){}}),b=createSynchronizer(backend,{onData:data=>second=data,onStatus(){},onError(){}});
 await Promise.all([a.start(),b.start()]);
 await a.change(data=>saveExpense(data,null,{title:'본식 스냅',category:'본식 사진·영상',vendor:'',plannedAmount:1000,actualAmount:1000,priority:'필수',dueDate:'',notes:''},'contract'));
 const payment={title:'중도금',date:'2026-10-13',method:'계좌이체',payer:'공동'};
 await Promise.all([a.change(data=>savePayment(data,'contract',{...payment,id:'payment-a',amount:200})),b.change(data=>savePayment(data,'contract',{...payment,id:'payment-b',amount:300}))]);
 assert.equal(first.expenses[0].payments.length,2);assert.equal(expenseTotals(first.expenses[0]).paid,500);assert.equal(expenseTotals(first.expenses[0]).outstanding,500);assert.deepEqual(first,second);a.stop();b.stop();
});

test('leaving during a private read prevents late subscriptions and pending writes',async()=>{
 let release,subscriptions=0,writes=0,delivered=0;
 const backend={read:()=>new Promise(resolve=>{release=()=>resolve({revision:0,data:structuredClone(initialData)})}),listen(){subscriptions++;return()=>{}},async write(){writes++;return null}};
 const sync=createSynchronizer(backend,{onData(){delivered++},onStatus(){},onError(){}});
 const starting=sync.start();sync.stop();release();await starting;
 assert.equal(subscriptions,0);assert.equal(delivered,0);
 const editing=createSynchronizer(backend,{onData(){delivered++},onStatus(){},onError(){}});
 const pending=editing.change(current=>({...current,budget:100}));
 await Promise.resolve();editing.stop();release();
 await assert.rejects(pending,/종료/);assert.equal(writes,0);assert.equal(delivered,0);
});
