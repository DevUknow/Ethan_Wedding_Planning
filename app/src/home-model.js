import {money,normalizeExpense,saveExpense,validBudgetDate} from './budget-model.js';

export const homeRooms = ['거실','침실','주방·다이닝','서재·작업실','현관','욕실','베란다·다용도실','기타'];
export const homeCategories = ['가구','가전','조명','패브릭','수납','소품','기타'];
export const homeStatuses = ['아이디어','구매 예정','주문 완료','배송 중','설치 완료'];
const maxMoney = 1_000_000_000_000;
const isMoney = value => Number.isSafeInteger(value) && value >= 0 && value <= maxMoney;
const text = (value,max) => typeof value === 'string' && value.length <= max;
const nonempty = (value,max) => text(value,max) && value.trim().length > 0;
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
    && text(item.expenseId,100) && (item.expenseId === '' || !!item.expenseId.trim());
}

// Existing backups do not need to acquire a home section until a user changes it.
export function getHome(data) {
  return data?.home === undefined ? {budget:0,items:[]} : data.home;
}
export function validHome(home) {
  if (!home || Array.isArray(home) || !isMoney(home.budget) || !Array.isArray(home.items) || !home.items.every(validHomeItem)) return false;
  if (new Set(home.items.map(item => item.id)).size !== home.items.length) return false;
  const linkedIds = home.items.map(item => item.expenseId).filter(Boolean);
  return new Set(linkedIds).size === linkedIds.length;
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
  const home = getHome(data);
  const current = existingId ? home.items.find(item => item.id === existingId) : null;
  if (existingId && !current) throw Error('다른 기기에서 삭제된 신혼집 항목입니다. 목록을 다시 확인해 주세요.');
  if (!existingId && home.items.some(item => item.id === newId)) throw Error('이미 존재하는 신혼집 항목입니다. 목록을 다시 확인해 주세요.');
  const next = {...current,...fields,id:existingId || newId,expenseId:current?.expenseId ?? ''};
  if (!validHomeItem(next)) throw Error('품목과 수량, 금액, 치수, 상품 링크와 날짜를 확인해 주세요.');
  const updated = {...home,items:existingId ? home.items.map(item => item.id === existingId ? next : item) : [...home.items,next]};
  if (!validHome(updated)) throw Error('신혼집 항목 정보를 확인해 주세요.');
  return {...data,home:updated};
}
export function setHomeBudget(data,amount) {
  if (!isMoney(amount)) throw Error(`신혼집 예산은 0원부터 ${money(maxMoney)}원까지 입력해 주세요.`);
  return {...data,home:{...getHome(data),budget:amount}};
}
export function deleteHomeItem(data,id) {
  const home = getHome(data);
  if (!home.items.some(item => item.id === id)) return data;
  // A linked budget item and its payments remain a separate financial record.
  return {...data,home:{...home,items:home.items.filter(item => item.id !== id)}};
}

export const homeTemplate = [
  ['침대 프레임','침실','가구'],['매트리스','침실','가구'],['침구 세트','침실','패브릭'],['침실 커튼','침실','패브릭'],
  ['소파','거실','가구'],['거실 테이블','거실','가구'],['TV','거실','가전'],['TV장','거실','수납'],['스탠드 조명','거실','조명'],
  ['식탁·의자','주방·다이닝','가구'],['냉장고','주방·다이닝','가전'],['전자레인지','주방·다이닝','가전'],
  ['세탁기','베란다·다용도실','가전'],['건조기','베란다·다용도실','가전'],['옷장','침실','수납'],
  ['책상·의자','서재·작업실','가구'],['현관 수납장','현관','수납'],['욕실 수납·용품','욕실','소품'],
].map(([name,room,category],index) => ({key:String(index),name,room,category}));
export function addHomeTemplateItems(data,selectedKeys,ids) {
  let next = data;
  const home = getHome(data);
  const existing = new Set(home.items.map(item => `${item.room.trim()}\0${item.name.trim()}`));
  for (const suggestion of homeTemplate) {
    const key = `${suggestion.room}\0${suggestion.name}`;
    if (!selectedKeys.includes(suggestion.key) || existing.has(key)) continue;
    next = saveHomeItem(next,null,{name:suggestion.name,room:suggestion.room,category:suggestion.category,priority:'필수',status:'아이디어',quantity:1,plannedUnit:0,actualUnit:null,width:null,depth:null,height:null,color:'',material:'',placement:'',productUrl:'',deliveryDate:'',notes:''},ids[suggestion.key]);
    existing.add(key);
  }
  return next;
}
export function linkHomeItemToBudget(data,id) {
  const home = getHome(data);
  const item = home.items.find(item => item.id === id);
  if (!item) throw Error('다른 기기에서 삭제된 신혼집 항목입니다. 목록을 다시 확인해 주세요.');
  const expenseId = item.expenseId || `home-${item.id}`;
  const current = data.expenses.find(expense => expense.id === expenseId);
  if ((current && current.homeItemId !== item.id) || home.items.some(other => other.id !== item.id && other.expenseId === expenseId)) throw Error('다른 항목에서 사용하는 예산 연결입니다. 예산 목록을 확인해 주세요.');
  const previous = current ? normalizeExpense(current) : null;
  const totals = homeItemTotals(item);
  const fields = {homeItemId:item.id,title:`${item.room} · ${item.name}`.slice(0,100),category:'신혼집',plannedAmount:totals.planned,actualAmount:totals.actual,priority:item.priority,vendor:previous?.vendor ?? '',dueDate:previous?.dueDate ?? '',notes:previous?.notes ?? item.notes.slice(0,1000)};
  // The budget mutator preserves current payments and enforces their paid floor.
  const next = saveExpense(data,current ? expenseId : null,fields,expenseId);
  return {...next,home:{...home,items:home.items.map(stored => stored.id === id ? {...stored,expenseId} : stored)}};
}
