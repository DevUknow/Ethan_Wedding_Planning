import {test,expect} from '@playwright/test';

async function admin(page){
 await page.goto('/');await page.getByLabel('이름',{exact:true}).fill('송윤오');await page.getByLabel('별명',{exact:true}).fill('예쁜강아지');await page.getByRole('button',{name:'관리자로 들어가기'}).click();await page.getByRole('button',{name:'신혼집 꾸미기',exact:true}).click();
}
async function addSofa(page){
 await page.getByRole('button',{name:'꾸미기 항목 추가'}).click();
 await page.getByLabel('품목명',{exact:true}).fill('우리 소파');
 await page.getByLabel('방·공간',{exact:true}).fill('거실');
 await page.getByLabel('수량',{exact:true}).fill('2');
 await page.getByLabel('계획 단가 (원)',{exact:true}).fill('500000');
 await page.getByLabel('실구매 단가 (원)',{exact:true}).fill('450000');
 await page.getByLabel('가로 (cm)',{exact:true}).fill('180');await page.getByLabel('깊이 (cm)',{exact:true}).fill('80');await page.getByLabel('높이 (cm)',{exact:true}).fill('70');
 await page.getByLabel('색상',{exact:true}).fill('아이보리');await page.getByLabel('소재',{exact:true}).fill('패브릭');await page.getByLabel('배치 위치',{exact:true}).fill('거실 벽 옆');
 await page.getByLabel('상품 링크',{exact:true}).fill('https://example.com/sofa');await page.getByLabel('배송·설치 예정일',{exact:true}).fill('2027-04-15');await page.getByLabel('메모',{exact:true}).fill('분리 세탁 가능한 커버');
 await page.getByRole('button',{name:'꾸미기 항목 저장'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}
const card=page=>page.locator('.home-item-card').filter({hasText:'우리 소파'});

test('home items, measurements, prices and status persist and budget links do not duplicate',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await admin(page);await addSofa(page);
 await expect(card(page)).toContainText('아이보리');await expect(card(page)).toContainText('180');await expect(card(page)).toContainText('900,000');
 await expect(card(page).getByRole('link',{name:/제품 보기/})).toHaveAttribute('href','https://example.com/sofa');await expect(card(page).getByRole('link',{name:/제품 보기/})).toHaveAttribute('rel','noopener noreferrer');
 await page.getByLabel('꾸미기 품목 검색').fill('없는 품목');await expect(card(page)).toHaveCount(0);await page.getByLabel('꾸미기 품목 검색').fill('아이보리');await expect(card(page)).toBeVisible();await page.getByLabel('꾸미기 품목 검색').fill('');
 await page.getByRole('button',{name:'안방 0',exact:true}).click();await expect(card(page)).toHaveCount(0);await page.getByRole('button',{name:'거실 1',exact:true}).click();await expect(card(page)).toBeVisible();
 await page.getByLabel('우리 소파 준비 상태').selectOption('배송 중');await page.getByLabel('꾸미기 상태 필터').selectOption('설치 완료');await expect(card(page)).toHaveCount(0);await page.getByLabel('꾸미기 상태 필터').selectOption('');
 await card(page).getByRole('button',{name:/예산에 연결/}).click();await page.getByRole('button',{name:'예산에 연결하기',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(card(page).getByRole('button',{name:/예산 반영/})).toBeVisible();await card(page).getByRole('button',{name:/예산 반영/}).click();await page.getByRole('button',{name:'예산에 반영하기',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));
 expect(stored.home.items[0].status).toBe('배송 중');expect(stored.expenses).toHaveLength(1);expect(stored.expenses[0].actualAmount).toBe(900000);expect(stored.expenses[0].payments).toEqual([]);
 await card(page).getByRole('button',{name:/수정/}).click();await page.getByLabel('실구매 단가 (원)',{exact:true}).fill('400000');await page.getByRole('button',{name:'꾸미기 항목 저장'}).click();
 stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));expect(stored.expenses[0].actualAmount).toBe(900000);
 await card(page).getByRole('button',{name:/예산 반영/}).click();await page.getByRole('button',{name:'예산에 반영하기',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));expect(stored.expenses[0].actualAmount).toBe(800000);expect(stored.expenses).toHaveLength(1);
 await page.reload();await page.getByRole('button',{name:'신혼집 꾸미기',exact:true}).click();await expect(card(page)).toContainText('패브릭');await expect(page.getByLabel('우리 소파 준비 상태')).toHaveValue('배송 중');
 await card(page).getByRole('button',{name:/예산에서 보기/}).click();await expect(page.getByRole('heading',{name:'예산 관리',exact:true})).toBeVisible();await expect(page.locator('.budget-table')).toContainText('우리 소파');
 await page.getByRole('button',{name:'신혼집 꾸미기',exact:true}).click();page.once('dialog',dialog=>dialog.accept());await card(page).getByRole('button',{name:/삭제/}).click();await expect(card(page)).toHaveCount(0);stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));expect(stored.expenses).toHaveLength(1);expect(errors).toEqual([]);
});

