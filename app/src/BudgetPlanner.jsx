import React, {useEffect, useRef, useState} from 'react';
import {Plus, Pencil, Trash2, X, Download, Search, Wallet, CalendarDays, ArrowUpRight, Check, ChevronDown, Calculator, ListChecks, Receipt, PieChart} from 'lucide-react';
import {budgetCategories, paymentMethods, paymentPayers, budgetTemplate, localToday, money, normalizeExpense, expenseTotals, budgetSummary, categorySummary, paymentJournal, saveExpense, savePayment, deletePayment, addTemplateItems, budgetCsv} from './budget-model.js';
import './budget.css';

function BudgetDialog({title, onClose, children}) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {dialog.close(); previous?.focus()};
  }, []);
  return <dialog ref={ref} className="budget-dialog" aria-labelledby="budget-dialog-title" onCancel={event => {event.preventDefault(); onClose()}}>
    <div className="section-heading"><h2 id="budget-dialog-title">{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={21}/></button></div>
    {children}
  </dialog>;
}
function Amount({value, empty = '미확정'}) {return value === null ? <span className="budget-muted">{empty}</span> : <span className="budget-amount">{money(value)}<small>원</small></span>}
function Status({totals}) {return <span className={`budget-status ${totals.overdue ? 'overdue' : totals.status === '결제 완료' ? 'paid' : totals.status === '계획 중' ? 'planning' : 'pending'}`}>{totals.overdue ? '기한 지남' : totals.status}</span>}

function ItemEditor({item, existingId, onSave, onClose}) {
  const initial = item ? normalizeExpense(item) : {title:'',category:'웨딩홀',vendor:'',plannedAmount:0,actualAmount:null,priority:'필수',dueDate:'',notes:'',payments:[]};
  const [values, setValues] = useState(() => ({...initial,plannedAmount:String(initial.plannedAmount),actualAmount:initial.actualAmount === null ? '' : String(initial.actualAmount)}));
  const [error,setError] = useState(''), [pending,setPending] = useState(false);
  const [custom,setCustom] = useState(!budgetCategories.includes(initial.category));
  const [unit,setUnit] = useState(''), [quantity,setQuantity] = useState('');
  const paid = item ? expenseTotals(item).paid : 0;
  function field(key, value) {setValues(current => ({...current,[key]:value})); setError('')}
  function calculate() {
    const total = Number(unit)*Number(quantity);
    if (!unit || !quantity || !Number.isSafeInteger(total) || total < 0 || total > 1e12 || Number(unit)<0 || Number(quantity)<1 || !Number.isInteger(Number(quantity))) {setError('단가와 수량을 확인해 주세요. 수량은 1 이상의 정수입니다.'); return}
    field('plannedAmount',String(total));
  }
  async function submit(event) {
    event.preventDefault(); setError(''); setPending(true);
    const fields = {title:values.title.trim(),category:values.category.trim(),vendor:values.vendor.trim(),plannedAmount:Number(values.plannedAmount || 0),actualAmount:values.actualAmount === '' ? null : Number(values.actualAmount),priority:values.priority,dueDate:values.dueDate,notes:values.notes.trim()};
    const newId=crypto.randomUUID();
    try {if (await onSave(data => saveExpense(data,existingId,fields,newId))) onClose(); else setError('저장하지 못했습니다. 연결 상태와 상단 안내를 확인해 주세요.')}
    catch (error) {setError(error.message)} finally {setPending(false)}
  }
  return <form onSubmit={submit} className="budget-form">
    <p className="budget-form-intro">계획을 먼저 세우고, 계약이 정해지면 확정 금액을 입력하세요. 결제 내역은 별도로 기록합니다.</p>
    <label>예산 항목<input autoFocus required maxLength={100} value={values.title} onChange={e => field('title',e.target.value)} placeholder="예: 브리에홀 대관료, 본식 스냅"/></label>
    <div className="budget-form-grid"><label>분류<select value={custom ? '__custom' : values.category} onChange={e => {const isCustom=e.target.value==='__custom';setCustom(isCustom);field('category',isCustom ? '' : e.target.value)}}>{budgetCategories.map(category => <option key={category}>{category}</option>)}<option value="__custom">직접 입력</option></select></label><label>우선순위<select value={values.priority} onChange={e => field('priority',e.target.value)}><option>필수</option><option>선택</option></select></label></div>
    {custom ? <label>직접 입력한 분류<input required maxLength={40} value={values.category} onChange={e => field('category',e.target.value)}/></label> : null}
    <label>업체<input maxLength={100} value={values.vendor} onChange={e => field('vendor',e.target.value)} placeholder="예: 더파티움 안양"/></label>
    <div className="budget-form-grid"><label>계획 금액 (원)<input type="number" min="0" max="1000000000000" step="1" value={values.plannedAmount} onChange={e => field('plannedAmount',e.target.value)}/></label><label>계약·확정 금액 (원)<input type="number" min="0" max="1000000000000" step="1" value={values.actualAmount} onChange={e => field('actualAmount',e.target.value)} placeholder="미확정이면 비워두세요"/></label></div>
    <details className="budget-calculator"><summary><Calculator size={15}/> 단가 × 수량으로 계획 금액 계산</summary><div className="budget-form-grid"><label>단가 (원)<input type="number" min="0" max="1000000000000" step="1" value={unit} onChange={e => setUnit(e.target.value)}/></label><label>수량·인원<input type="number" min="1" max="1000000" step="1" value={quantity} onChange={e => setQuantity(e.target.value)}/></label></div><button type="button" className="outline-button" onClick={calculate}>계획 금액에 적용</button><p>식대 × 보증 인원, 답례품 단가 × 수량 등을 계산해 보세요.</p></details>
    <label>잔금 결제일<input type="date" value={values.dueDate} onChange={e => field('dueDate',e.target.value)}/></label>
    <label>메모<textarea maxLength={1000} rows={3} value={values.notes} onChange={e => field('notes',e.target.value)} placeholder="포함·불포함 비용, 추가금 조건, 상담 내용"/></label>
    {paid > 0 ? <p className="budget-form-intro">이미 결제한 금액: <b>{money(paid)}원</b>. 확정 금액을 이보다 작게 변경할 수 없습니다.</p> : null}
    {error ? <p role="alert" className="budget-form-error">{error}</p> : null}
    <div className="modal-actions"><button type="button" className="outline-button" onClick={onClose} disabled={pending}>취소</button><button className="primary-button" disabled={pending}>{pending ? '저장 중…' : '예산 항목 저장'} <Check size={16}/></button></div>
  </form>;
}

