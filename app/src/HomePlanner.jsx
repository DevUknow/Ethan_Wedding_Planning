import React, {useEffect, useRef, useState} from 'react';
import {Plus, Pencil, Trash2, X, Check, Search, Sofa, Lamp, Refrigerator, Package, House, ListChecks, Wallet, ArrowUpRight, Link2, CalendarDays, Ruler, Heart, Leaf} from 'lucide-react';
import {homeRooms, homeCategories, homeStatuses, homeTemplate, getHome, homeItemTotals, homeSummary, saveHomeItem, setHomeBudget, deleteHomeItem, addHomeTemplateItems, linkHomeItemToBudget} from './home-model.js';
import {localToday, money} from './budget-model.js';
import './home.css';

const categoryIcons = {가구:Sofa,가전:Refrigerator,조명:Lamp,패브릭:Leaf,수납:Package,소품:Heart,기타:House};
const blankItem = {name:'',room:'거실',category:'가구',priority:'필수',status:'아이디어',quantity:1,plannedUnit:0,actualUnit:null,width:null,depth:null,height:null,color:'',material:'',placement:'',productUrl:'',deliveryDate:'',notes:'',expenseId:''};
const roomArt = <svg className="home-room-art" viewBox="0 0 400 240" fill="none" aria-hidden="true"><path d="M58 208V93a67 67 0 0 1 134 0v115" fill="#E2E5D3"/><path d="M72 192V94a53 53 0 0 1 106 0v98" fill="#F5F2E7"/><path d="M124 42v148M74 112h102" stroke="#D7D9C5" strokeWidth="3"/><circle cx="141" cy="78" r="23" fill="#EBDEC1"/><path d="M26 211h350" stroke="#CCCDB9" strokeWidth="2"/><ellipse cx="199" cy="212" rx="143" ry="12" fill="#C9CCB5" opacity=".28"/><path d="M263 64h52l16 48h-86l18-48Z" fill="#D3C6AB"/><path d="M288 112v89m-18 2h36" stroke="#9B9F85" strokeWidth="3" strokeLinecap="round"/><rect x="77" y="135" width="172" height="56" rx="13" fill="#A6AF8D"/><rect x="67" y="160" width="192" height="38" rx="12" fill="#919F7B"/><rect x="67" y="153" width="21" height="46" rx="9" fill="#899773"/><rect x="238" y="153" width="21" height="46" rx="9" fill="#899773"/><path d="M89 199v12m147-12v12" stroke="#737F62" strokeWidth="5" strokeLinecap="round"/><rect x="96" y="143" width="44" height="33" rx="7" fill="#E7DECB" transform="rotate(-5 96 143)"/><rect x="187" y="142" width="40" height="33" rx="7" fill="#C6CBAD" transform="rotate(8 187 142)"/><ellipse cx="187" cy="203" rx="49" ry="10" fill="#D5C8AE"/><path d="M151 204v24m72-24v24" stroke="#B1A48B" strokeWidth="4"/><path d="M330 205h27l-3-37h-21l-3 37Z" fill="#C1B49B"/><path d="M343 169v-42" stroke="#8B9674" strokeWidth="3"/><path d="M343 151c-23-2-27-17-27-17 19-4 26 5 27 17Zm0-11c24-4 27-20 27-20-19-2-26 8-27 20Zm0-8c-16-11-14-26-14-26 16 6 19 17 14 26Z" fill="#929D7B"/></svg>;

function HomeDialog({title, onClose, children}) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {dialog.close(); if (previous?.isConnected) previous.focus()};
  }, []);
  return <dialog ref={ref} className="home-dialog" aria-labelledby="home-dialog-title" onCancel={event => {event.preventDefault();onClose()}}><div className="home-dialog-heading"><h2 id="home-dialog-title">{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={21}/></button></div>{children}</dialog>;
}

