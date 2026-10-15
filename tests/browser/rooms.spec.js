import {test,expect} from '@playwright/test';
const defaults=['거실','안방','큰방','작은방','화장실','세탁실','베란다'];
async function admin(page){await page.goto('/');await page.getByLabel('이름',{exact:true}).fill('송윤오');await page.getByLabel('별명',{exact:true}).fill('예쁜강아지');await page.getByRole('button',{name:'관리자로 들어가기'}).click();await page.locator('.sidebar').getByRole('button',{name:'신혼집 꾸미기',exact:true}).click()}
const tab=(page,name)=>page.locator('.home-room-tabs').getByRole('button',{name,exact:true});
test('empty spaces persist, duplicate names are rejected and renamed spaces apply to future items',async({page})=>{
 await admin(page);for(const room of defaults)await expect(tab(page,`${room} 0`)).toBeVisible();await expect(page.locator('.home-room-tabs button')).toHaveCount(8);
 await page.getByRole('button',{name:'공간 관리',exact:true}).click();
 await page.getByLabel('새 공간 이름',{exact:true}).fill('드레스룸');await page.getByRole('button',{name:'공간 추가',exact:true}).click();
 await expect(page.getByRole('button',{name:'드레스룸 이름 변경',exact:true})).toBeVisible();
 await page.getByLabel('새 공간 이름',{exact:true}).fill(' 거실 ');await page.getByRole('button',{name:'공간 추가',exact:true}).click();await expect(page.getByRole('alert')).toContainText('이미 있는 공간');
 await page.getByRole('button',{name:'안방 이름 변경',exact:true}).click();await page.getByLabel('공간 이름',{exact:true}).fill('메인룸');await page.getByRole('button',{name:'공간 이름 저장',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();await expect(tab(page,'드레스룸 0')).toBeVisible();await expect(tab(page,'메인룸 0')).toBeVisible();await expect(tab(page,'안방 0')).toHaveCount(0);
 await page.getByRole('button',{name:'기본 품목 불러오기'}).click();await page.getByRole('checkbox',{name:/메인룸.*침대 프레임/}).check();await page.getByRole('button',{name:'선택 품목 추가'}).click();
 const bed=page.locator('.home-item-card').filter({hasText:'침대 프레임'});await expect(bed).toContainText('메인룸 · 가구');
 await tab(page,'메인룸 1').click();await page.getByRole('button',{name:'공간 관리',exact:true}).click();await page.getByRole('button',{name:'메인룸 이름 변경',exact:true}).click();await page.getByLabel('공간 이름',{exact:true}).fill('우리 안방');await page.getByRole('button',{name:'공간 이름 저장',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();await expect(bed).toBeVisible();await expect(tab(page,'우리 안방 1')).toHaveAttribute('aria-pressed','true');
 await page.reload();await page.locator('.sidebar').getByRole('button',{name:'신혼집 꾸미기',exact:true}).click();await expect(tab(page,'드레스룸 0')).toBeVisible();await expect(bed).toContainText('우리 안방 · 가구');
 await tab(page,'드레스룸 0').click();await page.getByRole('button',{name:'꾸미기 항목 추가'}).click();await expect(page.getByLabel('방·공간',{exact:true})).toHaveValue('드레스룸');await expect(page.locator('#home-room-options option[value="우리 안방"]')).toHaveCount(1);await page.keyboard.press('Escape');
 for(const width of [768,390,320]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 await page.getByRole('button',{name:'공간 관리',exact:true}).click();const box=await page.getByRole('dialog').boundingBox();expect(box.width).toBeLessThanOrEqual(320);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(844);await page.screenshot({path:'/tmp/wedding-rooms-manager-mobile.png',fullPage:false,animations:'disabled'});await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'접속 화면으로 돌아가기'}).click();await page.getByRole('button',{name:'게스트로 보기'}).click();await expect(page.locator('.invitation-page')).toBeVisible();await expect(tab(page,'드레스룸 0')).toHaveCount(0);await expect(page.locator('.sidebar')).toHaveCount(0);await expect(page.getByRole('button',{name:'공간 관리',exact:true})).toHaveCount(0);
});
const legacyTemplates=[['침대 프레임','침실','가구'],['매트리스','침실','가구'],['침구 세트','침실','패브릭'],['침실 커튼','침실','패브릭'],['소파','거실','가구'],['거실 테이블','거실','가구'],['TV','거실','가전'],['TV장','거실','수납'],['스탠드 조명','거실','조명'],['식탁·의자','주방·다이닝','가구'],['냉장고','주방·다이닝','가전'],['전자레인지','주방·다이닝','가전'],['세탁기','베란다·다용도실','가전'],['건조기','베란다·다용도실','가전'],['옷장','침실','수납'],['책상·의자','서재·작업실','가구'],['현관 수납장','현관','수납'],['욕실 수납·용품','욕실','소품']];
test('all previously imported default items migrate without losing data or being reimported',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 const items=legacyTemplates.map(([name,room,category],i)=>({id:`old-${i}`,name,room,category,priority:'필수',status:'배송 중',quantity:1,plannedUnit:100000,actualUnit:120000,width:10,depth:20,height:30,color:'오크',material:'원목',placement:'창가',productUrl:'https://example.com/item',deliveryDate:'2027-04-01',notes:'입력한 기록',expenseId:i===3?'linked-curtain':''}));
 const expense={id:'linked-curtain',homeItemId:'old-3',title:'침실 · 침실 커튼',category:'신혼집',plannedAmount:100000,actualAmount:120000,amount:120000,vendor:'기존 업체',priority:'필수',dueDate:'2027-03-01',notes:'기존 계약',payments:[{id:'paid',title:'계약금',amount:20000,date:'2026-10-13',method:'카드',payer:'공동'}]};
 const old={couple:'테스트 커플',date:'',budget:30000000,tasks:[],expenses:[expense],guests:[],saved:[],home:{budget:5000000,items}};
 await page.evaluate(data=>localStorage.setItem('our-chapter-v1',JSON.stringify(data)),old);await admin(page);
 await expect(page.locator('.home-item-card')).toHaveCount(18);for(const [room,count]of [['안방',5],['세탁실',2],['화장실',1],['작은방',1],['주방·다이닝',3],['현관',1]])await expect(tab(page,`${room} ${count}`)).toBeVisible();
 const curtain=page.locator('.home-item-card').filter({has:page.getByRole('heading',{name:'안방 커튼',exact:true})});await expect(curtain).toContainText('120,000');await expect(curtain).toContainText('입력한 기록');await expect(curtain.getByRole('button',{name:'예산에서 보기',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'기본 품목 불러오기'}).click();await expect(page.getByRole('checkbox')).toHaveCount(0);await expect(page.getByRole('dialog')).toContainText('이미 모두 등록');await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'공간 관리',exact:true}).click();await page.getByLabel('새 공간 이름',{exact:true}).fill('취미방');await page.getByRole('button',{name:'공간 추가',exact:true}).click();await page.keyboard.press('Escape');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));expect(stored.home.roomVersion).toBe(2);expect(stored.home.items).toHaveLength(18);expect(stored.home.items.map(i=>i.id)).toEqual(items.map(i=>i.id));expect(stored.expenses[0]).toEqual({...expense,title:'안방 · 안방 커튼'});
 for(let i=0;i<items.length;i++){const {room,name,templateKey,...remaining}=stored.home.items[i];const {room:oldRoom,name:oldName,...expected}=items[i];expect(remaining).toEqual(expected)}
 await page.reload();await page.locator('.sidebar').getByRole('button',{name:'신혼집 꾸미기',exact:true}).click();await expect(page.locator('.home-item-card')).toHaveCount(18);expect(errors).toEqual([]);
});
