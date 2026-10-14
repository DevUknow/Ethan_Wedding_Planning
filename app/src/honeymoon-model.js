import {normalizeExpense,saveExpense,validBudgetDate} from './budget-model.js';

export const honeymoonCategories = ['항공','숙소','체험·관광','이동','식사','기타'];
export const honeymoonStatuses = ['후보','예약 예정','예약 완료','이용 완료'];
export const honeymoonAreas = ['우붓','스미냑','짱구','짐바란','울루와투','누사두아','꾸따','기타'];
export const honeymoonTemplate = [
  ['왕복 항공권','항공',''],['우붓 숙소','숙소','우붓'],['남부 해변 숙소','숙소',''],
  ['공항 이동','이동',''],['숙소 간 이동','이동',''],['우붓 산책·관광','체험·관광','우붓'],
  ['해변에서 쉬는 날','체험·관광',''],['스파·마사지','체험·관광',''],['둘만의 저녁 식사','식사',''],
  ['여행 보험 검토','기타',''],['현지 통신','기타',''],['예비 경비','기타',''],
].map(([title,category,area],index) => ({key:String(index),title,category,area}));
export const honeymoonPackingTemplate = [
  '여권','항공권·숙소 예약 확인','여행 보험 검토','여행 서류·입국 요건 확인','결제 수단·현지 경비 준비',
  '휴대폰·충전기·통신 준비','상비약·개인 의약품','자외선 차단제','수영복·물놀이 용품','가벼운 옷·편한 신발','세면도구',
].map((title,index) => ({key:String(index),title}));
const templateKeys = new Set(honeymoonTemplate.map(item => item.key));
const packingTemplateKeys = new Set(honeymoonPackingTemplate.map(item => item.key));
const maxMoney = 1_000_000_000_000;
const isMoney = value => Number.isSafeInteger(value) && value >= 0 && value <= maxMoney;
const text = (value,max) => typeof value === 'string' && value.length <= max;
const nonempty = (value,max) => text(value,max) && value.trim().length > 0;
const validTime = value => value === '' || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
const uniqueIds = items => new Set(items.map(item => item.id)).size === items.length;
function validProductUrl(value) {
  if (!text(value,2000)) return false;
  if (value === '') return true;
  if (!/^https?:\/\//i.test(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:','https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}
function validSettings(settings) {
  return nonempty(settings.destination,100) && validBudgetDate(settings.startDate) && validBudgetDate(settings.endDate)
    && (!settings.startDate || !settings.endDate || settings.endDate >= settings.startDate)
    && isMoney(settings.budget) && text(settings.notes,2000);
}
function validHoneymoonItem(item) {
  // `trip-` keeps linked expense IDs within the budget model's 100-character cap.
  return !!item && !Array.isArray(item) && nonempty(item.id,95) && nonempty(item.title,100)
    && honeymoonCategories.includes(item.category) && text(item.area,80) && honeymoonStatuses.includes(item.status)
    && validBudgetDate(item.date) && validTime(item.time) && validBudgetDate(item.endDate)
    && (!item.endDate || (!!item.date && item.endDate >= item.date))
    && text(item.vendor,100) && validProductUrl(item.productUrl) && text(item.notes,2000)
    && isMoney(item.plannedAmount) && (item.actualAmount === null || isMoney(item.actualAmount))
    && text(item.expenseId,100) && (item.expenseId === '' || !!item.expenseId.trim())
    && (!Object.hasOwn(item,'templateKey') || templateKeys.has(item.templateKey));
}
function validPackingItem(item) {
  return !!item && !Array.isArray(item) && nonempty(item.id,100) && nonempty(item.title,100) && typeof item.done === 'boolean'
    && (!Object.hasOwn(item,'templateKey') || packingTemplateKeys.has(item.templateKey));
}
function uniqueTemplateKeys(items) {
  const keys = items.filter(item => Object.hasOwn(item,'templateKey')).map(item => item.templateKey);
  return new Set(keys).size === keys.length;
}

// Viewing an old backup never persists a new section or sample reservations.
export function getHoneymoon(data) {
  return data?.honeymoon ?? {destination:'발리',startDate:'',endDate:'',budget:0,notes:'',items:[],packing:[]};
}
export function validHoneymoon(honeymoon) {
  if (!honeymoon || Array.isArray(honeymoon) || !validSettings(honeymoon)
    || !Array.isArray(honeymoon.items) || !honeymoon.items.every(validHoneymoonItem)
    || !Array.isArray(honeymoon.packing) || !honeymoon.packing.every(validPackingItem)) return false;
  const links = honeymoon.items.map(item => item.expenseId).filter(Boolean);
  return uniqueIds(honeymoon.items) && uniqueIds(honeymoon.packing)
    && new Set(links).size === links.length && uniqueTemplateKeys(honeymoon.items) && uniqueTemplateKeys(honeymoon.packing);
}
export function honeymoonItemTotals(item) {
  const projected = item.actualAmount ?? item.plannedAmount;
  return {planned:item.plannedAmount,actual:item.actualAmount,projected,variance:projected-item.plannedAmount};
}
export function honeymoonSummary(data) {
  const honeymoon = getHoneymoon(data);
  const summary = {budget:honeymoon.budget,planned:0,confirmed:0,projected:0,available:0,count:honeymoon.items.length,reserved:0,completed:0,linked:0,packingTotal:honeymoon.packing.length,packed:honeymoon.packing.filter(item => item.done).length};
  for (const item of honeymoon.items) {
    const totals = honeymoonItemTotals(item);
    summary.planned += totals.planned;
    summary.confirmed += totals.actual ?? 0;
    summary.projected += totals.projected;
    if (['예약 완료','이용 완료'].includes(item.status)) summary.reserved++;
    if (item.status === '이용 완료') summary.completed++;
    if (item.expenseId) summary.linked++;
  }
  summary.available = honeymoon.budget-summary.projected;
  return summary;
}
export function saveHoneymoonSettings(data,fields) {
  const current = getHoneymoon(data);
  const next = {...current};
  for (const key of ['destination','startDate','endDate','budget','notes']) if (Object.hasOwn(fields,key)) next[key] = fields[key];
  if (typeof next.destination === 'string') next.destination = next.destination.trim();
  if (!validSettings(next)) throw Error('여행지와 여행 기간, 예산을 확인해 주세요. 종료일은 시작일 이후여야 합니다.');
  return {...data,honeymoon:next};
}
export function saveHoneymoonItem(data,existingId,fields,newId) {
  const honeymoon = getHoneymoon(data);
  const current = existingId ? honeymoon.items.find(item => item.id === existingId) : null;
  if (existingId && !current) throw Error('다른 기기에서 삭제된 여행 항목입니다. 목록을 다시 확인해 주세요.');
  if (!existingId && honeymoon.items.some(item => item.id === newId)) throw Error('이미 존재하는 여행 항목입니다. 목록을 다시 확인해 주세요.');
  const next = {...current,...fields,id:existingId || newId,expenseId:current?.expenseId ?? ''};
  if (typeof next.title === 'string') next.title = next.title.trim();
  if (current?.templateKey !== undefined) next.templateKey = current.templateKey;
  if (!validHoneymoonItem(next)) throw Error('항목명과 금액, 날짜·시간, 예약 링크를 확인해 주세요. 종료일은 시작일 이후여야 합니다.');
  const updated = {...honeymoon,items:existingId ? honeymoon.items.map(item => item.id === existingId ? next : item) : [...honeymoon.items,next]};
  if (!validHoneymoon(updated)) throw Error('신혼여행 항목 정보를 확인해 주세요.');
  return {...data,honeymoon:updated};
}
export function deleteHoneymoonItem(data,id) {
  const honeymoon = getHoneymoon(data);
  if (!honeymoon.items.some(item => item.id === id)) return data;
  // Linked wedding budget entries and their payment histories stay independent.
  return {...data,honeymoon:{...honeymoon,items:honeymoon.items.filter(item => item.id !== id)}};
}
export function updateHoneymoonItemStatus(data,id,status) {
  return saveHoneymoonItem(data,id,{status});
}
export function addHoneymoonTemplateItems(data,selectedKeys,ids) {
  let next = data;
  const honeymoon = getHoneymoon(data);
  const existing = new Set(honeymoon.items.map(item => `${item.category}\0${item.title.trim()}`));
  const imported = new Set(honeymoon.items.map(item => item.templateKey).filter(key => key !== undefined));
  for (const suggestion of honeymoonTemplate) {
    const key = `${suggestion.category}\0${suggestion.title}`;
    if (!selectedKeys.includes(suggestion.key) || existing.has(key) || imported.has(suggestion.key)) continue;
    next = saveHoneymoonItem(next,null,{title:suggestion.title,category:suggestion.category,area:suggestion.area,date:'',time:'',endDate:'',vendor:'',status:'후보',plannedAmount:0,actualAmount:null,productUrl:'',notes:'',templateKey:suggestion.key},ids[suggestion.key]);
    existing.add(key);
  }
  return next;
}
export function linkHoneymoonItemToBudget(data,id) {
  const honeymoon = getHoneymoon(data);
  const item = honeymoon.items.find(item => item.id === id);
  if (!item) throw Error('다른 기기에서 삭제된 여행 항목입니다. 목록을 다시 확인해 주세요.');
  const expenseId = item.expenseId || `trip-${item.id}`;
  const current = data.expenses.find(expense => expense.id === expenseId);
  if ((current && current.honeymoonItemId !== item.id) || honeymoon.items.some(other => other.id !== item.id && other.expenseId === expenseId)) throw Error('다른 항목에서 사용하는 예산 연결입니다. 예산 목록을 확인해 주세요.');
  const previous = current ? normalizeExpense(current) : null;
  const fields = {honeymoonItemId:item.id,title:`${honeymoon.destination} · ${item.title}`.slice(0,100),category:'신혼여행',plannedAmount:item.plannedAmount,actualAmount:item.actualAmount,priority:previous?.priority ?? '필수',vendor:previous?.vendor ?? item.vendor,dueDate:previous?.dueDate ?? '',notes:previous?.notes ?? item.notes.slice(0,1000)};
  // Linking a reservation records no payment; existing paid amounts remain guarded.
  const next = saveExpense(data,current ? expenseId : null,fields,expenseId);
  return {...next,honeymoon:{...honeymoon,items:honeymoon.items.map(stored => stored.id === id ? {...stored,expenseId} : stored)}};
}
export function saveHoneymoonPackingItem(data,existingId,fields,newId) {
  const honeymoon = getHoneymoon(data);
  const current = existingId ? honeymoon.packing.find(item => item.id === existingId) : null;
  if (existingId && !current) throw Error('다른 기기에서 삭제된 준비물입니다. 목록을 다시 확인해 주세요.');
  if (!existingId && honeymoon.packing.some(item => item.id === newId)) throw Error('이미 존재하는 준비물입니다. 목록을 다시 확인해 주세요.');
  const next = {done:false,...current,...fields,id:existingId || newId};
  if (typeof next.title === 'string') next.title = next.title.trim();
  if (current?.templateKey !== undefined) next.templateKey = current.templateKey;
  if (!validPackingItem(next)) throw Error('준비물 이름은 1자부터 100자까지 입력해 주세요.');
  const updated = {...honeymoon,packing:existingId ? honeymoon.packing.map(item => item.id === existingId ? next : item) : [...honeymoon.packing,next]};
  if (!validHoneymoon(updated)) throw Error('신혼여행 준비물 정보를 확인해 주세요.');
  return {...data,honeymoon:updated};
}
export function toggleHoneymoonPackingItem(data,id) {
  const current = getHoneymoon(data).packing.find(item => item.id === id);
  if (!current) throw Error('다른 기기에서 삭제된 준비물입니다. 목록을 다시 확인해 주세요.');
  return saveHoneymoonPackingItem(data,id,{done:!current.done});
}
export function deleteHoneymoonPackingItem(data,id) {
  const honeymoon = getHoneymoon(data);
  if (!honeymoon.packing.some(item => item.id === id)) return data;
  return {...data,honeymoon:{...honeymoon,packing:honeymoon.packing.filter(item => item.id !== id)}};
}
export function addHoneymoonPackingTemplateItems(data,selectedKeys,ids) {
  let next = data;
  const honeymoon = getHoneymoon(data);
  const existing = new Set(honeymoon.packing.map(item => item.title.trim()));
  const imported = new Set(honeymoon.packing.map(item => item.templateKey).filter(key => key !== undefined));
  for (const suggestion of honeymoonPackingTemplate) {
    if (!selectedKeys.includes(suggestion.key) || existing.has(suggestion.title) || imported.has(suggestion.key)) continue;
    next = saveHoneymoonPackingItem(next,null,{title:suggestion.title,done:false,templateKey:suggestion.key},ids[suggestion.key]);
    existing.add(suggestion.title);
  }
  return next;
}