function HomeItemEditor({item, existingId, onSave, onClose}) {
  const [values,setValues] = useState(() => {
    const initial = item || blankItem;
    return {...initial,...Object.fromEntries(['quantity','plannedUnit','actualUnit','width','depth','height'].map(key => [key,initial[key] === null ? '' : String(initial[key])]))};
  });
  const [error,setError] = useState(''),[pending,setPending] = useState(false);
  function field(key,value) {setValues(current => ({...current,[key]:value}));setError('')}
  async function submit(event) {
    event.preventDefault();setError('');setPending(true);
    const fields = {...values,quantity:Number(values.quantity),plannedUnit:Number(values.plannedUnit || 0),actualUnit:values.actualUnit === '' ? null : Number(values.actualUnit),...Object.fromEntries(['width','depth','height'].map(key => [key,values[key] === '' ? null : Number(values[key])]))};
    for (const key of ['name','room','color','material','placement','productUrl','notes']) fields[key] = fields[key].trim();
    const newId = crypto.randomUUID();
    try {if (await onSave(current => saveHomeItem(current,existingId,fields,newId))) onClose();else setError('저장하지 못했습니다. 연결 상태와 상단 안내를 확인해 주세요.')}
    catch(error) {setError(error.message)} finally {setPending(false)}
  }
  const planned = Number(values.quantity || 0)*Number(values.plannedUnit || 0);
  return <form className="home-form" onSubmit={submit}>
    <p className="home-form-intro">마음에 드는 제품부터 치수·예산·설치 일정까지, 필요한 정보를 함께 기록하세요.</p>
    <label>품목명<input autoFocus required maxLength={100} value={values.name} onChange={e => field('name',e.target.value)} placeholder="예: 거실 3인 소파, 침실 커튼"/></label>
    <div className="home-form-grid"><label>방·공간<input list="home-room-options" required maxLength={40} value={values.room} onChange={e => field('room',e.target.value)} placeholder="공간을 직접 입력해도 좋아요"/><datalist id="home-room-options">{homeRooms.map(room => <option key={room} value={room}/>)}</datalist></label><label>분류<select value={values.category} onChange={e => field('category',e.target.value)}>{homeCategories.map(category => <option key={category}>{category}</option>)}</select></label></div>
    <div className="home-form-grid"><label>우선순위<select value={values.priority} onChange={e => field('priority',e.target.value)}><option>필수</option><option>선택</option></select></label><label>준비 상태<select value={values.status} onChange={e => field('status',e.target.value)}>{homeStatuses.map(status => <option key={status}>{status}</option>)}</select></label></div>
    <fieldset><legend><Wallet size={15}/> 구매 계획</legend><div className="home-form-grid"><label>계획 단가 (원)<input type="number" min="0" max="1000000000000" step="1" required value={values.plannedUnit} onChange={e => field('plannedUnit',e.target.value)}/></label><label>실구매 단가 (원)<input type="number" min="0" max="1000000000000" step="1" value={values.actualUnit} onChange={e => field('actualUnit',e.target.value)} placeholder="확정 전에는 비워두세요"/></label></div><label>수량<input type="number" min="1" max="1000" step="1" required value={values.quantity} onChange={e => field('quantity',e.target.value)}/></label><p className="home-calculated">계획 합계 <strong>{Number.isFinite(planned) ? money(planned) : '—'}원</strong><span>단가 × 수량으로 계산됩니다.</span></p></fieldset>
    <fieldset><legend><Ruler size={15}/> 공간에 맞추기</legend><div className="home-form-grid home-dimensions"><label>가로 (cm)<input type="number" min="0.1" max="100000" step="0.1" value={values.width} onChange={e => field('width',e.target.value)} placeholder="선택"/></label><label>깊이 (cm)<input type="number" min="0.1" max="100000" step="0.1" value={values.depth} onChange={e => field('depth',e.target.value)} placeholder="선택"/></label><label>높이 (cm)<input type="number" min="0.1" max="100000" step="0.1" value={values.height} onChange={e => field('height',e.target.value)} placeholder="선택"/></label></div><div className="home-form-grid"><label>색상<input maxLength={80} value={values.color} onChange={e => field('color',e.target.value)} placeholder="예: 아이보리"/></label><label>소재<input maxLength={100} value={values.material} onChange={e => field('material',e.target.value)} placeholder="예: 패브릭, 원목"/></label></div><label>배치 위치<input maxLength={200} value={values.placement} onChange={e => field('placement',e.target.value)} placeholder="예: 거실 창가 오른쪽 벽"/></label></fieldset>
    <label>상품 링크<input type="url" maxLength={2000} value={values.productUrl} onChange={e => field('productUrl',e.target.value)} placeholder="https://"/></label>
    <label>배송·설치 예정일<input type="date" value={values.deliveryDate} onChange={e => field('deliveryDate',e.target.value)}/></label>
    <label>메모<textarea rows={3} maxLength={2000} value={values.notes} onChange={e => field('notes',e.target.value)} placeholder="구매 후보, 배송비, 실측·설치 시 확인할 점"/></label>
    {item?.expenseId ? <p className="home-form-intro">저장한 뒤 목록의 ‘예산 반영’을 누르면 연결된 결혼 예산의 금액을 갱신할 수 있어요.</p> : null}
    {error ? <p className="home-error" role="alert">{error}</p> : null}
    <div className="modal-actions"><button type="button" className="outline-button" disabled={pending} onClick={onClose}>취소</button><button className="primary-button" disabled={pending}>{pending ? '저장 중…' : '꾸미기 항목 저장'} <Check size={16}/></button></div>
  </form>;
}

