export const budgetCategories = ['웨딩홀','식대·연회','스튜디오','드레스','메이크업','본식 사진·영상','예복·한복','예물','청첩장·답례품','사회·축가','꽃·연출','신혼여행','기타'];
export const paymentMethods = ['계좌이체','카드','현금','기타','미정'];
export const paymentPayers = ['공동','신랑','신부','가족','기타','미정'];
export const money = value => new Intl.NumberFormat('ko-KR').format(value);
const maxMoney = 1_000_000_000_000;
const isMoney = value => Number.isSafeInteger(value) && value >= 0 && value <= maxMoney;
export function localToday(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validBudgetDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localToday(date) === value;
}
function text(value, max) { return typeof value === 'string' && value.length <= max; }
export function validPayment(payment) {
  return !!payment && text(payment.id,100) && payment.id.length > 0 && text(payment.title,60) && payment.title.trim().length > 0 && isMoney(payment.amount) && payment.amount > 0 && validBudgetDate(payment.date) && paymentMethods.includes(payment.method) && paymentPayers.includes(payment.payer);
}
export function validExpense(item) {
  if (!item || !text(item.id,100) || !item.id || !text(item.title,100) || !item.title.trim() || !text(item.category,40) || !item.category.trim()) return false;
  const modern = ['plannedAmount','actualAmount','payments'].some(key => Object.hasOwn(item,key));
  if (!modern) return Number.isFinite(item.amount) && item.amount > 0;
  if (!isMoney(item.plannedAmount) || !(item.actualAmount === null || isMoney(item.actualAmount)) || item.amount !== (item.actualAmount ?? item.plannedAmount) || !Array.isArray(item.payments) || !item.payments.every(validPayment)) return false;
  if (new Set(item.payments.map(payment => payment.id)).size !== item.payments.length) return false;
  if (!text(item.vendor,100) || !text(item.notes,1000) || !['필수','선택'].includes(item.priority) || !validBudgetDate(item.dueDate)) return false;
  const paid = item.payments.reduce((sum,payment) => sum+payment.amount,0);
  return item.actualAmount === null ? paid === 0 : paid <= item.actualAmount;
}
export function normalizeExpense(item) {
  if (Array.isArray(item.payments)) return {...item, payments:item.payments.map(payment => ({...payment}))};
  return {...item, plannedAmount:item.amount, actualAmount:item.amount, vendor:'', priority:'필수', dueDate:'', notes:'', payments:[{id:`legacy-${item.id}`, title:'기존 지출', amount:item.amount, date:'', method:'미정', payer:'미정'}]};
}
export function expenseTotals(raw, today = localToday()) {
  const item = normalizeExpense(raw);
  const paid = item.payments.reduce((sum,payment) => sum+payment.amount,0);
  const projected = item.actualAmount ?? item.plannedAmount;
  const outstanding = item.actualAmount === null ? 0 : Math.max(0,item.actualAmount-paid);
  const overdue = outstanding > 0 && !!item.dueDate && item.dueDate < today;
  const status = item.actualAmount === null ? '계획 중' : outstanding === 0 ? '결제 완료' : paid > 0 ? '부분 결제' : '미결제';
  return {planned:item.plannedAmount, actual:item.actualAmount, projected, paid, outstanding, variance:projected-item.plannedAmount, overdue, status};
}
export function budgetSummary(data, today = localToday()) {
  const summary = {planned:0, confirmed:0, projected:0, paid:0, outstanding:0, unconfirmed:0, overdue:0};
  for (const item of data.expenses) {
    const totals = expenseTotals(item,today);
    summary.planned += totals.planned; summary.confirmed += totals.actual ?? 0;
    summary.projected += totals.projected; summary.paid += totals.paid; summary.outstanding += totals.outstanding;
    if (totals.actual === null) summary.unconfirmed += totals.planned;
    if (totals.overdue) summary.overdue += totals.outstanding;
  }
  return {...summary, available:data.budget-summary.projected, unallocated:data.budget-summary.planned};
}
export function categorySummary(expenses) {
  const groups = new Map();
  for (const item of expenses) {
    const totals = expenseTotals(item);
    const group = groups.get(item.category) ?? {category:item.category, count:0, planned:0, projected:0, paid:0, outstanding:0};
    group.count++; for (const key of ['planned','projected','paid','outstanding']) group[key] += totals[key];
    groups.set(item.category,group);
  }
  return [...groups.values()].sort((a,b) => b.projected-a.projected);
}
export function paymentJournal(expenses) {
  return expenses.flatMap(raw => {
    const item = normalizeExpense(raw);
    return item.payments.map(payment => ({...payment,itemId:item.id,itemTitle:item.title,category:item.category,vendor:item.vendor}));
  }).sort((a,b) => (b.date || '').localeCompare(a.date || ''));
}
export function saveExpense(data, existingId, fields, newId) {
  const current = existingId ? data.expenses.find(item => item.id === existingId) : null;
  if (existingId && !current) throw Error('다른 기기에서 삭제된 항목입니다. 목록을 다시 확인해 주세요.');
  const payments = current ? normalizeExpense(current).payments : [];
  const next = {...current,...fields,id:existingId || newId,payments,amount:fields.actualAmount ?? fields.plannedAmount};
  const paid = payments.reduce((sum,payment) => sum+payment.amount,0);
  if (paid > 0 && (next.actualAmount === null || next.actualAmount < paid)) throw Error(`계약·확정 금액은 이미 결제한 ${money(paid)}원 이상이어야 합니다.`);
  if (!validExpense(next)) throw Error('항목과 금액, 날짜를 확인해 주세요.');
  return {...data,expenses:existingId ? data.expenses.map(item => item.id === existingId ? next : item) : [...data.expenses,next]};
}
export function savePayment(data, itemId, payment, existingPaymentId = null) {
  const raw = data.expenses.find(item => item.id === itemId);
  if (!raw) throw Error('다른 기기에서 삭제된 항목입니다.');
  const item = normalizeExpense(raw);
  if (item.actualAmount === null) throw Error('계약·확정 금액을 먼저 입력해 주세요.');
  if (existingPaymentId && !item.payments.some(p => p.id === existingPaymentId)) throw Error('다른 기기에서 삭제된 결제 기록입니다.');
  if (!validPayment(payment)) throw Error('결제명과 금액, 날짜를 확인해 주세요.');
  const payments = existingPaymentId ? item.payments.map(p => p.id === existingPaymentId ? {...payment,id:existingPaymentId} : p) : [...item.payments,payment];
  if (payments.reduce((sum,p) => sum+p.amount,0) > item.actualAmount) throw Error('결제 합계가 계약·확정 금액을 넘습니다. 금액을 확인해 주세요.');
  const next = {...item,payments};
  if (!validExpense(next)) throw Error('결제 기록을 확인해 주세요.');
  return {...data,expenses:data.expenses.map(item => item.id === itemId ? next : item)};
}
export function deletePayment(data, itemId, paymentId) {
  return {...data,expenses:data.expenses.map(raw => {
    if (raw.id !== itemId) return raw;
    const item = normalizeExpense(raw);
    return {...item,payments:item.payments.filter(payment => payment.id !== paymentId)};
  })};
}
export const budgetTemplate = [
  ['웨딩홀','브리에홀 대관·기본 연출','더파티움 안양'],['식대·연회','예식 식대','더파티움 안양'],
  ['스튜디오','웨딩 촬영',''],['스튜디오','앨범·사진 추가금',''],['드레스','본식·촬영 드레스',''],['드레스','드레스 추가금·헬퍼비',''],
  ['메이크업','신랑·신부 헤어 메이크업',''],['본식 사진·영상','본식 스냅',''],['본식 사진·영상','본식 영상',''],
  ['예복·한복','신랑 예복',''],['예복·한복','혼주 한복·의상',''],['예물','웨딩링',''],
  ['청첩장·답례품','청첩장·모바일 청첩장',''],['청첩장·답례품','하객 답례품',''],['사회·축가','사회·축가',''],
  ['꽃·연출','부케·부토니에',''],['신혼여행','항공권',''],['신혼여행','숙박·현지 경비',''],['기타','교통·숙박 지원',''],['기타','예비비',''],
].map(([category,title,vendor],index) => ({key:String(index),category,title,vendor}));
export function addTemplateItems(data, selected, ids) {
  const existing = new Set(data.expenses.map(item => `${item.category}\0${item.title}`));
  const added = budgetTemplate.filter(item => selected.includes(item.key) && !existing.has(`${item.category}\0${item.title}`)).map(item => ({id:ids[item.key],title:item.title,category:item.category,vendor:item.vendor,plannedAmount:0,actualAmount:null,amount:0,payments:[],priority:'필수',dueDate:'',notes:''}));
  return {...data,expenses:[...data.expenses,...added]};
}
function csvCell(value) {
  let content = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(content)) content = "'"+content;
  return '"'+content.replaceAll('"','""')+'"';
}
export function budgetCsv(expenses, view = 'items') {
  const rows = view === 'payments' ? [['결제일','분류','항목','업체','결제명','결제 금액','결제수단','부담자'],...paymentJournal(expenses).map(p => [p.date,p.category,p.itemTitle,p.vendor,p.title,p.amount,p.method,p.payer])] : [['분류','항목','업체','우선순위','계획 금액','계약·확정 금액','예상 총비용','결제 완료','남은 잔금','계획 대비 차이','잔금 결제일','메모'],...expenses.map(raw => {const item=normalizeExpense(raw),t=expenseTotals(item);return [item.category,item.title,item.vendor,item.priority,t.planned,t.actual ?? '',t.projected,t.paid,t.outstanding,t.variance,item.dueDate,item.notes]})];
  return '\uFEFF'+rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
