import {money,normalizeExpense,saveExpense,validBudgetDate} from './budget-model.js';

export const homeRooms = ['거실','안방','큰방','작은방','화장실','세탁실','베란다'];
export const homeCategories = ['가구','가전','조명','패브릭','수납','소품','기타'];
export const homeStatuses = ['아이디어','구매 예정','주문 완료','배송 중','설치 완료'];
export const homeTemplate = [
  ['침대 프레임','안방','가구'],['매트리스','안방','가구'],['침구 세트','안방','패브릭'],['안방 커튼','안방','패브릭'],
  ['소파','거실','가구'],['거실 테이블','거실','가구'],['TV','거실','가전'],['TV장','거실','수납'],['스탠드 조명','거실','조명'],
  ['식탁·의자','주방·다이닝','가구'],['냉장고','주방·다이닝','가전'],['전자레인지','주방·다이닝','가전'],
  ['세탁기','세탁실','가전'],['건조기','세탁실','가전'],['옷장','안방','수납'],
  ['책상·의자','작은방','가구'],['현관 수납장','현관','수납'],['화장실 수납·용품','화장실','소품'],
].map(([name,room,category],index) => ({key:String(index),name,room,category}));
const templateRoomNames = new Set([...homeRooms,...homeTemplate.map(item => item.room)]);
const templateKeys = new Set(homeTemplate.map(item => item.key));
const legacyTemplate = homeTemplate.map(item => ({...item,
  name:item.key==='3' ? '침실 커튼' : item.key==='17' ? '욕실 수납·용품' : item.name,
  room:{안방:'침실',작은방:'서재·작업실',화장실:'욕실',세탁실:'베란다·다용도실'}[item.room] ?? item.room
}));
const maxMoney = 1_000_000_000_000;
const isMoney = value => Number.isSafeInteger(value) && value >= 0 && value <= maxMoney;
const text = (value,max) => typeof value === 'string' && value.length <= max;
const nonempty = (value,max) => text(value,max) && value.trim().length > 0;
const roomName = value => nonempty(value,40) && value === value.trim();
const roomList = value => Array.isArray(value) && value.every(roomName) && new Set(value).size === value.length;
const dimension = value => value === null || (Number.isFinite(value) && value > 0 && value <= 100000);
function validProductUrl(value) {
  if (!text(value,2000)) return false;
  if (value === '') return true;
  if (!/^https?:\/\//i.test(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:','https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}
function validHomeItem(item) {
  // Leave room for the reserved `home-` prefix in the budget's 100-character ID.
  return !!item && !Array.isArray(item) && nonempty(item.id,95) && nonempty(item.name,100) && nonempty(item.room,40)
    && homeCategories.includes(item.category) && ['필수','선택'].includes(item.priority) && homeStatuses.includes(item.status)
    && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 1000
    && isMoney(item.plannedUnit) && (item.actualUnit === null || isMoney(item.actualUnit))
    && isMoney(item.quantity*item.plannedUnit) && (item.actualUnit === null || isMoney(item.quantity*item.actualUnit))
    && ['width','depth','height'].every(key => dimension(item[key]))
    && text(item.color,80) && text(item.material,100) && text(item.placement,200)
    && validProductUrl(item.productUrl) && validBudgetDate(item.deliveryDate) && text(item.notes,2000)
    && text(item.expenseId,100) && (item.expenseId === '' || !!item.expenseId.trim())
    && (!Object.hasOwn(item,'templateKey') || templateKeys.has(item.templateKey));
}

// Existing backups do not need to acquire a home section until a user changes it.
export function getHome(data) {
  const home = data?.home;
  if (home === undefined) return {budget:0,items:[],rooms:[...homeRooms],roomVersion:2,templateRooms:{}};
  if (home.roomVersion === 2) {
    // A cached client may add a custom-space item without extending the registry.
    const missing = [...new Set(home.items.map(item => item.room).filter(room => !home.rooms.includes(room)))];
    return missing.length ? {...home,rooms:[...home.rooms,...missing]} : home;
  }
  const markedKeys = new Set(home.items.map(item => item.templateKey).filter(key => key !== undefined));
  const items = home.items.map(item => {
    const room = migrateRoom(item.room,item.name);
    const suggestion = legacyTemplate.find(candidate => candidate.room === item.room && candidate.name === item.name);
    const name = item.room === '침실' && item.name === '침실 커튼' ? '안방 커튼'
      : item.room === '욕실' && item.name === '욕실 수납·용품' ? '화장실 수납·용품' : item.name;
    const mark = suggestion && !Object.hasOwn(item,'templateKey') && !markedKeys.has(suggestion.key);
    if (mark) markedKeys.add(suggestion.key);
    return {...item,room,name,...(mark ? {templateKey:suggestion.key} : {})};
  });
  const rooms = [...new Set([...homeRooms,...(home.rooms ?? []).map(room => migrateRoom(room)),...items.map(item => item.room),...Object.values(home.templateRooms ?? {})])];
  return {...home,items,rooms,roomVersion:2,templateRooms:{...home.templateRooms}};
}
function migrateRoom(room,name='') {
  const trimmed = room.trim();
  if (trimmed === '침실') return '안방';
  if (trimmed === '욕실') return '화장실';
  if (trimmed === '서재·작업실') return '작은방';
  if (trimmed === '베란다·다용도실') return ['세탁기','건조기'].includes(name.trim()) ? '세탁실' : '베란다';
  return trimmed;
}
export function getHomeRooms(data) { return getHome(data).rooms; }
export function getHomeTemplate(data) {
  const aliases = getHome(data).templateRooms ?? {};
  return homeTemplate.map(item => ({...item,room:aliases[item.room] ?? item.room}));
}
function generatedTitle(item) { return `${item.room} · ${item.name}`.slice(0,100); }
function updateGeneratedTitles(data,before,after) {
  const previous = new Map(before.map(item => [item.id,item]));
  const changed = new Map(after.filter(item => {
    const old = previous.get(item.id);
    return old && generatedTitle(old) !== generatedTitle(item);
  }).map(item => [item.expenseId || `home-${item.id}`,item]));
  let updated = false;
  const expenses = data.expenses.map(expense => {
    const item = changed.get(expense.id);
    const old = item && previous.get(item.id);
    if (!item || expense.homeItemId !== item.id || expense.title !== generatedTitle(old)) return expense;
    updated = true;
    return {...expense,title:generatedTitle(item)};
  });
  return updated ? {...data,expenses} : data;
}
export function upgradeHomeData(data) {
  if (!Object.hasOwn(data,'home')) return data;
  const home = getHome(data);
  if (home === data.home) return data;
  return {...updateGeneratedTitles(data,data.home.items,home.items),home};
}
export function validHome(home) {
  if (!home || Array.isArray(home) || !isMoney(home.budget) || !Array.isArray(home.items) || !home.items.every(validHomeItem)) return false;
  if (new Set(home.items.map(item => item.id)).size !== home.items.length) return false;
  const linkedIds = home.items.map(item => item.expenseId).filter(Boolean);
  if (new Set(linkedIds).size !== linkedIds.length) return false;
  if (Object.hasOwn(home,'rooms') && !roomList(home.rooms)) return false;
  if (Object.hasOwn(home,'roomVersion') && (home.roomVersion !== 2 || !Object.hasOwn(home,'rooms') || !Object.hasOwn(home,'templateRooms'))) return false;
  if (Object.hasOwn(home,'templateRooms')) {
    if (!home.templateRooms || typeof home.templateRooms !== 'object' || Array.isArray(home.templateRooms)) return false;
    if (!Object.entries(home.templateRooms).every(([from,to]) => templateRoomNames.has(from) && roomName(to) && (!home.rooms || home.rooms.includes(to)))) return false;
  }
  if (home.roomVersion === 2 && home.items.some(item => !roomName(item.room))) return false;
  const importedKeys = home.items.filter(item => Object.hasOwn(item,'templateKey')).map(item => item.templateKey);
  return new Set(importedKeys).size === importedKeys.length;
}
export function addHomeRoom(data,name) {
  const room = typeof name === 'string' ? name.trim() : name;
  if (!roomName(room)) throw Error('공간 이름은 1자부터 40자까지 입력해 주세요.');
  const upgraded = upgradeHomeData(data);
  const home = getHome(upgraded);
  if (home.rooms.includes(room)) throw Error('이미 있는 공간 이름입니다. 다른 이름을 입력해 주세요.');
  return {...upgraded,home:{...home,rooms:[...home.rooms,room]}};
}
export function renameHomeRoom(data,oldName,newName) {
  const room = typeof newName === 'string' ? newName.trim() : newName;
  if (!roomName(room)) throw Error('공간 이름은 1자부터 40자까지 입력해 주세요.');
  const upgraded = upgradeHomeData(data);
  const home = getHome(upgraded);
  if (!home.rooms.includes(oldName)) throw Error('다른 기기에서 이름이 바뀐 공간입니다. 목록을 다시 확인해 주세요.');
  if (oldName === room) return upgraded;
  if (home.rooms.includes(room)) throw Error('이미 있는 공간 이름입니다. 다른 이름을 입력해 주세요.');
  const templateRooms = {...home.templateRooms};
  for (const source of templateRoomNames) if ((templateRooms[source] ?? source) === oldName) templateRooms[source] = room;
  const items = home.items.map(item => item.room === oldName ? {...item,room} : item);
  const next = updateGeneratedTitles(upgraded,home.items,items);
  return {...next,home:{...home,rooms:home.rooms.map(existing => existing === oldName ? room : existing),templateRooms,items}};
}
export function homeItemTotals(item) {
  const planned = item.quantity*item.plannedUnit;
  const actual = item.actualUnit === null ? null : item.quantity*item.actualUnit;
  const projected = actual ?? planned;
  return {planned,actual,projected,variance:projected-planned};
}
export function homeSummary(data) {
  const home = getHome(data);
  const summary = {budget:home.budget,planned:0,confirmed:0,projected:0,available:0,unallocated:0,count:home.items.length,installed:0,ordered:0,linked:0};
  for (const item of home.items) {
    const totals = homeItemTotals(item);
    summary.planned += totals.planned;
    summary.confirmed += totals.actual ?? 0;
    summary.projected += totals.projected;
    if (item.status === '설치 완료') summary.installed++;
    if (['주문 완료','배송 중','설치 완료'].includes(item.status)) summary.ordered++;
    if (item.expenseId) summary.linked++;
  }
  summary.available = home.budget-summary.projected;
  summary.unallocated = home.budget-summary.planned;
  return summary;
}
export function saveHomeItem(data,existingId,fields,newId) {
  const upgraded = upgradeHomeData(data);
  const home = getHome(upgraded);
  const current = existingId ? home.items.find(item => item.id === existingId) : null;
  if (existingId && !current) throw Error('다른 기기에서 삭제된 신혼집 항목입니다. 목록을 다시 확인해 주세요.');
  if (!existingId && home.items.some(item => item.id === newId)) throw Error('이미 존재하는 신혼집 항목입니다. 목록을 다시 확인해 주세요.');
  const next = {...current,...fields,id:existingId || newId,expenseId:current?.expenseId ?? ''};
  if (typeof next.room === 'string') next.room = next.room.trim();
  if (current?.templateKey !== undefined) next.templateKey = current.templateKey;
  if (!validHomeItem(next)) throw Error('품목과 수량, 금액, 치수, 상품 링크와 날짜를 확인해 주세요.');
  const updated = {...home,rooms:home.rooms.includes(next.room) ? home.rooms : [...home.rooms,next.room],items:existingId ? home.items.map(item => item.id === existingId ? next : item) : [...home.items,next]};
  if (!validHome(updated)) throw Error('신혼집 항목 정보를 확인해 주세요.');
  return {...upgraded,home:updated};
}
export function setHomeBudget(data,amount) {
  if (!isMoney(amount)) throw Error(`신혼집 예산은 0원부터 ${money(maxMoney)}원까지 입력해 주세요.`);
  const upgraded = upgradeHomeData(data);
  return {...upgraded,home:{...getHome(upgraded),budget:amount}};
}
export function deleteHomeItem(data,id) {
  const upgraded = upgradeHomeData(data);
  const home = getHome(upgraded);
  if (!home.items.some(item => item.id === id)) return upgraded;
  // A linked budget item and its payments remain a separate financial record.
  return {...upgraded,home:{...home,items:home.items.filter(item => item.id !== id)}};
}
export function addHomeTemplateItems(data,selectedKeys,ids) {
  let next = upgradeHomeData(data);
  const home = getHome(next);
  const existing = new Set(home.items.map(item => `${item.room.trim()}\0${item.name.trim()}`));
  const imported = new Set(home.items.map(item => item.templateKey).filter(key => key !== undefined));
  for (const suggestion of getHomeTemplate(next)) {
    const key = `${suggestion.room}\0${suggestion.name}`;
    if (!selectedKeys.includes(suggestion.key) || existing.has(key) || imported.has(suggestion.key)) continue;
    next = saveHomeItem(next,null,{name:suggestion.name,room:suggestion.room,category:suggestion.category,priority:'필수',status:'아이디어',quantity:1,plannedUnit:0,actualUnit:null,width:null,depth:null,height:null,color:'',material:'',placement:'',productUrl:'',deliveryDate:'',notes:'',templateKey:suggestion.key},ids[suggestion.key]);
    existing.add(key);
  }
  return next;
}
export function linkHomeItemToBudget(data,id) {
  const upgraded = upgradeHomeData(data);
  const home = getHome(upgraded);
  const item = home.items.find(item => item.id === id);
  if (!item) throw Error('다른 기기에서 삭제된 신혼집 항목입니다. 목록을 다시 확인해 주세요.');
  const expenseId = item.expenseId || `home-${item.id}`;
  const current = upgraded.expenses.find(expense => expense.id === expenseId);
  if ((current && current.homeItemId !== item.id) || home.items.some(other => other.id !== item.id && other.expenseId === expenseId)) throw Error('다른 항목에서 사용하는 예산 연결입니다. 예산 목록을 확인해 주세요.');
  const previous = current ? normalizeExpense(current) : null;
  const totals = homeItemTotals(item);
  const fields = {homeItemId:item.id,title:generatedTitle(item),category:'신혼집',plannedAmount:totals.planned,actualAmount:totals.actual,priority:item.priority,vendor:previous?.vendor ?? '',dueDate:previous?.dueDate ?? '',notes:previous?.notes ?? item.notes.slice(0,1000)};
  // The budget mutator preserves current payments and enforces their paid floor.
  const next = saveExpense(upgraded,current ? expenseId : null,fields,expenseId);
  return {...next,home:{...home,items:home.items.map(stored => stored.id === id ? {...stored,expenseId} : stored)}};
}