function HomeBudgetEditor({budget,onSave,onClose}) {
  const [amount,setAmount] = useState(budget ? String(budget) : ''),[error,setError] = useState(''),[pending,setPending] = useState(false);
  async function submit(event) {
    event.preventDefault();setPending(true);setError('');
    try {if (await onSave(current => setHomeBudget(current,Number(amount || 0)))) onClose();else setError('저장하지 못했습니다. 연결 상태를 확인해 주세요.')}
    catch(error) {setError(error.message)} finally {setPending(false)}
  }
  return <form className="home-form" onSubmit={submit}><p className="home-form-intro">신혼집 가구·가전·소품을 위한 별도 한도를 정하세요. 결혼 총 예산은 예산 관리에서 따로 설정합니다.</p><label>꾸미기 예산 (원)<input autoFocus type="number" min="0" max="1000000000000" step="1" value={amount} onChange={e => {setAmount(e.target.value);setError('')}} placeholder="예: 10000000"/></label><p className="home-form-intro">0원 또는 빈칸으로 저장하면 한도를 미설정으로 표시합니다.</p>{error ? <p className="home-error" role="alert">{error}</p> : null}<div className="modal-actions"><button type="button" className="outline-button" disabled={pending} onClick={onClose}>취소</button><button className="primary-button" disabled={pending}>{pending ? '저장 중…' : '꾸미기 예산 저장'} <Check size={16}/></button></div></form>;
}

function HomeTemplatePicker({items,onSave,onClose}) {
  const existing = new Set(items.map(item => `${item.room}\0${item.name}`));
  const available = homeTemplate.filter(item => !existing.has(`${item.room}\0${item.name}`));
  const [selected,setSelected] = useState([]),[error,setError] = useState(''),[pending,setPending] = useState(false);
  async function submit(event) {
    event.preventDefault();setPending(true);setError('');
    const ids = Object.fromEntries(selected.map(key => [key,crypto.randomUUID()]));
    try {if (await onSave(current => addHomeTemplateItems(current,selected,ids))) onClose();else setError('추가하지 못했습니다. 연결 상태를 확인해 주세요.')}
    catch(error) {setError(error.message)} finally {setPending(false)}
  }
  return <form className="home-form" onSubmit={submit}><p className="home-form-intro">우리 집에 필요한 품목만 골라보세요. 금액은 0원·미확정으로 시작하며 직접 입력할 수 있어요.</p><div className="home-template-tools"><button type="button" className="text-button" onClick={() => setSelected(available.map(item => item.key))}>모두 선택</button><button type="button" className="text-button" onClick={() => setSelected([])}>선택 해제</button><span>{selected.length}개 선택</span></div><div className="home-template-list">{available.map(item => <label key={item.key}><input type="checkbox" checked={selected.includes(item.key)} onChange={e => setSelected(current => e.target.checked ? [...current,item.key] : current.filter(key => key !== item.key))}/><span><small>{item.room} · {item.category}</small>{item.name}</span></label>)}</div>{available.length ? null : <p className="home-form-intro">기본 품목이 이미 모두 등록되어 있습니다.</p>}{error ? <p className="home-error" role="alert">{error}</p> : null}<div className="modal-actions"><button type="button" className="outline-button" disabled={pending} onClick={onClose}>취소</button><button className="primary-button" disabled={pending || !selected.length}>선택 품목 추가 <Plus size={16}/></button></div></form>;
}

