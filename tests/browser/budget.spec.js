import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const name='브리에홀 대관료';
async function admin(page){
 await page.goto('/');await page.getByLabel('이름',{exact:true}).fill('송윤오');await page.getByLabel('별명',{exact:true}).fill('예쁜강아지');await page.getByRole('button',{name:'관리자로 들어가기'}).click();await page.getByRole('button',{name:'예산 관리',exact:true}).click();
}
async function addItem(page){
 await page.getByRole('button',{name:'예산 항목 추가'}).click();await page.getByLabel('예산 항목',{exact:true}).fill(name);await page.getByLabel('업체',{exact:true}).fill('더파티움 안양');await page.getByLabel('계획 금액 (원)',{exact:true}).fill('1000000');await page.getByLabel('계약·확정 금액 (원)').fill('1200000');await page.getByLabel('잔금 결제일').fill('2025-01-01');await page.getByLabel('메모',{exact:true}).fill('부가세 포함\n추가 연출 별도');await page.getByRole('button',{name:'예산 항목 저장'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function pay(page,amount='200000'){
 await page.getByRole('button',{name:`${name} 결제 기록 추가`,exact:true}).click();await page.getByLabel('결제 금액 (원)').fill(amount);await page.getByLabel('결제일',{exact:true}).fill('2026-10-13');await page.getByLabel('부담자').selectOption('신랑');await page.getByRole('button',{name:'결제 기록 저장'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('plans, deposits, payment edits and contract edits persist without double counting',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await admin(page);await addItem(page);
 await expect(page.locator('.budget-summary-grid article').nth(1)).toContainText('1,200,000');await expect(page.locator('.budget-summary-grid article').nth(2)).toContainText('0');
 await pay(page);await expect(page.locator('.budget-summary-grid article').nth(2)).toContainText('200,000');await expect(page.locator('.budget-summary-grid article').nth(3)).toContainText('1,000,000');
 await page.getByRole('button',{name:'결제 가계부',exact:true}).click();await page.getByRole('button',{name:`${name} 계약금 결제 수정`,exact:true}).click();await page.getByLabel('결제 금액 (원)').fill('300000');await page.getByRole('button',{name:'결제 기록 저장'}).click();await expect(page.locator('.budget-journal-total')).toContainText('300,000원');
 await page.getByLabel('결제 월 필터').fill('2026-09');await expect(page.getByText('이 기간에 기록된 결제가 없습니다.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'전체 기간 보기'}).click();
 await page.getByRole('button',{name:'항목별 계획',exact:true}).click();await page.getByRole('button',{name:`${name} 항목 수정`}).click();await page.getByLabel('계약·확정 금액 (원)').fill('200000');await page.getByRole('button',{name:'예산 항목 저장'}).click();await expect(page.getByRole('alert')).toContainText('이미 결제한 300,000원');
 await page.getByLabel('계약·확정 금액 (원)').fill('1100000');await page.getByRole('button',{name:'예산 항목 저장'}).click();await expect(page.locator('.budget-summary-grid article').nth(3)).toContainText('800,000');
 await page.reload();await page.getByRole('button',{name:'예산 관리',exact:true}).click();await expect(page.locator('.budget-summary-grid article').nth(1)).toContainText('1,100,000');await expect(page.locator('.budget-summary-grid article').nth(2)).toContainText('300,000');
 await page.getByRole('button',{name:name,exact:true}).click();await expect(page.getByText('부가세 포함\n추가 연출 별도',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:`${name} 계약금 결제 삭제`,exact:true}).click();await expect(page.locator('.budget-summary-grid article').nth(3)).toContainText('1,100,000');
 await page.getByRole('button',{name:name,exact:true}).click();await pay(page,'1100000');await expect(page.locator('.budget-table .budget-status')).toHaveText('결제 완료');
 expect(errors).toEqual([]);
});
test('template selection, unit-price calculation, filtering and CSV are usable',async({page})=>{
 await admin(page);
 await page.getByRole('button',{name:'기본 항목 불러오기'}).click();await page.getByRole('button',{name:'선택 해제',exact:true}).click();await page.getByLabel('웨딩홀브리에홀 대관·기본 연출',{exact:true}).check();await page.getByLabel('식대·연회예식 식대',{exact:true}).check();await page.getByRole('button',{name:'선택 항목 추가'}).click();
 await expect(page.locator('.budget-table .budget-item-title')).toHaveCount(2);await page.getByRole('button',{name:'기본 항목 불러오기'}).click();await expect(page.getByLabel('웨딩홀브리에홀 대관·기본 연출',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'취소',exact:true}).click();
 await page.getByRole('button',{name:'예식 식대 항목 수정'}).click();await page.getByText('단가 × 수량으로 계획 금액 계산',{exact:true}).click();await page.getByLabel('단가 (원)',{exact:true}).fill('80000');await page.getByLabel('수량·인원').fill('200');await page.getByRole('button',{name:'계획 금액에 적용'}).click();await expect(page.getByLabel('계획 금액 (원)',{exact:true})).toHaveValue('16000000');await page.getByRole('button',{name:'예산 항목 저장'}).click();
 await page.getByLabel('예산 분류 필터').selectOption('식대·연회');await expect(page.locator('.budget-table .budget-item-title')).toHaveCount(1);await page.getByRole('button',{name:'분류별 집계',exact:true}).click();await expect(page.locator('.budget-category-list')).toContainText('16,000,000원');await page.getByRole('button',{name:'식대·연회',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'CSV 내보내기'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('our-chapter-budget.csv');const content=await readFile(await download.path(),'utf8');expect(content).toContain('예식 식대');expect(content).not.toContain('브리에홀 대관·기본 연출');
});
test('budget layouts and dialogs fit mobile, and guests cannot change detailed records',async({page})=>{
 await admin(page);await addItem(page);await pay(page);
 await page.getByRole('button',{name:'예산 항목 추가'}).click();await page.getByLabel('예산 항목',{exact:true}).fill('본식 스냅');await page.getByRole('combobox',{name:'분류',exact:true}).selectOption('본식 사진·영상');await page.getByLabel('계획 금액 (원)',{exact:true}).fill('800000');await page.getByRole('button',{name:'예산 항목 저장'}).click();
 for(const width of [768,390,320]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/our-chapter-budget-mobile.png',fullPage:true,animations:'disabled'});await page.getByRole('button',{name:`${name} 항목 수정`}).click();const box=await page.getByRole('dialog').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.width).toBeLessThanOrEqual(390);await page.screenshot({path:'/tmp/our-chapter-budget-editor-mobile.png',animations:'disabled'});await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:`${name} 항목 수정`})).toBeFocused();
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/our-chapter-budget-desktop.png',fullPage:true,animations:'disabled'});
 const before=await page.evaluate(()=>localStorage.getItem('our-chapter-v1'));await page.getByRole('button',{name:'접속 화면으로 돌아가기'}).click();await page.getByRole('button',{name:'게스트로 보기'}).click();await page.getByRole('button',{name:'예산 관리',exact:true}).click();await page.getByRole('button',{name:name,exact:true}).click();await expect(page.getByText('계약금',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'예산 항목 추가'})).toHaveCount(0);await expect(page.getByRole('button',{name:/항목 수정|결제 수정|결제 삭제|CSV 내보내기/})).toHaveCount(0);await page.getByRole('button',{name:'결제 가계부',exact:true}).click();await expect(page.locator('.budget-journal-table')).toContainText('200,000');expect(await page.evaluate(()=>localStorage.getItem('our-chapter-v1'))).toBe(before);
});
