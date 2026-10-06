import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData} from '../app/src/model.js';
import {createSynchronizer} from '../app/src/sync-core.js';

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