function HomeBudgetLink({item,linkedExpense,onSave,onClose}) {
  const [error,setError] = useState(''),[pending,setPending] = useState(false);
  const totals = homeItemTotals(item);
  async function submit(event) {
    event.preventDefault();setPending(true);setError('');
    try {if (await onSave(current => linkHomeItemToBudget(current,item.id))) onClose();else setError('반영하지 못했습니다. 연결 상태를 확인해 주세요.')}
    catch(error) {setError(error.message)} finally {setPending(false)}
  }
  return <form className="home-form" onSubmit={submit}><div className="home-link-preview"><span>{item.room} · {item.category}</span><strong>{item.name}</strong><dl><div><dt>계획 금액</dt><dd>{money(totals.planned)}원</dd></div><div><dt>계약·확정 금액</dt><dd>{totals.actual === null ? '미확정' : `${money(totals.actual)}원`}</dd></div></dl></div><p className="home-form-intro">{linkedExpense ? '연결된 예산 항목의 이름·금액·우선순위를 현재 품목 정보로 갱신합니다. 기존 업체·메모·결제일·결제 기록은 유지됩니다.' : '결혼 예산 관리에 이 품목의 계획·확정 금액을 추가합니다. 결제 내역은 예산 관리에서 별도로 기록하세요.'}</p><p className="home-form-intro">품목을 수정할 때마다 자동으로 반영되지는 않아요. 다시 반영하려면 목록의 ‘예산 반영’을 눌러주세요. 배송·설치 예정일은 잔금 결제일과 별도로 관리합니다.</p>{error ? <p className="home-error" role="alert">{error}</p> : null}<div className="modal-actions"><button type="button" className="outline-button" disabled={pending} onClick={onClose}>취소</button><button className="primary-button" disabled={pending}>{pending ? '반영 중…' : linkedExpense ? '예산에 반영하기' : '예산에 연결하기'} <Link2 size={16}/></button></div></form>;
}

