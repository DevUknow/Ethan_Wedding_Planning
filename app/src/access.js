// Presentation roles for this static site. This is not server authentication.
const SESSION_KEY = 'our-chapter-access-v1';
const administrators = [
  {id:'yoono',name:'송윤오',nickname:'예쁜강아지'},
  {id:'yeeun',name:'박예은',nickname:'예쁜고양이'},
];

export function administratorFor(name,nickname) {
  const match=administrators.find(person=>person.name===name.trim()&&person.nickname===nickname.trim());
  return match?{role:'admin',id:match.id,name:match.name}:null;
}
export function isAdministrator(session) {
  return session?.role==='admin'&&administrators.some(person=>person.id===session.id);
}
export function readAccess(storage) {
  try {
    storage??=window.sessionStorage;
    const saved=JSON.parse(storage.getItem(SESSION_KEY));
    if(saved?.role==='guest')return {role:'guest',name:'게스트'};
    const person=isAdministrator(saved)&&administrators.find(person=>person.id===saved.id);
    return person?{role:'admin',id:person.id,name:person.name}:null;
  }catch{return null}
}
export function saveAccess(session,storage) {
  try {
    storage??=window.sessionStorage;
    if(session)storage.setItem(SESSION_KEY,JSON.stringify({role:session.role,...(session.id?{id:session.id}:{})}));
    else storage.removeItem(SESSION_KEY);
  }catch{/* In-memory access still works when session storage is unavailable. */}
}