function PaymentEditor({item, payment, onSave, onClose}) {
  const totals = expenseTotals(item);
  const [values,setValues] = useState(() => payment ? {...payment,amount:String(payment.amount)} : {title:totals.paid ? '잔금' : '계약금',amount:'',date:localToday(),method:'계좌이체',payer:'공동'});
  const [error,setError] = useState(''), [pending,setPending] = useState(false);
  const limit = totals.outstanding+(payment?.amount || 0);
  function field(key,value) {setValues(current => ({...current,[key]:value}));setError('')}
  async function submit(event) {
    event.preventDefault();setError('');setPending(true);
    const next = {...values,id:payment?.id || crypto.randomUUID(),title:values.title.trim(),amount:Number(values.amount)};
    try {if (await onSave(data => savePayment(data,item.id,next,payment?.id))) onClose();else setError('저장하지 못했습니다. 연결 상태와 상단 안내를 확인해 주세요.')}
    catch (error) {setError(error.message)} finally {setPending(false)}
  }
  return <form className="budget-form" onSubmit={submit}>
    <div className="budget-payment-context"><strong>{item.title}</strong><span>확정 {money(totals.actual ?? 0)}원 · 결제 완료 {money(totals.paid)}원</span><span>이번 기록 가능 금액: {money(limit)}원</span></div>
    <label>결제명<input autoFocus required maxLength={60} value={values.title} onChange={e => field('title',e.target.value)} placeholder="계약금, 중도금, 잔금"/></label>
    <label>결제 금액 (원)<input type="number" required min="1" max={Math.max(1,limit)} step="1" value={values.amount} onChange={e => field('amount',e.target.value)}/></label>
    <label>결제일<input type="date" required value={values.date} onChange={e => field('date',e.target.value)}/></label>
    <div className="budget-form-grid"><label>결제수단<select value={values.method} onChange={e => field('method',e.target.value)}>{paymentMethods.map(method => <option key={method}>{method}</option>)}</select></label><label>부담자<select value={values.payer} onChange={e => field('payer',e.target.value)}>{paymentPayers.map(payer => <option key={payer}>{payer}</option>)}</select></label></div>
    {error ? <p role="alert" className="budget-form-error">{error}</p> : null}
    <div className="modal-actions"><button type="button" className="outline-button" disabled={pending} onClick={onClose}>취소</button><button className="primary-button" disabled={pending}>{pending ? '저장 중…' : '결제 기록 저장'} <Check size={16}/></button></div>
  </form>;
}

