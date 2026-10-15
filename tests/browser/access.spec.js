import {test,expect} from '@playwright/test';

async function enterAdmin(page,name='송윤오',nickname='예쁜강아지'){
 await page.getByLabel('이름',{exact:true}).fill(name);
 await page.getByLabel('별명',{exact:true}).fill(nickname);
 await page.getByRole('button',{name:'관리자로 들어가기'}).click();
}
test('entry form rejects mismatches and both administrators can edit',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/우리의 결혼 준비에/})).toBeVisible();
 await page.screenshot({path:'/tmp/our-chapter-entry-desktop.png',fullPage:true});
 await enterAdmin(page,'송윤오','예쁜고양이');
 await expect(page.getByRole('alert')).toContainText('조합을 확인');
 await expect(page.getByRole('heading',{name:/설레는 시작/})).toHaveCount(0);
 await enterAdmin(page);
 await expect(page.locator('.role-badge')).toHaveText('송윤오 · 관리자');
 await page.getByRole('button',{name:'새로운 할 일 추가'}).click();
 await page.getByLabel('할 일',{exact:true}).fill('함께 보존할 할 일');
 await page.getByRole('button',{name:'저장하기'}).click();
 await page.reload();
 await expect(page.locator('.role-badge')).toHaveText('송윤오 · 관리자');
 await page.getByRole('button',{name:'접속 화면으로 돌아가기'}).click();
 await enterAdmin(page,'박예은','예쁜고양이');
 await expect(page.locator('.role-badge')).toHaveText('박예은 · 관리자');
 await page.getByRole('button',{name:'체크리스트',exact:true}).click();
 await expect(page.getByText('함께 보존할 할 일',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'함께 보존할 할 일 완료',exact:true}).click();
 await expect(page.getByRole('button',{name:'함께 보존할 할 일 완료 취소'})).toBeEnabled();
});
test('guest sees only a public mobile invitation and no private planning records',async({page})=>{
 await page.goto('/');
 const data={couple:'송윤오 ♥ 박예은',date:'2027-05-22',budget:20000000,tasks:[{id:'task',title:'비공개 할 일',category:'장소',due:'2027-01-21',done:false}],expenses:[{id:'expense',title:'비공개 지출',category:'기타',amount:50000}],guests:[{id:'guest',name:'비공개 하객 이름',side:'함께',status:'참석'}],saved:['garden']};
 await page.evaluate(data=>localStorage.setItem('our-chapter-v1',JSON.stringify(data)),data);
 await page.reload();await page.getByRole('button',{name:'게스트로 보기'}).click();
 await expect(page.locator('.invitation-page')).toBeVisible();
 await expect(page.getByRole('heading',{name:'우리, 결혼합니다',exact:true})).toBeVisible();
 await expect(page.locator('.invitation-page')).toContainText('더파티움 안양');
 for(const name of ['웨딩 설정','백업','체크리스트','예산 관리','하객 관리','우리의 일정','신혼집 꾸미기','신혼여행']) await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
 for(const secret of ['비공개 할 일','비공개 지출','비공개 하객 이름']) await expect(page.getByText(secret,{exact:true})).toHaveCount(0);
 await expect(page.locator('.sidebar')).toHaveCount(0);await expect(page.locator('input[type=file]')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'주소 복사',exact:true})).toBeEnabled();
 await expect(page.getByRole('link',{name:/네이버 지도/})).toBeVisible();
 const afterEntry=await page.evaluate(()=>localStorage.getItem('our-chapter-v1'));
 await page.reload();await expect(page.locator('.invitation-page')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('our-chapter-v1'))).toBe(afterEntry);
 await page.getByRole('button',{name:'관리자 로그인',exact:true}).click();
 await expect(page.getByRole('heading',{name:/우리의 결혼 준비에/})).toBeVisible();
});
test('mobile entry and guest invitation fit the screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.getByRole('heading',{name:/우리의 결혼 준비에/})).toBeVisible();
 await page.screenshot({path:'/tmp/our-chapter-entry-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'게스트로 보기'}).click();
 await expect(page.locator('.invitation-page')).toBeVisible();
 await expect(page.getByRole('button',{name:'메뉴 열기'})).toHaveCount(0);
 for(const width of [1024,768,390,320]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/our-chapter-guest-mobile.png',fullPage:true,animations:'disabled'});
});
