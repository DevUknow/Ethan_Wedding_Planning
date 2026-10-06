import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,totals,daysUntil,validBackup} from '../src/model.js';
test('date countdown uses calendar days and supports past dates',()=>{const today=new Date(2026,9,7,23,50);assert.equal(daysUntil('2026-10-08',today),1);assert.equal(daysUntil('2026-10-06',today),-1);assert.equal(daysUntil('',today),null)});
test('budget totals include overspending, task and guest counts',()=>{const data={...initialData,budget:100,expenses:[{amount:75},{amount:50}],tasks:[{done:true},{done:false}],guests:[{status:'참석'},{status:'불참'}]};assert.deepEqual(totals(data),{spent:125,remaining:-25,completed:1,confirmed:1})});
test('backup validation accepts data and rejects malformed records',()=>{assert.equal(validBackup(initialData),true);assert.equal(validBackup({...initialData,expenses:[{amount:'invalid'}]}),false);assert.equal(validBackup({...initialData,guests:[{id:'x',name:'a',side:'함께',status:'invalid'}]}),false);assert.equal(validBackup(null),false)});
