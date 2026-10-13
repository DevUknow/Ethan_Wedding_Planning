import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,validBackup,totals} from '../app/src/model.js';
import {budgetSummary,expenseTotals,normalizeExpense,saveExpense,savePayment,deletePayment,categorySummary,paymentJournal,addTemplateItems,budgetCsv,validBudgetDate} from '../app/src/budget-model.js';
const fields={title:'브리에홀 대관료',category:'웨딩홀',vendor:'더파티움 안양',plannedAmount:1000,actualAmount:1200,priority:'필수',dueDate:'2027-05-10',notes:'부가세 포함'};
const deposit={id:'p1',title:'계약금',amount:200,date:'2026-10-13',method:'계좌이체',payer:'공동'};
function itemData(){return saveExpense({...structuredClone(initialData),budget:2000},null,fields,'e1')}

test('plans, confirmed costs and payments are separate and do not double count',()=>{
 let data=itemData();data=savePayment(data,'e1',deposit);
 data=saveExpense(data,null,{...fields,title:'여행 계획',category:'신혼여행',plannedAmount:500,actualAmount:null},'e2');
 assert.deepEqual(budgetSummary(data,'2027-05-01'),{planned:1500,confirmed:1200,projected:1700,paid:200,outstanding:1000,unconfirmed:500,overdue:0,available:300,unallocated:500});
 assert.equal(totals(data).spent,200);assert.equal(totals(data).remaining,1800);assert.equal(validBackup(data),true);
 assert.equal(expenseTotals(data.expenses[0],'2027-05-11').overdue,true);
 assert.equal(expenseTotals(data.expenses[0],'2027-05-10').overdue,false);
});
test('legacy payments retain amount and unknown date, and can become a partial contract',()=>{
 const old={id:'old',title:'계약금',category:'웨딩홀',amount:200};
 const data={...initialData,expenses:[old]};
 assert.equal(expenseTotals(old).paid,200);assert.equal(expenseTotals(old).status,'결제 완료');
 const next=saveExpense(data,'old',fields);
 assert.equal(next.expenses[0].payments[0].amount,200);assert.equal(next.expenses[0].payments[0].date,'');
 assert.equal(expenseTotals(next.expenses[0]).outstanding,1000);assert.equal(validBackup(next),true);
 assert.deepEqual(data.expenses,[old]);
});
test('payment changes recompute balances and reject overpayment and reduced contracts',()=>{
 let data=savePayment(itemData(),'e1',deposit);
 data=savePayment(data,'e1',{...deposit,id:'p2',title:'잔금',amount:1000});
 assert.equal(expenseTotals(data.expenses[0]).status,'결제 완료');
 assert.throws(()=>savePayment(data,'e1',{...deposit,id:'p3',amount:1}),/넘습니다/);
 assert.throws(()=>saveExpense(data,'e1',{...fields,actualAmount:1000}),/이미 결제/);
 assert.throws(()=>saveExpense(data,'e1',{...fields,actualAmount:null}),/이미 결제/);
 data=savePayment(data,'e1',{...deposit,id:'p1',amount:100},'p1');
 assert.equal(expenseTotals(data.expenses[0]).outstanding,100);
 data=deletePayment(data,'e1','p2');assert.equal(expenseTotals(data.expenses[0]).outstanding,1100);
 assert.equal(validBackup(data),true);
});
test('zero placeholders and confirmed free items work and malformed extended backups fail',()=>{
 const planned=saveExpense(initialData,null,{...fields,plannedAmount:0,actualAmount:null},'zero');
 assert.equal(validBackup(planned),true);assert.equal(expenseTotals(planned.expenses[0]).status,'계획 중');
 const free=saveExpense(initialData,null,{...fields,plannedAmount:50,actualAmount:0},'free');
 assert.equal(expenseTotals(free.expenses[0]).projected,0);assert.equal(expenseTotals(free.expenses[0]).status,'결제 완료');
 for(const mutation of [{plannedAmount:-1},{actualAmount:NaN},{dueDate:'2027-02-30'},{amount:999},{payments:[deposit,deposit]}]) assert.equal(validBackup({...planned,expenses:[{...planned.expenses[0],...mutation}]}),false);
 assert.equal(validBudgetDate('2028-02-29'),true);assert.equal(validBudgetDate('2027-02-29'),false);
 assert.throws(()=>savePayment(planned,'zero',deposit),/먼저 입력/);
});
test('category aggregates and journal use payments once; CSV escapes unsafe text',()=>{
 let data=savePayment(itemData(),'e1',deposit);
 data=saveExpense(data,null,{...fields,title:'=HYPERLINK("test")',actualAmount:null},'e2');
 assert.deepEqual(categorySummary(data.expenses)[0],{category:'웨딩홀',count:2,planned:2000,projected:2200,paid:200,outstanding:1000});
 assert.equal(paymentJournal(data.expenses).length,1);assert.equal(paymentJournal(data.expenses)[0].itemTitle,fields.title);
 const csv=budgetCsv(data.expenses);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('"부가세 포함"'));
 assert.ok(budgetCsv(data.expenses,'payments').includes('"200"'));
});
test('template insertion is explicit, deduplicated and never replaces actual expenses',()=>{
 const original=itemData();const ids={'0':'template-0','1':'template-1'};
 const first=addTemplateItems(original,['0','1'],ids),second=addTemplateItems(first,['0','1'],ids);
 assert.equal(first.expenses.length,3);assert.deepEqual(second,first);assert.deepEqual(first.expenses[0],original.expenses[0]);
 assert.equal(validBackup(first),true);assert.equal(budgetSummary(first).paid,0);
});
test('editing fields retains newer payments and stale deletions are not resurrected',()=>{
 const data=savePayment(itemData(),'e1',deposit);
 const next=saveExpense(data,'e1',{...fields,vendor:'수정된 업체'});
 assert.equal(next.expenses[0].payments.length,1);assert.equal(next.expenses[0].vendor,'수정된 업체');
 assert.throws(()=>saveExpense({...data,expenses:[]},'e1',fields),/삭제된 항목/);
 assert.throws(()=>savePayment(data,'e1',{...deposit,id:'missing'},'missing'),/삭제된 결제/);
});
