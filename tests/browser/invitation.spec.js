import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function enterAdmin(page) {
  await page.goto('/');await page.getByLabel('이름',{exact:true}).fill('송윤오');await page.getByLabel('별명',{exact:true}).fill('예쁜강아지');await page.getByRole('button',{name:'관리자로 들어가기'}).click();
  await page.getByRole('button',{name:'모바일 청첩장',exact:true}).click();
}

test('admin creates a public invitation, previews it and guest cannot see private plans',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await enterAdmin(page);
  await page.getByLabel('예식 날짜',{exact:true}).fill('2027-05-22');await page.getByLabel('예식 시간',{exact:true}).fill('13:30');
  await page.getByLabel('초대 글',{exact:true}).fill('서로를 아끼며 함께 걸어갑니다.\n소중한 날에 함께해 주세요.');
  await page.getByLabel('추가 교통 안내',{exact:true}).fill('예식 시작 20분 전에 도착하시면 여유롭습니다.');await page.getByLabel('신랑 연락처',{exact:true}).fill('010-1234-5678');
  await page.getByRole('button',{name:'청첩장 미리보기',exact:true}).click();
  const preview=page.getByRole('dialog',{name:'모바일 청첩장 미리보기'});
  await expect(preview.getByRole('heading',{name:'우리, 결혼합니다',exact:true})).toBeVisible();await expect(preview).toContainText('오후 1시 30분');await expect(preview).toContainText('함께 걸어갑니다');await expect(preview.locator('.invitation-cover-photo img')).toHaveAttribute('src',/briller-hall/);
  await preview.getByRole('button',{name:'대표 사진 크게 보기'}).click();await expect(page.getByRole('dialog',{name:'청첩장 사진 크게 보기'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'청첩장 사진 크게 보기'})).toHaveCount(0);await expect(preview).toBeVisible();await expect(preview.getByRole('button',{name:'대표 사진 크게 보기'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(preview).toHaveCount(0);await expect(page.getByRole('button',{name:'청첩장 미리보기',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'청첩장 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('청첩장을 저장했어요');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));expect(stored.date).toBe('2027-05-22');expect(stored.invitation.time).toBe('13:30');expect(stored.invitation.heroPhoto).toBeNull();expect(stored.invitation.gallery).toEqual([]);
  await page.reload();await page.getByRole('button',{name:'모바일 청첩장',exact:true}).click();await expect(page.getByLabel('예식 시간',{exact:true})).toHaveValue('13:30');
  await page.getByRole('button',{name:'접속 화면으로 돌아가기'}).click();await page.getByRole('button',{name:'게스트로 보기'}).click();
  await expect(page.locator('.invitation-paper')).toBeVisible();await expect(page.locator('.invitation-greeting')).toContainText('함께 걸어갑니다');await expect(page.getByRole('link',{name:'신랑에게 연락하기'})).toHaveAttribute('href','tel:01012345678');await expect(page.locator('.invitation-directions-note')).toContainText('20분 전에 도착');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'캘린더에 저장',exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('우리의-결혼식.ics');const calendar=await readFile(await download.path(),'utf8');expect(calendar).toContain('DTSTART;TZID=Asia/Seoul:20270522T133000');expect(calendar).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);expect(calendar).toContain('5층 브리에홀');
  await expect(page.getByRole('button',{name:/예산 관리|하객 관리|신혼여행|백업|웨딩 설정/})).toHaveCount(0);await expect(page.locator('.sidebar')).toHaveCount(0);await expect(page.locator('.role-badge')).toHaveCount(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')))).toEqual(stored);
  await page.goto('/?invite=1');await expect(page.getByRole('heading',{name:'우리, 결혼합니다',exact:true})).toBeVisible();await expect(page.locator('.invitation-transport')).toContainText('평촌역');expect(errors).toEqual([]);
});

test('invitation venue photos, gallery keyboard, directions, copy and sharing work',async({page,context})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true})});
  await page.goto('/?invite=1');
  await expect(page.locator('.invitation-paper')).toBeVisible();await expect(page.locator('.invitation-cover-photo img')).toHaveJSProperty('complete',true);expect(await page.locator('.invitation-cover-photo img').evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.invitation-gallery')).toContainText('우리의 날이 머물 공간');await expect(page.locator('.invitation-photo-grid button')).toHaveCount(3);
  await page.getByRole('button',{name:'대표 사진 크게 보기'}).click();const lightbox=page.getByRole('dialog',{name:'청첩장 사진 크게 보기'});await expect(lightbox).toBeVisible();await expect(lightbox.locator('.invitation-lightbox-bar')).toContainText('1 / 4');await page.keyboard.press('ArrowRight');await expect(lightbox.locator('.invitation-lightbox-bar')).toContainText('2 / 4');await page.keyboard.press('ArrowLeft');await expect(lightbox.locator('.invitation-lightbox-bar')).toContainText('1 / 4');await page.keyboard.press('Escape');await expect(lightbox).toHaveCount(0);await expect(page.getByRole('button',{name:'대표 사진 크게 보기'})).toBeFocused();
  await expect(page.getByRole('link',{name:/네이버 지도/})).toHaveAttribute('href',/map\.naver\.com/);await expect(page.getByRole('link',{name:/카카오맵/})).toHaveAttribute('href',/map\.kakao\.com/);await expect(page.getByRole('link',{name:/네이버 지도/})).toHaveAttribute('rel','noopener noreferrer');
  await page.getByRole('button',{name:'주소 복사',exact:true}).click();await expect(page.locator('.invitation-location [role=status]')).toContainText('주소를 복사했어요');expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('시민대로 311');
  await page.getByRole('button',{name:'청첩장 공유하기',exact:true}).click();await expect(page.locator('.invitation-share [role=status]')).toContainText('청첩장 링크를 복사했어요');expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('?invite=1');expect(errors).toEqual([]);
});

test('invitation and editor fit mobile screens and photos stay visible',async({page})=>{
  await page.goto('/?invite=1');
  for(const width of [1440,768,390,320]) {await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.invitation-cover-photo img')).toBeVisible()}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/our-chapter-invitation-mobile.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/our-chapter-invitation-desktop.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'관리자 로그인',exact:true}).click();await page.getByLabel('이름',{exact:true}).fill('송윤오');await page.getByLabel('별명',{exact:true}).fill('예쁜강아지');await page.getByRole('button',{name:'관리자로 들어가기'}).click();await page.getByRole('button',{name:'모바일 청첩장',exact:true}).click();
  for(const width of [1024,768,390,320]) {await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/our-chapter-invitation-editor-mobile.png',fullPage:true,animations:'disabled'});await page.getByRole('button',{name:'청첩장 미리보기',exact:true}).click();const dialog=page.getByRole('dialog',{name:'모바일 청첩장 미리보기'});const box=await dialog.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.width).toBeLessThanOrEqual(390);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
