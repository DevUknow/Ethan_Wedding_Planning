export const initialData = {
  couple: '송윤오 ♥ 박예은', date: '', budget: 30000000,
  tasks: [
    {id:'t1',title:'우리에게 어울리는 웨딩홀 찾아보기',category:'장소',due:'',done:false},
    {id:'t2',title:'결혼식 전체 예산 함께 정하기',category:'예산',due:'',done:false},
    {id:'t3',title:'웨딩 촬영 무드보드 만들기',category:'스튜디오',due:'',done:false},
    {id:'t4',title:'초대하고 싶은 사람들 적어보기',category:'하객',due:'',done:false}
  ], expenses: [], guests: [], saved: []
};
export function daysUntil(date, today = new Date()) {
  if (!date) return null;
  const [y,m,d] = date.split('-').map(Number);
  return Math.round((new Date(y,m-1,d) - new Date(today.getFullYear(),today.getMonth(),today.getDate()))/86400000);
}
export function totals(data) {
  const spent = data.expenses.reduce((sum,item)=>sum+Number(item.amount),0);
  return {spent,remaining:data.budget-spent,completed:data.tasks.filter(t=>t.done).length,confirmed:data.guests.filter(g=>g.status==='참석').length};
}
export function validBackup(data) {
 return !!data && typeof data.couple==='string' && typeof data.date==='string' && (data.date==='' || /^\d{4}-\d{2}-\d{2}$/.test(data.date)) && Number.isFinite(data.budget) && data.budget>0 && Array.isArray(data.tasks) && data.tasks.every(t=>typeof t.id==='string'&&typeof t.title==='string'&&typeof t.category==='string'&&typeof t.due==='string'&&typeof t.done==='boolean') && Array.isArray(data.expenses)&&data.expenses.every(e=>typeof e.id==='string'&&typeof e.title==='string'&&typeof e.category==='string'&&Number.isFinite(e.amount)&&e.amount>0) && Array.isArray(data.guests)&&data.guests.every(g=>typeof g.id==='string'&&typeof g.name==='string'&&typeof g.side==='string'&&['미정','참석','불참'].includes(g.status)) && Array.isArray(data.saved)&&data.saved.every(s=>typeof s==='string');
}

export function upgradeData(data) {
  return data.couple === 'Ethan & You' ? {...data,couple:initialData.couple} : data;
}