test('home budget and selected starter items work and previous backups can be restored',async({page})=>{
 await admin(page);await page.getByRole('button',{name:'꾸미기 예산 설정',exact:true}).click();await page.getByLabel('꾸미기 예산 (원)',{exact:true}).fill('5000000');await page.getByRole('button',{name:'꾸미기 예산 저장'}).click();
 await page.getByRole('button',{name:'기본 품목 불러오기'}).click();await page.getByRole('button',{name:'선택 해제',exact:true}).click();await page.getByRole('checkbox',{name:/소파/}).check();await page.getByRole('button',{name:'선택 품목 추가'}).click();await expect(page.locator('.home-item-card')).toHaveCount(1);
 let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));expect(stored.home.budget).toBe(5000000);expect(stored.home.items[0].plannedUnit).toBe(0);expect(stored.expenses).toHaveLength(0);
 const old={couple:'기존 커플',date:'',budget:30000000,tasks:[],expenses:[{id:'old',title:'기존 지출',category:'기타',amount:10000}],guests:[],saved:[]};
 page.once('dialog',dialog=>dialog.accept());await page.locator('input[type=file]').setInputFiles({name:'old-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await expect(page.getByRole('status')).toContainText('복원했습니다');await expect(page.locator('.home-item-card')).toHaveCount(0);
 await addSofa(page);stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));expect(stored.expenses[0].title).toBe('기존 지출');expect(stored.home.items).toHaveLength(1);
});

test('home mobile dialogs work and guest invitation hides private decorating records',async({page})=>{
 await admin(page);await addSofa(page);
 for(const width of [1024,768,390,320]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/our-chapter-home-mobile.png',fullPage:true,animations:'disabled'});
 await card(page).getByRole('button',{name:/수정/}).click();const box=await page.getByRole('dialog').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.width).toBeLessThanOrEqual(390);await page.keyboard.press('Escape');await expect(card(page).getByRole('button',{name:/수정/})).toBeFocused();
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/our-chapter-home-desktop.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'접속 화면으로 돌아가기'}).click();const beforeGuest=await page.evaluate(()=>localStorage.getItem('our-chapter-v1'));await page.getByRole('button',{name:'게스트로 보기'}).click();
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.invitation-page')).toBeVisible();await expect(page.getByRole('button',{name:'신혼집 꾸미기',exact:true})).toHaveCount(0);await expect(card(page)).toHaveCount(0);
 await expect(page.getByRole('button',{name:/꾸미기 항목 추가|기본 품목 불러오기|꾸미기 예산 설정|공간 관리|예산에 연결|예산 반영/})).toHaveCount(0);await expect(page.getByLabel('우리 소파 준비 상태')).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('our-chapter-v1'))).toBe(beforeGuest);
});