function HomeItemCard({item,linkedExpense,canEdit,busy,onEdit,onDelete,onStatus,onLink,onOpenBudget}) {
  const Icon = categoryIcons[item.category] || House;
  const totals = homeItemTotals(item);
  const measurements = [['가로',item.width],['깊이',item.depth],['높이',item.height]].filter(([,value]) => value !== null);
  return <article className={`home-item-card ${item.status === '설치 완료' ? 'installed' : ''}`}>
    <div className="home-item-top"><div className="home-item-icon"><Icon size={22}/></div><div className="home-item-tags"><span>{item.room} · {item.category}</span><span className={`home-status home-status-${homeStatuses.indexOf(item.status)}`}>{item.status}</span></div>{canEdit ? <div className="home-item-actions"><button className="icon-button" aria-label={`${item.name} 수정`} disabled={busy} onClick={onEdit}><Pencil size={15}/></button><button className="icon-button" aria-label={`${item.name} 삭제`} disabled={busy} onClick={onDelete}><Trash2 size={15}/></button></div> : null}</div>
    <h3>{item.name}</h3><div className="home-item-description"><span className={`home-priority ${item.priority === '필수' ? 'essential' : ''}`}>{item.priority}</span><span>{[item.color,item.material].filter(Boolean).join(' · ') || '색상·소재 미정'}</span></div>
    <div className="home-item-specs">{item.placement ? <p><House size={14}/><span>{item.placement}</span></p> : null}{measurements.length ? <p><Ruler size={14}/><span>{measurements.map(([label,value]) => `${label} ${value}`).join(' · ')} cm</span></p> : null}<p className={item.deliveryDate && item.deliveryDate < localToday() && item.status !== '설치 완료' ? 'home-date-past' : ''}><CalendarDays size={14}/><span>{item.deliveryDate ? `${item.deliveryDate} 배송·설치${item.deliveryDate < localToday() && item.status !== '설치 완료' ? ' · 일정 확인' : ''}` : '배송·설치 일정 미정'}</span></p></div>
    <div className="home-item-costs"><div><span>계획 <small>{money(item.plannedUnit)}원 × {item.quantity}</small></span><strong>{money(totals.planned)}<small>원</small></strong></div><div><span>실구매 {item.actualUnit !== null ? <small>{money(item.actualUnit)}원 × {item.quantity}</small> : null}</span><strong className={totals.actual === null ? 'home-price-unset' : ''}>{totals.actual === null ? '미확정' : <>{money(totals.actual)}<small>원</small></>}</strong></div>{totals.actual !== null && totals.variance !== 0 ? <p className={totals.variance > 0 ? 'over' : ''}>계획 대비 {totals.variance > 0 ? '+' : '−'}{money(Math.abs(totals.variance))}원</p> : null}</div>
    {item.notes ? <p className="home-item-notes">{item.notes}</p> : null}
    <div className="home-item-footer">{item.productUrl ? <a className="home-product-link" href={item.productUrl} target="_blank" rel="noopener noreferrer">제품 보기 <ArrowUpRight size={14}/><span className="sr-only">: {item.name} (새 창)</span></a> : <span className="home-no-link">제품 링크 미등록</span>}{linkedExpense ? <button className="home-linked" onClick={onOpenBudget}><Link2 size={12}/> 예산에서 보기</button> : item.expenseId ? <span className="home-no-link">예산 연결 확인 필요</span> : null}</div>
    {canEdit ? <div className="home-item-controls"><select aria-label={`${item.name} 준비 상태`} value={item.status} disabled={busy} onChange={e => onStatus(e.target.value)}>{homeStatuses.map(status => <option key={status}>{status}</option>)}</select><button className="outline-button" disabled={busy} onClick={onLink}><Link2 size={13}/>{linkedExpense ? '예산 반영' : '예산에 연결'}</button></div> : null}
  </article>;
}