function TemplatePicker({expenses, onSave, onClose}) {
  const existing = new Set(expenses.map(item => `${item.category}\0${item.title}`));
  const available = budgetTemplate.filter(item => !existing.has(`${item.category}\0${item.title}`));
  const [selected,setSelected] = useState(() => available.map(item => item.key));
  const [pending,setPending] = useState(false),[error,setError] = useState('');
  async function submit(event) {
    event.preventDefault();setPending(true);setError('');
    const ids=Object.fromEntries(selected.map(key => [key,crypto.randomUUID()]));
    try {if (await onSave(data => addTemplateItems(data,selected,ids))) onClose();else setError('항목을 추가하지 못했습니다. 연결 상태를 확인해 주세요.')}
    catch(error) {setError(error.message)} finally {setPending(false)}
  }
  return <form className="budget-form" onSubmit={submit}><p className="budget-form-intro">필요한 항목만 선택하세요. 금액은 0원·미확정으로 시작하고, 같은 분류와 이름의 기존 항목은 유지합니다.</p><div className="budget-template-selection"><button type="button" className="text-button" onClick={() => setSelected(available.map(item => item.key))}>모두 선택</button><button type="button" className="text-button" onClick={() => setSelected([])}>선택 해제</button><span>{selected.length}개 선택</span></div><div className="budget-template-list">{available.map(item => <label key={item.key}><input type="checkbox" checked={selected.includes(item.key)} onChange={e => setSelected(current => e.target.checked ? [...current,item.key] : current.filter(key => key !== item.key))}/><span><small>{item.category}</small>{item.title}</span></label>)}</div>{available.length === 0 ? <p>기본 항목이 이미 모두 등록되어 있습니다.</p> : null}{error ? <p role="alert" className="budget-form-error">{error}</p> : null}<div className="modal-actions"><button type="button" className="outline-button" onClick={onClose} disabled={pending}>취소</button><button className="primary-button" disabled={pending || !selected.length}>선택 항목 추가 <Plus size={16}/></button></div></form>;
}

