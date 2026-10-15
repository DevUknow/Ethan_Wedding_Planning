import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInvitation,toPublicInvitation,saveInvitation,validInvitation,validInvitationSettings} from '../app/src/invitation-model.js';

const privateData = () => ({
  couple:'송윤오 ♥ 박예은',date:'2027-04-17',budget:50000000,
  tasks:[{id:'private-task',title:'private-task-token'}],
  expenses:[{id:'private-expense',notes:'private-expense-token'}],
  guests:[{id:'private-guest',name:'private-guest-token',phone:'010-1111-2222'}],
  saved:[],home:{items:[{notes:'private-home-token'}]},
  honeymoon:{items:[{notes:'private-trip-token'}]},
  futurePrivateSection:{secret:'private-future-token'},
});
const hero = {id:'hero',url:'https://example.com/couple.jpg',alt:'함께 찍은 사진'};
const gallery = [{id:'gallery-1',url:'https://example.com/gallery-1.jpg',alt:'우리의 첫 번째 사진'}];
const fields = {groom:'송윤오',bride:'박예은',date:'2027-04-17',time:'13:30',greeting:'함께할 첫날에 초대합니다.',heroPhoto:hero,gallery,directionsNote:'대중교통을 이용해 주세요.',contactGroom:'010-1234-5678',contactBride:'+82 10-2345-6789'};
const settings = () => {
  const {date,...value} = structuredClone(fields);
  return value;
};

test('old planning records produce an invitation without mutation or invented photos and time',()=>{
  const data = privateData();
  const original = structuredClone(data);
  const invitation = getInvitation(data);
  assert.equal(invitation.groom,'송윤오');
  assert.equal(invitation.bride,'박예은');
  assert.equal(invitation.date,data.date);
  assert.equal(invitation.time,'');
  assert.equal(invitation.heroPhoto,null);
  assert.deepEqual(invitation.gallery,[]);
  assert.equal(invitation.contactGroom,'');
  assert.equal(invitation.contactBride,'');
  assert.ok(invitation.greeting.length>0);
  assert.equal(validInvitation(invitation),true);
  assert.deepEqual(data,original);
  assert.equal(validInvitation(getInvitation()),true);
  assert.equal(getInvitation().date,'');
});

test('name fallbacks split only existing couple separators and keep the root date authoritative',()=>{
  assert.equal(getInvitation({couple:' 민수 & 지은 ',date:''}).groom,'민수');
  assert.equal(getInvitation({couple:' 민수 & 지은 ',date:''}).bride,'지은');
  assert.equal(getInvitation({couple:'민수 ♥ 지은',date:''}).bride,'지은');
  for (const couple of ['이름 하나','A ♥ B ♥ C',' & B','A & ','A'.repeat(41)+' & B',null]) {
    assert.equal(getInvitation({couple}).groom,'송윤오');
    assert.equal(getInvitation({couple}).bride,'박예은');
  }
  const data = {...privateData(),invitation:{...settings(),date:'2030-01-01'}};
  assert.equal(getInvitation(data).date,'2027-04-17');
  assert.equal(getInvitation({...data,date:'2027-02-29'}).date,'');
});

test('saving invitation edits changes the shared names and date while preserving other records',()=>{
  const data = privateData();
  const original = structuredClone(data);
  const next = saveInvitation(data,{...fields,groom:' 새 신랑 ',bride:' 새 신부 ',date:'2028-02-29',budget:'ignored-private-token'});
  assert.equal(next.couple,'새 신랑 ♥ 새 신부');
  assert.equal(next.date,'2028-02-29');
  assert.equal(next.invitation.groom,'새 신랑');
  assert.equal(next.invitation.bride,'새 신부');
  assert.equal(Object.hasOwn(next.invitation,'date'),false);
  assert.equal(Object.hasOwn(next.invitation,'budget'),false);
  assert.equal(validInvitationSettings(next.invitation),true);
  assert.equal(validInvitation(toPublicInvitation(next)),true);
  for (const key of ['budget','tasks','expenses','guests','saved','home','honeymoon','futurePrivateSection']) assert.equal(next[key],data[key]);
  assert.notEqual(next.invitation.heroPhoto,hero);
  assert.notEqual(next.invitation.gallery[0],gallery[0]);
  assert.deepEqual(data,original);
});

test('partial edits preserve latest invitation settings and latest unrelated changes',()=>{
  const first = saveInvitation(privateData(),fields);
  const latest = {...first,budget:55000000,guests:[{name:'latest guest'}],date:'2028-04-20',invitation:{...first.invitation,directionsNote:'최근 교통 안내',contactGroom:'010-9876-5432'}};
  const next = saveInvitation(latest,{greeting:'인사말만 수정합니다.'});
  assert.equal(next.date,'2028-04-20');
  assert.equal(next.couple,latest.couple);
  assert.equal(next.budget,55000000);
  assert.equal(next.guests,latest.guests);
  assert.equal(next.invitation.directionsNote,'최근 교통 안내');
  assert.equal(next.invitation.contactGroom,'010-9876-5432');
  assert.equal(next.invitation.greeting,'인사말만 수정합니다.');
});