export default function HomePlanner({data,canEdit,onChange,onOpenBudget}) {
  const [room,setRoom] = useState(''),[search,setSearch] = useState(''),[category,setCategory] = useState(''),[status,setStatus] = useState(''),[sort,setSort] = useState('등록순');
  const [dialog,setDialog] = useState(null),[error,setError] = useState(''),[busyId,setBusyId] = useState('');
  const home = getHome(data),summary = homeSummary(data);
  const rooms = [...new Set([...homeRooms,...home.items.map(item => item.room)])];
  const selectedItem = dialog?.itemId ? home.items.find(item => item.id === dialog.itemId) : null;
  const filtered = home.items.filter(item => (!room || item.room === room) && (!category || item.category === category) && (!status || item.status === status) && `${item.name} ${item.room} ${item.color} ${item.material} ${item.placement} ${item.notes}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b) => sort === '금액 큰순' ? homeItemTotals(b).projected-homeItemTotals(a).projected : sort === '예정일 빠른순' ? (a.deliveryDate || '9999').localeCompare(b.deliveryDate || '9999') : sort === '필수 먼저' ? Number(a.priority !== '필수')-Number(b.priority !== '필수') : 0);
  const installedPercent = summary.count ? Math.round(summary.installed/summary.count*100) : 0;
  const budgetRatio = summary.budget ? Math.round(summary.projected/summary.budget*100) : 0;
  async function mutate(mutator) {
    if (!canEdit) return false;
    mutator(data);
    return onChange(mutator);
  }
  async function changeStatus(itemId,nextStatus) {
    if (!canEdit || busyId) return;
    setBusyId(itemId);setError('');
    try {
      const saved = await mutate(current => {
        const currentItem = getHome(current).items.find(item => item.id === itemId);
        if (!currentItem) throw Error('다른 기기에서 삭제된 품목입니다. 목록을 다시 확인해 주세요.');
        return saveHomeItem(current,itemId,{status:nextStatus},itemId);
      });
      if (!saved) setError('상태를 저장하지 못했습니다. 연결 상태를 확인해 주세요.');
    } catch(error) {setError(error.message)} finally {setBusyId('')}
  }
  async function removeItem(item) {
    if (!canEdit || busyId || !window.confirm(`‘${item.name}’ 꾸미기 품목을 삭제할까요? 연결된 결혼 예산 항목과 결제 기록은 보존됩니다.`)) return;
    setBusyId(item.id);setError('');
    try {if (!await mutate(current => deleteHomeItem(current,item.id))) setError('삭제하지 못했습니다. 연결 상태를 확인해 주세요.')}
    catch(error) {setError(error.message)} finally {setBusyId('')}
  }
  return <div className="home-planner">
    <section className="home-intro"><div className="home-intro-copy"><span className="eyebrow">A PLACE TO CALL OURS</span><h2>취향을 모아,<br/>우리다운 집을 만들어요.</h2><p>방마다 필요한 것, 마음에 드는 제품, 들어갈 자리까지.<br className="home-desktop-break"/> 하나씩 정리하며 함께 살 공간을 채워가요.</p><span className="home-intro-note"><House size={14}/> 우리의 첫 집, 우리의 작은 계획</span></div>{roomArt}</section>
    <section className="home-summary" aria-label="신혼집 꾸미기 현황"><article><span>꾸미기 예산 <Wallet size={16}/></span><h3>{summary.budget ? <>{money(summary.budget)}<small>원</small></> : <span className="home-summary-unset">한도 미설정</span>}</h3>{canEdit ? <button className="text-button" aria-label="꾸미기 예산 설정" onClick={() => setDialog({kind:'budget'})}>{summary.budget ? '예산 변경' : '예산 정하기'} <Pencil size={12}/></button> : <p>신혼집을 위한 별도 예산</p>}</article><article><span>예상 총비용</span><h3>{money(summary.projected)}<small>원</small></h3><p>실구매액 + 미확정 품목의 계획액</p></article><article><span>실구매 확정</span><h3>{money(summary.confirmed)}<small>원</small></h3><p>금액이 확정된 품목의 합계</p></article><article><span>우리 집 완성도 <House size={16}/></span><h3>{installedPercent}<small>%</small></h3><p>{summary.count}개 품목 중 {summary.installed}개 설치 완료</p></article></section>
    <section className={`home-budget-strip ${summary.budget && summary.available < 0 ? 'over' : ''}`} aria-label="꾸미기 예산 배정"><div><strong>{summary.budget ? `${summary.available < 0 ? '예산 초과' : '예산 여유'} ${money(Math.abs(summary.available))}원` : '우리 집을 위한 예산을 정해보세요'}</strong><span>계획 합계 {money(summary.planned)}원 · 주문·배송·설치 {summary.ordered}개</span></div>{summary.budget ? <div className="home-budget-progress"><div><i style={{width:`${Math.min(100,budgetRatio)}%`}}/></div><span>예상 비용 {budgetRatio}%</span></div> : null}</section>
    <section className="home-board"><div className="home-board-heading"><div><span className="eyebrow">ROOMS & PIECES</span><h2>공간별 꾸미기 목록 <span>{home.items.length}</span></h2><p>구매 전 실측부터 배송·설치까지 함께 체크해요.</p></div>{canEdit ? <div className="home-toolbar"><button className="outline-button" onClick={() => setDialog({kind:'template'})}><ListChecks size={15}/> 기본 품목 불러오기</button><button className="primary-button" onClick={() => setDialog({kind:'item',itemId:null})}><Plus size={16}/> 꾸미기 항목 추가</button></div> : null}</div>
      <div className="home-room-tabs" role="group" aria-label="방·공간 필터">{['',...rooms].map(value => <button key={value || 'all'} className={room === value ? 'selected' : ''} aria-pressed={room === value} onClick={() => setRoom(value)}>{value || '모든 공간'}<span>{value ? home.items.filter(item => item.room === value).length : home.items.length}</span></button>)}</div>
      <div className="home-filters"><div className="home-search"><Search size={16}/><input type="search" aria-label="꾸미기 품목 검색" value={search} onChange={e => setSearch(e.target.value)} placeholder="품목·색상·소재 검색"/></div><select aria-label="꾸미기 분류 필터" value={category} onChange={e => setCategory(e.target.value)}><option value="">전체 분류</option>{homeCategories.map(value => <option key={value}>{value}</option>)}</select><select aria-label="꾸미기 상태 필터" value={status} onChange={e => setStatus(e.target.value)}><option value="">모든 상태</option>{homeStatuses.map(value => <option key={value}>{value}</option>)}</select><select aria-label="꾸미기 정렬" value={sort} onChange={e => setSort(e.target.value)}>{['등록순','필수 먼저','예정일 빠른순','금액 큰순'].map(value => <option key={value}>{value}</option>)}</select></div>
      {error ? <p className="home-error" role="alert">{error}</p> : null}
      {filtered.length ? <><div className="home-result-count">{room || '모든 공간'} · {filtered.length}개 품목<span>예상 비용 {money(filtered.reduce((sum,item) => sum+homeItemTotals(item).projected,0))}원</span></div><div className="home-item-grid">{filtered.map(item => <HomeItemCard key={item.id} item={item} linkedExpense={data.expenses.find(expense => expense.id === item.expenseId)} canEdit={canEdit} busy={!!busyId} onEdit={() => setDialog({kind:'item',itemId:item.id})} onDelete={() => removeItem(item)} onStatus={nextStatus => changeStatus(item.id,nextStatus)} onLink={() => setDialog({kind:'link',itemId:item.id})} onOpenBudget={onOpenBudget}/>)}</div></> : <div className="home-empty"><div><Sofa size={33}/><Lamp size={25}/></div><h3>{home.items.length ? '조건에 맞는 품목이 없어요.' : '우리 집에 가장 먼저 놓고 싶은 것은?'}</h3><p>{home.items.length ? '다른 공간을 보거나 검색·필터 조건을 바꿔보세요.' : canEdit ? '기본 품목에서 필요한 것만 고르거나, 마음에 드는 제품을 직접 추가해보세요.' : '두 사람의 가구·가전·소품 계획이 여기에 차곡차곡 쌓입니다.'}</p>{canEdit && !home.items.length ? <button className="outline-button" onClick={() => setDialog({kind:'template'})}>기본 품목 둘러보기 <ArrowUpRight size={15}/></button> : null}{home.items.length ? <button className="text-button" onClick={() => {setRoom('');setSearch('');setCategory('');setStatus('')}}>필터 초기화</button> : null}</div>}
    </section>
    <div className="home-budget-note"><Link2 size={17}/><div><strong>꾸미기 계획과 결혼 예산을 함께 관리해요.</strong><p>꾸미기 예산은 별도로 계산합니다. ‘예산에 연결’을 누른 품목만 결혼 예산에 포함되며, 결제는 예산 관리에서 기록하세요.</p></div><button className="text-button" onClick={onOpenBudget}>예산 관리 <ArrowUpRight size={15}/></button></div>
    {canEdit && dialog ? <HomeDialog key={`${dialog.kind}-${dialog.itemId || 'new'}`} title={dialog.kind === 'budget' ? '신혼집 꾸미기 예산' : dialog.kind === 'template' ? '우리 집 기본 품목 고르기' : dialog.kind === 'link' ? '결혼 예산에 반영' : dialog.itemId ? '꾸미기 항목 수정' : '새 꾸미기 항목'} onClose={() => setDialog(null)}>{dialog.kind === 'budget' ? <HomeBudgetEditor budget={home.budget} onSave={mutate} onClose={() => setDialog(null)}/> : dialog.kind === 'template' ? <HomeTemplatePicker items={home.items} onSave={mutate} onClose={() => setDialog(null)}/> : dialog.itemId && !selectedItem ? <p className="home-error" role="alert">다른 기기에서 삭제된 품목입니다. 창을 닫고 목록을 다시 확인해 주세요.</p> : dialog.kind === 'link' ? <HomeBudgetLink item={selectedItem} linkedExpense={data.expenses.find(expense => expense.id === selectedItem.expenseId)} onSave={mutate} onClose={() => setDialog(null)}/> : <HomeItemEditor item={selectedItem} existingId={dialog.itemId} onSave={mutate} onClose={() => setDialog(null)}/>}</HomeDialog> : null}
  </div>;
}