export default function BudgetPlanner({data,canEdit,onChange,onSettings}) {
  const [view,setView] = useState('items'),[dialog,setDialog] = useState(null),[expanded,setExpanded] = useState(null);
  const [search,setSearch] = useState(''),[category,setCategory] = useState(''),[status,setStatus] = useState('전체'),[sort,setSort] = useState('등록순'),[month,setMonth] = useState(''),[error,setError] = useState('');
  const summary = budgetSummary(data);
  const categories = [...new Set([...budgetCategories,...data.expenses.map(item => item.category)])];
  const filtered = data.expenses.filter(item => {
    const normalized = normalizeExpense(item), totals=expenseTotals(item);
    return (category === '' || category === item.category) && `${item.title} ${normalized.vendor}`.toLowerCase().includes(search.trim().toLowerCase()) && (view !== 'items' || status === '전체' || (status === '기한 지남' ? totals.overdue : totals.status === status));
  }).sort((a,b) => sort === '금액 큰순' ? expenseTotals(b).projected-expenseTotals(a).projected : sort === '결제일 빠른순' ? (normalizeExpense(a).dueDate || '9999').localeCompare(normalizeExpense(b).dueDate || '9999') : 0);
  const journal = paymentJournal(filtered).filter(payment => !month || payment.date.startsWith(month));
  const groups = categorySummary(filtered);
  const due = data.expenses.filter(item => {const normalized=normalizeExpense(item);return expenseTotals(item).outstanding > 0 && normalized.dueDate}).sort((a,b) => normalizeExpense(a).dueDate.localeCompare(normalizeExpense(b).dueDate)).slice(0,3);
  const selectedItem = dialog?.itemId ? data.expenses.find(item => item.id === dialog.itemId) : null;
  const selectedPayment = selectedItem && dialog?.paymentId ? normalizeExpense(selectedItem).payments.find(payment => payment.id === dialog.paymentId) : null;
  async function mutate(mutator) {
    if (!canEdit) return false;
    mutator(data); // Validate before sending; onChange reapplies against the latest shared revision.
    return onChange(mutator);
  }
  async function removeItem(item) {
    if (!canEdit || !window.confirm(`‘${item.title}’ 항목과 연결된 결제 기록을 삭제할까요?`)) return;
    try {await mutate(current => ({...current,expenses:current.expenses.filter(row => row.id !== item.id)}));setExpanded(null)} catch(error) {setError(error.message)}
  }
  async function removePayment(itemId,payment) {
    if (!canEdit || !window.confirm(`‘${payment.title}’ 결제 기록을 삭제할까요? 남은 잔금이 다시 계산됩니다.`)) return;
    try {await mutate(current => deletePayment(current,itemId,payment.id))} catch(error) {setError(error.message)}
  }
  function exportCsv() {
    if (!canEdit) return;
    const rows = view === 'payments' ? filtered.map(raw => {const item=normalizeExpense(raw);return {...item,payments:item.payments.filter(payment => !month || payment.date.startsWith(month))}}) : filtered;
    const url=URL.createObjectURL(new Blob([budgetCsv(rows,view)],{type:'text/csv;charset=utf-8;'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=view==='payments' ? 'our-chapter-payments.csv' : 'our-chapter-budget.csv';anchor.click();setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  function openPayment(item,payment=null) {setDialog({kind:'payment',itemId:item.id,paymentId:payment?.id})}
  function paymentRows(raw) {
    const item=normalizeExpense(raw);
    return <div className="budget-item-details"><div className="budget-detail-heading"><strong>결제 내역 · {item.title}</strong>{canEdit && item.actualAmount !== null && expenseTotals(item).outstanding > 0 ? <button className="text-button" onClick={() => openPayment(item)}><Plus size={14}/> 결제 기록 추가</button> : null}</div>{item.notes ? <p className="budget-item-notes">{item.notes}</p> : null}{item.payments.length ? <ul>{item.payments.map(payment => <li key={payment.id}><div><strong>{payment.title}</strong><span>{payment.date || '결제일 미입력'} · {payment.method} · {payment.payer}</span></div><Amount value={payment.amount}/>{canEdit ? <div className="budget-row-actions"><button className="icon-button" aria-label={`${item.title} ${payment.title} 결제 수정`} onClick={() => openPayment(item,payment)}><Pencil size={15}/></button><button className="icon-button" aria-label={`${item.title} ${payment.title} 결제 삭제`} onClick={() => removePayment(item.id,payment)}><Trash2 size={15}/></button></div> : null}</li>)}</ul> : <p className="budget-muted">{item.actualAmount === null ? '계약·확정 금액을 입력한 뒤 계약금과 잔금을 기록하세요.' : '아직 기록된 결제가 없습니다.'}</p>}</div>;
  }
  return <div className="budget-planner">
    <section className="budget-summary-grid" aria-label="전체 예산 현황">
      <article><span>총 예산 <Wallet size={16}/></span><h3><Amount value={data.budget}/></h3>{canEdit ? <button className="text-button" onClick={onSettings}>예산 변경 <Pencil size={12}/></button> : <p>우리의 결혼 준비 한도</p>}</article>
      <article><span>예상 총비용</span><h3><Amount value={summary.projected}/></h3><p>확정액 + 미확정 항목의 계획액</p></article>
      <article><span>결제 완료</span><h3><Amount value={summary.paid}/></h3><p>실제로 지급한 금액</p></article>
      <article><span>남은 잔금</span><h3><Amount value={summary.outstanding}/></h3><p>확정 금액 중 아직 결제하지 않은 금액</p></article>
    </section>
    <section className={`budget-balance ${summary.available < 0 ? 'over' : ''}`} aria-label="예산 여유">
      <div><span>{summary.available < 0 ? '예산 초과' : '예산 여유'}</span><strong>{money(Math.abs(summary.available))}원</strong><p>계획 배정 {money(summary.planned)}원 · {summary.unallocated < 0 ? '계획 초과' : '미배정'} {money(Math.abs(summary.unallocated))}원</p></div><div className="budget-balance-track"><i style={{width:`${Math.min(100,summary.projected/data.budget*100)}%`}}/></div><small>총 예산 대비 예상 비용 {Math.round(summary.projected/data.budget*100)}%</small>
    </section>
    {due.length ? <section className="budget-due-section" aria-label="다가오는 잔금 결제"><div className="section-heading"><h3><CalendarDays size={16}/> 챙겨야 할 잔금</h3><p>결제일이 정해진 미결제 항목, 빠른 순서대로.</p></div><div className="budget-due-grid">{due.map(raw => {const item=normalizeExpense(raw),totals=expenseTotals(item);return <button className={totals.overdue ? 'overdue' : ''} key={item.id} onClick={() => {setView('items');setCategory('');setStatus('전체');setSearch('');setExpanded(item.id)}}><span>{item.dueDate}{totals.overdue ? ' · 기한 지남' : ''}</span><strong>{item.title}</strong><Amount value={totals.outstanding}/></button>})}</div></section> : null}
    <section className="card budget-workspace">
      <div className="budget-workspace-heading"><div><h3>우리의 결혼 예산표 <span className="tag">{data.expenses.length}개 항목</span></h3><p>항목별 계획부터 계약금·잔금까지, 한곳에서 관리하세요.</p></div>{canEdit ? <div className="budget-toolbar"><button className="outline-button" onClick={() => setDialog({kind:'template'})}><ListChecks size={15}/> 기본 항목 불러오기</button><button className="primary-button" onClick={() => setDialog({kind:'item',itemId:null})}><Plus size={16}/> 예산 항목 추가</button></div> : null}</div>
      <div className="budget-tabs" role="group" aria-label="예산 보기 방식">{[['items','항목별 계획',ListChecks],['payments','결제 가계부',Receipt],['categories','분류별 집계',PieChart]].map(([key,label,Icon]) => <button key={key} aria-pressed={view===key} className={view===key ? 'selected' : ''} onClick={() => setView(key)}><Icon size={15}/>{label}</button>)}</div>
      <div className="budget-filters"><div className="budget-search"><Search size={15}/><input type="search" aria-label="예산 항목 검색" placeholder="항목·업체 검색" value={search} onChange={e => setSearch(e.target.value)}/></div><select aria-label="예산 분류 필터" value={category} onChange={e => setCategory(e.target.value)}><option value="">전체</option>{categories.map(category => <option key={category}>{category}</option>)}</select>{view==='items' ? <><select aria-label="결제 상태 필터" value={status} onChange={e => setStatus(e.target.value)}>{['전체','계획 중','미결제','부분 결제','결제 완료','기한 지남'].map(status => <option key={status}>{status}</option>)}</select><select aria-label="예산 정렬" value={sort} onChange={e => setSort(e.target.value)}>{['등록순','결제일 빠른순','금액 큰순'].map(sort => <option key={sort}>{sort}</option>)}</select></> : null}{view==='payments' ? <input type="month" aria-label="결제 월 필터" value={month} onChange={e => setMonth(e.target.value)}/> : null}{canEdit ? <button className="text-button" onClick={exportCsv}><Download size={14}/> CSV 내보내기</button> : null}</div>
      {error ? <p className="budget-form-error" role="alert">{error}</p> : null}
      {view==='items' ? filtered.length ? <div className="table-wrap"><table className="budget-table"><thead><tr><th>항목·업체</th><th>계획 금액</th><th>계약·확정</th><th>결제 완료</th><th>남은 잔금</th><th>계획 대비</th><th>상태·결제일</th><th><span className="sr-only">관리</span></th></tr></thead><tbody>{filtered.map(raw => {const item=normalizeExpense(raw),totals=expenseTotals(item);return <React.Fragment key={item.id}><tr><td className="budget-name-cell"><span className="tag">{item.category}</span><button className="budget-item-title" aria-expanded={expanded===item.id} aria-controls={`budget-detail-${item.id}`} onClick={() => setExpanded(current => current===item.id ? null : item.id)}>{item.title}<ChevronDown size={14}/></button><small>{item.vendor || '업체 미정'} · {item.priority}</small></td><td data-label="계획 금액"><Amount value={totals.planned}/></td><td data-label="계약·확정"><Amount value={totals.actual}/></td><td data-label="결제 완료"><Amount value={totals.paid}/></td><td data-label="남은 잔금"><Amount value={totals.actual===null ? null : totals.outstanding} empty="—"/></td><td data-label="계획 대비" className={totals.variance>0 ? 'budget-difference-over' : 'budget-difference'}>{totals.variance>0 ? '+' : ''}{money(totals.variance)}원</td><td className="budget-status-cell"><Status totals={totals}/><small>{item.dueDate || '결제일 미정'}</small></td><td className="budget-manage-cell">{canEdit ? <div className="budget-row-actions"><button className="icon-button" aria-label={`${item.title} 항목 수정`} onClick={() => setDialog({kind:'item',itemId:item.id})}><Pencil size={15}/></button><button className="icon-button" aria-label={`${item.title} 결제 기록 추가`} disabled={item.actualAmount===null || totals.outstanding===0} title={item.actualAmount===null ? '확정 금액을 먼저 입력해 주세요' : '결제 기록 추가'} onClick={() => openPayment(item)}><Plus size={17}/></button><button className="icon-button" aria-label={`${item.title} 항목 삭제`} onClick={() => removeItem(item)}><Trash2 size={15}/></button></div> : <span className="budget-muted">읽기 전용</span>}</td></tr>{expanded===item.id ? <tr className="budget-expanded-row"><td colSpan={8} id={`budget-detail-${item.id}`}>{paymentRows(item)}</td></tr> : null}</React.Fragment>})}</tbody></table></div> : <div className="budget-empty"><Wallet size={30}/><h4>{data.expenses.length ? '조건에 맞는 예산 항목이 없습니다.' : '우리의 결혼 예산을 구체적으로 정해 볼까요?'}</h4><p>{canEdit ? '기본 항목을 불러오거나 필요한 항목을 직접 추가하세요. 계획 금액은 언제든 수정할 수 있어요.' : '관리자가 등록한 예산 항목이 여기에 표시됩니다.'}</p></div> : null}
      {view==='payments' ? <><div className="budget-journal-total"><span>{month || '전체 기간'} · {journal.length}건 결제</span><strong>{money(journal.reduce((sum,payment) => sum+payment.amount,0))}원</strong>{month ? <button className="text-button" onClick={() => setMonth('')}>전체 기간 보기</button> : null}</div>{journal.length ? <div className="table-wrap"><table className="budget-journal-table"><thead><tr><th>결제일</th><th>항목·결제명</th><th>금액</th><th>결제수단·부담자</th><th><span className="sr-only">관리</span></th></tr></thead><tbody>{journal.map(payment => <tr key={`${payment.itemId}-${payment.id}`}><td>{payment.date || '미입력'}</td><td><strong>{payment.itemTitle}</strong><small>{payment.title} · {payment.category}</small></td><td><Amount value={payment.amount}/></td><td>{payment.method}<small>{payment.payer}</small></td><td>{canEdit ? <div className="budget-row-actions"><button className="icon-button" aria-label={`${payment.itemTitle} ${payment.title} 결제 수정`} onClick={() => openPayment(data.expenses.find(item => item.id===payment.itemId),payment)}><Pencil size={15}/></button><button className="icon-button" aria-label={`${payment.itemTitle} ${payment.title} 결제 삭제`} onClick={() => removePayment(payment.itemId,payment)}><Trash2 size={15}/></button></div> : null}</td></tr>)}</tbody></table></div> : <p className="budget-empty">이 기간에 기록된 결제가 없습니다.</p>}</> : null}
      {view==='categories' ? groups.length ? <div className="budget-category-list">{groups.map(group => <article key={group.category}><div><button className="text-button" onClick={() => {setCategory(group.category);setStatus('전체');setView('items')}}>{group.category} <ArrowUpRight size={14}/></button><span>{group.count}개 항목 · 전체 예산의 {Math.round(group.projected/data.budget*100)}%</span></div><div className="budget-category-track"><i style={{width:`${Math.min(100,group.projected/data.budget*100)}%`}}/></div><dl><div><dt>계획</dt><dd>{money(group.planned)}원</dd></div><div><dt>예상 비용</dt><dd>{money(group.projected)}원</dd></div><div><dt>결제 완료</dt><dd>{money(group.paid)}원</dd></div><div><dt>남은 잔금</dt><dd>{money(group.outstanding)}원</dd></div></dl></article>)}</div> : <p className="budget-empty">등록된 분류가 없습니다.</p> : null}
    </section>
    <details className="budget-help"><summary>예산표 읽는 법과 참고한 방식</summary><p><b>계획 금액</b>은 항목에 배정한 예산, <b>계약·확정 금액</b>은 정해진 총비용입니다. 미확정 항목은 계획 금액으로 예상 총비용에 포함합니다. <b>결제 완료</b>는 지급한 내역의 합계, <b>남은 잔금</b>은 확정 금액에서 지급액을 뺀 금액입니다.</p><p>기존 지출은 결제 완료 기록으로 표시합니다. 항목 수정에서 전체 계약 금액을 정리하고, 항목을 펼쳐 결제 내역을 수정할 수 있습니다. 기본 항목의 금액은 직접 입력하며, 예비비도 하나의 계획 항목으로 관리할 수 있습니다.</p><p>계획·실제 금액 비교는 <a href="https://www.vertex42.com/ExcelTemplates/wedding-budget.html" target="_blank" rel="noopener noreferrer">Vertex42 결혼 예산표</a>, 항목별 배분은 <a href="https://www.ynab.com/guide/where-does-my-money-go" target="_blank" rel="noopener noreferrer">YNAB</a>, 결혼 비용 분류는 <a href="https://www.theknot.com/content/wedding-budget-ways-to-save-money" target="_blank" rel="noopener noreferrer">The Knot</a>의 공개 안내를 참고했습니다.</p></details>
    {canEdit && dialog ? <BudgetDialog key={`${dialog.kind}-${dialog.itemId || 'new'}-${dialog.paymentId || 'new'}`} title={dialog.kind==='template' ? '결혼 예산 기본 항목' : dialog.kind==='payment' ? dialog.paymentId ? '결제 내역 수정' : '계약금·잔금 결제 기록' : dialog.itemId ? '예산 항목 수정' : '새 예산 항목'} onClose={() => setDialog(null)}>{dialog.kind==='template' ? <TemplatePicker expenses={data.expenses} onSave={mutate} onClose={() => setDialog(null)}/> : dialog.kind==='payment' ? selectedItem && (!dialog.paymentId || selectedPayment) ? <PaymentEditor item={selectedItem} payment={selectedPayment} onSave={mutate} onClose={() => setDialog(null)}/> : <p role="alert">항목 또는 결제 기록이 삭제되었습니다. 창을 닫고 목록을 다시 확인해 주세요.</p> : <ItemEditor item={selectedItem} existingId={dialog.itemId} onSave={mutate} onClose={() => setDialog(null)}/>}</BudgetDialog> : null}
  </div>;
}