test('public projection uses explicit top-level and photo allowlists for future private fields too',()=>{
  const data = privateData();
  data.invitation = {...settings(),budget:'private-settings-token',future:{secret:'private-settings-future-token'},heroPhoto:{...hero,storageSecret:'private-photo-token'},gallery:[{...gallery[0],receipt:'private-gallery-token'}]};
  const output = toPublicInvitation(data);
  assert.deepEqual(output,fields);
  assert.equal(validInvitation(output),true);
  assert.equal(validInvitationSettings(data.invitation),true);
  assert.deepEqual(Object.keys(output.heroPhoto).sort(),['alt','id','url']);
  assert.deepEqual(Object.keys(output.gallery[0]).sort(),['alt','id','url']);
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes('private-'),false);
  for (const key of ['budget','tasks','expenses','guests','saved','home','honeymoon','futurePrivateSection','future','storageSecret','receipt']) assert.equal(Object.hasOwn(output,key),false);
  const saved = saveInvitation(data,{greeting:'안전한 공개 인사말'});
  assert.equal(Object.hasOwn(saved.invitation,'future'),false);
  assert.deepEqual(saved.invitation.heroPhoto,hero);
  assert.deepEqual(saved.invitation.gallery,gallery);
});

test('public and settings validation reject missing fields, unsafe links and malformed dates or contacts',()=>{
  assert.equal(validInvitation(fields),true);
  assert.equal(validInvitationSettings(settings()),true);
  const invalid = [
    {groom:''},{groom:' '},{groom:'A'.repeat(41)},{bride:'B'.repeat(41)},
    {date:'2027-02-29'},{date:'2027-02-30'},{date:'2027-13-01'},{date:'2027-1-01'},{date:null},
    {time:'24:00'},{time:'12:60'},{time:'9:30'},{time:'13:30\n'},{time:null},
    {greeting:'x'.repeat(3001)},{greeting:null},{directionsNote:'x'.repeat(2001)},
    {contactGroom:'tel:01012345678'},{contactBride:'010\n12345678'},{contactBride:'++821012345678'},
    {contactBride:'010<12345678>'},{contactBride:'x'.repeat(41)},
    {heroPhoto:{}},{heroPhoto:{...hero,id:''}},{heroPhoto:{...hero,id:' hero'}},
    {heroPhoto:{...hero,alt:'x'.repeat(201)}},{heroPhoto:{...hero,url:'https://example.com/'+ 'x'.repeat(2000)}},
    {gallery:null},{gallery:[null]},{gallery:[gallery[0],gallery[0]]},
    {gallery:Array.from({length:13},(_,i)=>({...gallery[0],id:String(i)}))},
  ];
  for (const mutation of invalid) {
    assert.equal(validInvitation({...fields,...mutation}),false,JSON.stringify(mutation));
    assert.throws(()=>saveInvitation(privateData(),{...fields,...mutation}),/확인/);
  }
  for (const url of ['javascript:alert(1)','data:image/png;base64,abc','file:///tmp/image.jpg','/images/couple.jpg','https://username:password@example.com/photo.jpg','https://example.com/a b.jpg','https://example.com/\nphoto.jpg','not a url']) {
    const invitation = {...fields,heroPhoto:{...hero,url}};
    assert.equal(validInvitation(invitation),false,url);
    assert.throws(()=>saveInvitation(privateData(),invitation));
  }
  for (const key of Object.keys(fields)) {
    const missing = {...fields};
    delete missing[key];
    assert.equal(validInvitation(missing),false,key);
  }
  for (const value of [null,[],{},'']) assert.equal(validInvitationSettings(value),false);
  assert.equal(validInvitation({...fields,privateRecord:'must not be public'}),false);
  assert.equal(validInvitation({...fields,heroPhoto:{...hero,privateRecord:'must not be public'}}),false);
  assert.equal(validInvitation({...fields,contactGroom:'010-1234-5678\n'}),false);
});

test('empty optional fields, leap dates and explicit removal of photos remain valid',()=>{
  const next = saveInvitation(privateData(),{...fields,date:'2028-02-29',time:'',greeting:'',heroPhoto:null,gallery:[],directionsNote:'',contactGroom:'',contactBride:''});
  const output = toPublicInvitation(next);
  assert.equal(validInvitation(output),true);
  assert.equal(output.date,'2028-02-29');
  assert.equal(output.greeting,'');
  assert.equal(output.heroPhoto,null);
  assert.deepEqual(output.gallery,[]);
  assert.equal(output.time,'');
  assert.equal(validInvitation({...fields,heroPhoto:{...hero,url:'http://example.com/photo.jpg'}}),true);
  assert.equal(validInvitation({...fields,time:'00:00'}),true);
  assert.equal(validInvitation({...fields,time:'23:59'}),true);
});

test('projection suppresses malformed stored values and creates detached photos',()=>{
  const data = {...privateData(),invitation:{...settings(),time:'25:00',contactBride:'javascript:alert(1)',heroPhoto:{...hero,url:'data:image/png;base64,abc'},gallery:[gallery[0],gallery[0],{...hero,url:'file:///tmp/a'},null]}};
  const output = toPublicInvitation(data);
  assert.equal(validInvitation(output),true);
  assert.equal(output.time,'');
  assert.equal(output.contactBride,'');
  assert.equal(output.heroPhoto,null);
  assert.deepEqual(output.gallery,gallery);
  output.gallery[0].alt='공개 사본만 수정';
  assert.equal(data.invitation.gallery[0].alt,gallery[0].alt);
  const before = structuredClone(data);
  assert.throws(()=>saveInvitation(data,{time:'24:01'}));
  assert.deepEqual(data,before);
});
