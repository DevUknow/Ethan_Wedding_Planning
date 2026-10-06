import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,totals,daysUntil,validBackup,upgradeData} from '../app/src/model.js';
test('date countdown uses calendar days and supports past dates',()=>{const today=new Date(2026,9,7,23,50);assert.equal(daysUntil('2026-10-08',today),1);assert.equal(daysUntil('2026-10-06',today),-1);assert.equal(daysUntil('',today),null)});
test('budget totals include overspending, task and guest counts',()=>{const data={...initialData,budget:100,expenses:[{amount:75},{amount:50}],tasks:[{done:true},{done:false}],guests:[{status:'참석'},{status:'불참'}]};assert.deepEqual(totals(data),{spent:125,remaining:-25,completed:1,confirmed:1})});
test('backup validation accepts data and rejects malformed records',()=>{assert.equal(validBackup(initialData),true);assert.equal(validBackup({...initialData,expenses:[{amount:'invalid'}]}),false);assert.equal(validBackup({...initialData,guests:[{id:'x',name:'a',side:'함께',status:'invalid'}]}),false);assert.equal(validBackup(null),false)});

test('upgrading the placeholder couple name preserves existing wedding records',()=>{const previous={...initialData,couple:'Ethan & You',date:'2027-02-14',budget:20000000,expenses:[{id:'e',title:'예약금',category:'웨딩홀',amount:500000}]};const next=upgradeData(previous);assert.equal(next.couple,'송윤오 ♥ 박예은');assert.equal(next.date,previous.date);assert.equal(next.budget,previous.budget);assert.deepEqual(next.expenses,previous.expenses);assert.equal(upgradeData({...previous,couple:'내가 저장한 이름'}).couple,'내가 저장한 이름')});
