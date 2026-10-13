import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,validBackup} from '../app/src/model.js';
import {saveExpense,savePayment,expenseTotals} from '../app/src/budget-model.js';
import {homeRooms,homeCategories,homeStatuses,homeTemplate,getHome,getHomeRooms,getHomeTemplate,upgradeHomeData,addHomeRoom,renameHomeRoom,validHome,homeItemTotals,homeSummary,saveHomeItem,setHomeBudget,deleteHomeItem,addHomeTemplateItems,linkHomeItemToBudget} from '../app/src/home-model.js';

const fields = {name:'식탁 의자',room:'주방·다이닝',category:'가구',priority:'필수',status:'구매 예정',quantity:4,plannedUnit:100000,actualUnit:null,width:45,depth:50,height:80,color:'오크',material:'원목',placement:'식탁 옆',productUrl:'https://example.com/chair',deliveryDate:'2027-04-01',notes:'문 폭과 배송 동선 확인',expenseId:''};
const payment = {id:'p1',title:'주문 계약금',amount:100000,date:'2026-10-13',method:'카드',payer:'공동'};
function itemData(overrides = {}) { return saveHomeItem(structuredClone(initialData),null,{...fields,...overrides},'chair'); }

test('old backups have an empty home view without mutation or mandatory migration',()=>{
  const data = structuredClone(initialData);
  delete data.home;
  const before = structuredClone(data);
  assert.equal(Object.hasOwn(data,'home'),false);
  assert.deepEqual(getHome(data),{budget:0,items:[],rooms:homeRooms,roomVersion:2,templateRooms:{}});
  assert.deepEqual(homeSummary(data),{budget:0,planned:0,confirmed:0,projected:0,available:0,unallocated:0,count:0,installed:0,ordered:0,linked:0});
  assert.deepEqual(data,before);
  assert.equal(validBackup(data),true);
  assert.equal(validBackup({...data,home:null}),false);
  assert.equal(validBackup({...data,home:{budget:-1,items:[]}}),false);
  assert.equal(validHome(getHome(data)),true);
  assert.deepEqual(getHome(data).items,[]);
  assert.deepEqual(homeRooms,['거실','안방','큰방','작은방','화장실','세탁실','베란다']);
  assert.equal(upgradeHomeData(data),data);
  assert.ok(homeCategories.includes(fields.category));
  assert.ok(homeStatuses.includes(fields.status));
});
test('quantity math distinguishes estimates, known prices and free purchases',()=>{
  let data = setHomeBudget(itemData(),1000000);
  assert.deepEqual(homeItemTotals(data.home.items[0]),{planned:400000,actual:null,projected:400000,variance:0});
  data = saveHomeItem(data,'chair',{actualUnit:90000,status:'설치 완료'});
  assert.deepEqual(homeItemTotals(data.home.items[0]),{planned:400000,actual:360000,projected:360000,variance:-40000});
  assert.deepEqual(homeSummary(data),{budget:1000000,planned:400000,confirmed:360000,projected:360000,available:640000,unallocated:600000,count:1,installed:1,ordered:1,linked:0});
  data = saveHomeItem(data,'chair',{actualUnit:0});
  assert.equal(homeItemTotals(data.home.items[0]).projected,0);
  assert.equal(validHome(data.home),true);
});
test('home validation rejects malformed money, dates, dimensions and unsafe URLs',()=>{
  const data = itemData();
  for (const mutation of [{quantity:0},{quantity:1001},{quantity:1.5},{plannedUnit:-1},{plannedUnit:0.5},{actualUnit:NaN},{actualUnit:undefined},{plannedUnit:1000000000000},{actualUnit:1000000000000},{width:0},{depth:Infinity},{height:100001},{height:undefined},{name:' '},{room:'x'.repeat(41)},{category:'없음'},{priority:'긴급'},{status:'취소'},{deliveryDate:'2027-02-29'},{deliveryDate:'2027-02-30'},{productUrl:'javascript:alert(1)'},{productUrl:'data:text/plain,test'},{productUrl:'file:///tmp/test'},{productUrl:'https://user:password@example.com'},{productUrl:'https://example.com/a b'},{productUrl:'not-a-url'},{expenseId:12}]) {
    assert.equal(validHome({...data.home,items:[{...data.home.items[0],...mutation}]}),false,JSON.stringify(mutation));
    if (!Object.hasOwn(mutation,'expenseId')) assert.throws(()=>saveHomeItem(data,'chair',mutation));
  }
  assert.equal(validHome({...data.home,items:[{...data.home.items[0],productUrl:'',deliveryDate:'2028-02-29',width:0.5}]}),true);
  for (const home of [null,[],{budget:-1,items:[]},{budget:NaN,items:[]},{budget:1000000000001,items:[]},{budget:0.5,items:[]},{budget:0,items:null},{...data.home,items:[data.home.items[0],data.home.items[0]]}]) assert.equal(validHome(home),false);
  for (const amount of [-1,NaN,Infinity,0.5,1000000000001]) assert.throws(()=>setHomeBudget(data,amount));
  assert.equal(setHomeBudget(data,0).home.budget,0);
  assert.equal(setHomeBudget(data,1000000000000).home.budget,1000000000000);
});
test('home mutations preserve other records and latest links, and reject stale resurrection',()=>{
  const original = itemData();
  const linked = linkHomeItemToBudget(original,'chair');
  const next = saveHomeItem(linked,'chair',{name:'편한 의자',expenseId:'stale-link'});
  assert.equal(next.home.items[0].expenseId,'home-chair');
  assert.equal(next.home.items[0].name,'편한 의자');
  assert.equal(next.expenses,linked.expenses);
  assert.equal(original.home.items[0].name,fields.name);
  assert.equal(original.home.items[0].expenseId,'');
  assert.equal(original.expenses.length,0);
  assert.throws(()=>saveHomeItem(next,null,fields,'chair'),/이미 존재/);
  assert.throws(()=>saveHomeItem(deleteHomeItem(next,'chair'),'chair',fields),/삭제된 신혼집/);
  assert.throws(()=>linkHomeItemToBudget(deleteHomeItem(next,'chair'),'chair'),/삭제된 신혼집/);
  assert.equal(deleteHomeItem(original,'missing'),original);
  assert.equal(saveHomeItem(initialData,null,{...fields,expenseId:'do-not-link'},'new').home.items[0].expenseId,'');
});
test('templates add selected room and name pairs once without assigning prices',()=>{
  assert.ok(homeTemplate.length>=15 && homeTemplate.length<=20);
  assert.ok(homeTemplate.every(item => Object.keys(item).sort().join(',')==='category,key,name,room'));
  const ids = Object.fromEntries(homeTemplate.map(item => [item.key,`template-${item.key}`]));
  const keys = homeTemplate.map(item => item.key);
  const first = addHomeTemplateItems(initialData,keys,ids);
  const second = addHomeTemplateItems(first,keys,ids);
  assert.equal(first.home.items.length,homeTemplate.length);
  assert.equal(second,first);
  assert.equal(validHome(first.home),true);
  assert.equal(homeSummary(first).projected,0);
  assert.ok(first.home.items.every(item => item.plannedUnit===0 && item.actualUnit===null && item.expenseId===''));
  assert.equal(first.expenses,initialData.expenses);
  assert.deepEqual(addHomeTemplateItems(initialData,[],ids),upgradeHomeData(initialData));
  const suggestion = homeTemplate[0];
  const manual = saveHomeItem(initialData,null,{...fields,name:` ${suggestion.name} `,room:` ${suggestion.room} `,category:suggestion.category},'manual');
  assert.equal(addHomeTemplateItems(manual,[suggestion.key],ids),manual);
  assert.throws(()=>addHomeTemplateItems(initialData,[suggestion.key],{}));
});
test('explicit budget links are idempotent, preserve payments and keep separate budget metadata',()=>{
  let data = itemData({actualUnit:110000});
  assert.equal(data.expenses.length,0);
  data = linkHomeItemToBudget(data,'chair');
  assert.equal(data.expenses.length,1);
  assert.equal(data.expenses[0].homeItemId,'chair');
  assert.equal(data.expenses[0].id,'home-chair');
  assert.equal(data.expenses[0].category,'신혼집');
  assert.ok(data.expenses[0].title.includes(fields.room));
  assert.equal(data.expenses[0].plannedAmount,400000);
  assert.equal(data.expenses[0].actualAmount,440000);
  assert.deepEqual(data.expenses[0].payments,[]);
  data = saveExpense(data,'home-chair',{...data.expenses[0],vendor:'가구점',dueDate:'2027-03-20',notes:'배송료 포함'});
  data = savePayment(data,'home-chair',payment);
  data = saveHomeItem(data,'chair',{name:'원목 의자',actualUnit:120000,notes:'새 품목 메모',deliveryDate:'2027-03-25'});
  assert.equal(data.expenses[0].actualAmount,440000);
  data = linkHomeItemToBudget(data,'chair');
  data = linkHomeItemToBudget(data,'chair');
  assert.equal(data.expenses.length,1);
  assert.equal(data.expenses[0].actualAmount,480000);
  assert.equal(data.expenses[0].title,'주방·다이닝 · 원목 의자');
  assert.equal(data.expenses[0].vendor,'가구점');
  assert.equal(data.expenses[0].dueDate,'2027-03-20');
  assert.equal(data.expenses[0].notes,'배송료 포함');
  assert.deepEqual(data.expenses[0].payments,[payment]);
  assert.equal(homeSummary(data).linked,1);
  assert.equal(validHome(data.home),true);
  assert.equal(validBackup(data),true);
});
test('budget linking enforces the paid floor, blocks collisions, and creates no paid records',()=>{
  let data = linkHomeItemToBudget(itemData({actualUnit:110000}),'chair');
  data = savePayment(data,'home-chair',payment);
  const smaller = saveHomeItem(data,'chair',{actualUnit:10000});
  assert.throws(()=>linkHomeItemToBudget(smaller,'chair'),/이미 결제/);
  const unknown = saveHomeItem(data,'chair',{actualUnit:null});
  assert.throws(()=>linkHomeItemToBudget(unknown,'chair'),/이미 결제/);
  assert.equal(expenseTotals(data.expenses[0]).paid,100000);
  const collision = {...itemData(),expenses:[{...data.expenses[0],homeItemId:'another'}]};
  assert.throws(()=>linkHomeItemToBudget(collision,'chair'),/다른 항목/);
  const missingMarker = {...itemData(),expenses:[{...data.expenses[0],homeItemId:undefined}]};
  assert.throws(()=>linkHomeItemToBudget(missingMarker,'chair'),/다른 항목/);
  let sharedId = saveHomeItem(itemData(),null,{...fields,name:'다른 의자'},'another');
  sharedId = {...sharedId,home:{...sharedId.home,items:sharedId.home.items.map(item => item.id==='another' ? {...item,expenseId:'home-chair'} : item)}};
  assert.throws(()=>linkHomeItemToBudget(sharedId,'chair'),/다른 항목/);
  const planned = linkHomeItemToBudget(itemData(),'chair');
  assert.equal(planned.expenses[0].actualAmount,null);
  assert.equal(expenseTotals(planned.expenses[0]).paid,0);
  const dangling = {...planned,expenses:[]};
  const recreated = linkHomeItemToBudget(dangling,'chair');
  assert.equal(recreated.expenses.length,1);
  assert.equal(recreated.expenses[0].id,'home-chair');
  assert.deepEqual(recreated.expenses[0].payments,[]);
  const longest = saveHomeItem(initialData,null,{...fields,name:'의자'.repeat(50),room:'방'.repeat(40)},'a'.repeat(95));
  assert.equal(linkHomeItemToBudget(longest,'a'.repeat(95)).expenses[0].id.length,100);
  assert.equal(linkHomeItemToBudget(longest,'a'.repeat(95)).expenses[0].title.length,100);
  assert.throws(()=>saveHomeItem(initialData,null,fields,'a'.repeat(96)));
});
test('deleting a linked home item retains its expense and payment history',()=>{
  const linked = savePayment(linkHomeItemToBudget(itemData({actualUnit:110000}),'chair'),'home-chair',payment);
  const next = deleteHomeItem(linked,'chair');
  assert.equal(next.home.items.length,0);
  assert.equal(next.expenses,linked.expenses);
  assert.equal(next.expenses.length,1);
  assert.deepEqual(next.expenses[0].payments,[payment]);
  assert.equal(expenseTotals(next.expenses[0]).paid,100000);
  assert.equal(validHome(next.home),true);
  assert.equal(validBackup(next),true);
});
test('legacy home spaces and starter names upgrade once without changing costs or purchases',()=>{
  const oldNames = {'3':'침실 커튼','17':'욕실 수납·용품'};
  const oldRooms = {안방:'침실',작은방:'서재·작업실',화장실:'욕실',세탁실:'베란다·다용도실'};
  const items = homeTemplate.map(suggestion => ({...fields,id:`old-${suggestion.key}`,name:oldNames[suggestion.key] ?? suggestion.name,room:oldRooms[suggestion.room] ?? suggestion.room,category:suggestion.category,plannedUnit:200000,actualUnit:180000,expenseId:''}));
  items.push({...fields,id:'veranda',name:'빨래 건조대',room:'베란다·다용도실'});
  items.push({...fields,id:'custom',name:'내 침실 협탁',room:'침실'});
  items.push({...fields,id:'custom-space',name:'아끼는 의자',room:' 취미방 '});
  items[3].expenseId='home-old-3';
  let data = {...structuredClone(initialData),home:{budget:9000000,items}};
  data = saveExpense(data,null,{homeItemId:'old-3',title:'침실 · 침실 커튼',category:'신혼집',plannedAmount:800000,actualAmount:720000,priority:'필수',vendor:'기존 업체',dueDate:'2027-04-01',notes:'기존 계약'},'home-old-3');
  data = savePayment(data,'home-old-3',payment);
  const before = structuredClone(data);
  const view = getHome(data);
  assert.deepEqual(data,before);
  assert.deepEqual(view.rooms,[...homeRooms,'주방·다이닝','현관','취미방']);
  for (const suggestion of homeTemplate) {
    const item = view.items.find(item => item.id === `old-${suggestion.key}`);
    assert.equal(item.room,suggestion.room);
    assert.equal(item.name,suggestion.name);
    assert.equal(item.templateKey,suggestion.key);
    assert.equal(item.plannedUnit,200000);
    assert.equal(item.actualUnit,180000);
  }
  assert.equal(view.items.find(item => item.id==='veranda').room,'베란다');
  assert.equal(view.items.find(item => item.id==='custom').name,'내 침실 협탁');
  const next = upgradeHomeData(data);
  assert.equal(next.home.budget,9000000);
  assert.equal(next.expenses[0].title,'안방 · 안방 커튼');
  assert.deepEqual({...next.expenses[0],title:before.expenses[0].title},before.expenses[0]);
  assert.equal(validBackup(next),true);
  assert.equal(upgradeHomeData(next),next);
  assert.equal(getHome(next),next.home);
  const customTitle = {...data,expenses:[{...data.expenses[0],title:'커튼 계약 (직접 정한 이름)'}]};
  assert.equal(upgradeHomeData(customTitle).expenses,customTitle.expenses);
  const otherOrigin = {...data,expenses:[{...data.expenses[0],homeItemId:'another'}]};
  assert.equal(upgradeHomeData(otherOrigin).expenses,otherOrigin.expenses);
  const ids = Object.fromEntries(homeTemplate.map(item => [item.key,`again-${item.key}`]));
  assert.equal(addHomeTemplateItems(next,homeTemplate.map(item => item.key),ids),next);
});
test('legacy duplicate starter names remain valid and receive only one template marker',()=>{
  const item = {...fields,id:'legacy-bed',room:'침실',name:'침대 프레임'};
  const data = {...initialData,home:{budget:0,items:[item,{...item,id:'second-bed'}]}};
  assert.equal(validHome(data.home),true);
  const next = upgradeHomeData(data);
  assert.equal(next.home.items.length,2);
  assert.equal(next.home.items.filter(item => item.templateKey==='0').length,1);
  assert.equal(validHome(next.home),true);
});
test('spaces can be added or renamed and keep their order, purchases and future starter destinations',()=>{
  let data = addHomeRoom(initialData,'  드레스룸  ');
  assert.deepEqual(getHomeRooms(data),[...homeRooms,'드레스룸']);
  const ids = Object.fromEntries(homeTemplate.map(item => [item.key,`new-${item.key}`]));
  data = addHomeTemplateItems(data,['0','3','12','13','16'],ids);
  data = saveHomeItem(data,'new-0',{actualUnit:300000});
  data = savePayment(linkHomeItemToBudget(data,'new-0'),'home-new-0',payment);
  const before = structuredClone(data);
  const next = renameHomeRoom(data,'안방','우리 침실');
  assert.deepEqual(getHomeRooms(next),['거실','우리 침실','큰방','작은방','화장실','세탁실','베란다','드레스룸','현관']);
  assert.equal(next.home.items.find(item => item.id==='new-0').room,'우리 침실');
  assert.equal(next.home.items.find(item => item.id==='new-3').room,'우리 침실');
  assert.equal(next.home.items.find(item => item.id==='new-3').name,'안방 커튼');
  assert.equal(next.expenses[0].title,'우리 침실 · 침대 프레임');
  assert.deepEqual({...next.expenses[0],title:before.expenses[0].title},before.expenses[0]);
  assert.deepEqual(data,before);
  assert.equal(getHomeTemplate(next).find(item => item.key==='2').room,'우리 침실');
  let moved = renameHomeRoom(next,'우리 침실','둘의 방');
  assert.equal(getHomeTemplate(moved).find(item => item.key==='2').room,'둘의 방');
  moved = saveHomeItem(moved,'new-0',{name:'새 이름의 침대',templateKey:'2'});
  assert.equal(moved.home.items.find(item => item.id==='new-0').templateKey,'0');
  const repeated = addHomeTemplateItems(moved,['0','3'],ids);
  assert.equal(repeated,moved);
  const imported = addHomeTemplateItems(repeated,['2'],ids);
  assert.equal(imported.home.items.find(item => item.id==='new-2').room,'둘의 방');
  assert.equal(imported.home.items.find(item => item.id==='new-2').name,'침구 세트');
  assert.equal(validBackup(imported),true);
  assert.equal(renameHomeRoom(imported,'둘의 방','둘의 방'),imported);
});
test('space changes reject duplicates and stale names while preserving custom budget titles',()=>{
  let data = saveHomeItem(initialData,null,{...fields,room:'안방',name:'화장대',actualUnit:100000},'vanity');
  data = linkHomeItemToBudget(data,'vanity');
  data = saveExpense(data,'home-vanity',{...data.expenses[0],title:'화장대 배송비 포함'});
  const renamed = renameHomeRoom(data,'안방','둘의 방');
  assert.equal(renamed.expenses,data.expenses);
  assert.equal(renamed.expenses[0].title,'화장대 배송비 포함');
  for (const name of ['', ' ', 'x'.repeat(41), 123, null]) {
    assert.throws(()=>addHomeRoom(data,name),/공간 이름/);
    assert.throws(()=>renameHomeRoom(data,'안방',name),/공간 이름/);
  }
  assert.throws(()=>addHomeRoom(data,' 거실 '),/이미 있는 공간/);
  assert.throws(()=>renameHomeRoom(data,'안방','거실'),/이미 있는 공간/);
  assert.throws(()=>renameHomeRoom(renamed,'안방','새 이름'),/다른 기기/);
  const freeText = saveHomeItem(renamed,'vanity',{room:' 다락방 '});
  assert.equal(freeText.home.items[0].room,'다락방');
  assert.ok(freeText.home.rooms.includes('다락방'));
  assert.equal(freeText.expenses,renamed.expenses);
});
test('optional room metadata is strict while original home backups stay accepted',()=>{
  const legacy = {budget:0,items:[]};
  assert.equal(validHome(legacy),true);
  const valid = getHome({home:legacy});
  assert.equal(validHome(valid),true);
  for (const patch of [{rooms:null},{rooms:['거실','거실']},{rooms:[' 거실']},{rooms:['']},{rooms:['x'.repeat(41)]},{roomVersion:1},{roomVersion:'2'},{templateRooms:[]},{templateRooms:null},{templateRooms:{침실:'안방'}},{templateRooms:{안방:' 없는 방 '}},{templateRooms:{안방:'없는 방'}}]) assert.equal(validHome({...valid,...patch}),false,JSON.stringify(patch));
  const noRooms = {...valid}; delete noRooms.rooms;
  const noAliases = {...valid}; delete noAliases.templateRooms;
  assert.equal(validHome(noRooms),false);
  assert.equal(validHome(noAliases),false);
  assert.equal(validHome({...legacy,rooms:['취미방']}),true);
  const item = itemData().home.items[0];
  assert.equal(validHome({...valid,items:[item]}),true);
  assert.equal(validHome({...valid,items:[{...item,room:' 주방·다이닝'}]}),false);
  const data = itemData();
  assert.equal(validHome({...data.home,items:[{...item,templateKey:'invalid'}]}),false);
  assert.equal(validHome({...data.home,items:[{...item,templateKey:1}]}),false);
});
test('any home mutation persists the migration but missing old home stays optional until changed',()=>{
  const legacy = {...initialData,home:{budget:0,items:[{...fields,id:'old',room:'침실',name:'침실 커튼'}]}};
  const operations = [
    data => setHomeBudget(data,1000000),
    data => deleteHomeItem(data,'missing'),
    data => addHomeTemplateItems(data,[],{}),
    data => saveHomeItem(data,'old',{status:'배송 중'}),
    data => linkHomeItemToBudget(data,'old'),
    data => addHomeRoom(data,'취미방'),
    data => renameHomeRoom(data,'안방','둘의 방')
  ];
  for (const mutate of operations) {
    const next = mutate(legacy);
    assert.equal(next.home.roomVersion,2);
    assert.equal(validBackup(next),true);
    assert.equal(next.home.items[0].name,'안방 커튼');
  }
  const missing = {...initialData}; delete missing.home;
  assert.equal(upgradeHomeData(missing),missing);
  assert.equal(addHomeTemplateItems(missing,[],{}),missing);
  assert.equal(deleteHomeItem(missing,'missing'),missing);
  const added = addHomeRoom(missing,'취미방');
  assert.equal(added.home.roomVersion,2);
  assert.deepEqual(added.home.rooms,[...homeRooms,'취미방']);
});
test('cached clients can add custom-space items without losing the shared home state',()=>{
  const data = addHomeRoom(initialData,'드레스룸');
  const cached = {...data,home:{...data.home,items:[
    {...fields,id:'cached-chair',room:'취미방'},
    {...fields,id:'cached-light',room:'취미방',name:'독서등'},
    {...fields,id:'cached-bed',room:'침실',name:'침실 커튼'}
  ]}};
  const before = structuredClone(cached);
  assert.equal(validBackup(cached),true);
  const view = getHome(cached);
  assert.deepEqual(view.rooms,[...homeRooms,'드레스룸','취미방','침실']);
  assert.equal(view.items,cached.home.items);
  assert.equal(view.items[2].room,'침실');
  assert.equal(view.items[2].name,'침실 커튼');
  assert.deepEqual(cached,before);
  const upgraded = upgradeHomeData(cached);
  assert.notEqual(upgraded.home,cached.home);
  assert.equal(upgraded.home.items,cached.home.items);
  assert.deepEqual(upgraded.home,view);
  assert.equal(upgraded.expenses,cached.expenses);
  assert.equal(validBackup(upgraded),true);
  assert.equal(getHome(upgraded),upgraded.home);
  assert.equal(upgradeHomeData(upgraded),upgraded);
  const edited = saveHomeItem(cached,'cached-light',{color:'화이트'});
  assert.deepEqual(edited.home.rooms,view.rooms);
  assert.equal(edited.home.items.find(item => item.id==='cached-light').color,'화이트');
});
