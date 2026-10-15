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

test('theme and optional story publish only after saving, survive reload and can be hidden without losing the draft',async({page,context})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await enterAdmin(page);
  await expect(page.getByRole('radio',{name:'아이보리 · 올리브'})).toBeChecked();
  const storyToggle=page.getByRole('checkbox',{name:/우리의 이야기 공개/});await expect(storyToggle).not.toBeChecked();
  await page.getByRole('radio',{name:'블랙 · 샴페인 골드'}).check();await storyToggle.check();
  await page.getByLabel('처음 만난 날',{exact:true}).fill('2020-11-03');
  await page.getByRole('textbox',{name:'첫 만남 이야기',exact:true}).fill('우연히 함께 걷던 가을날,\n우리의 이야기가 시작되었습니다.');
  await page.getByRole('textbox',{name:'신랑이 전하는 말',exact:true}).fill('함께하는 평범한 하루를 소중히 여길게.');
  await page.getByRole('textbox',{name:'신부가 전하는 말',exact:true}).fill('서로의 가장 든든한 편이 되어 줄게.');
  await page.getByRole('textbox',{name:'우리의 약속',exact:true}).fill('많이 웃고, 천천히 듣고, 오래 함께 걷겠습니다.');

  const guest=await context.newPage();await guest.goto('/?invite=1');
  await expect(guest.locator('.invitation-page')).toHaveAttribute('data-theme','ivory');
  await expect(guest.getByRole('heading',{name:'우리가 함께 쓴 이야기',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'청첩장 미리보기',exact:true}).click();
  const preview=page.getByRole('dialog',{name:'모바일 청첩장 미리보기'});
  await expect(preview.locator('.invitation-page')).toHaveAttribute('data-theme','briller-night');
  await expect(preview.getByRole('heading',{name:'우리가 함께 쓴 이야기',exact:true})).toBeVisible();
  await expect(preview).toContainText('우리의 이야기가 시작되었습니다.');await expect(preview).toContainText('서로의 가장 든든한 편이 되어 줄게.');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'청첩장 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('청첩장을 저장했어요');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));
  expect(saved.invitation.theme).toBe('briller-night');expect(saved.invitation.story).toEqual({enabled:true,firstMetDate:'2020-11-03',firstMetText:'우연히 함께 걷던 가을날,\n우리의 이야기가 시작되었습니다.',groomMessage:'함께하는 평범한 하루를 소중히 여길게.',brideMessage:'서로의 가장 든든한 편이 되어 줄게.',promise:'많이 웃고, 천천히 듣고, 오래 함께 걷겠습니다.'});
  await page.reload();await page.getByRole('button',{name:'모바일 청첩장',exact:true}).click();
  await expect(page.getByRole('radio',{name:'블랙 · 샴페인 골드'})).toBeChecked();await expect(page.getByLabel('처음 만난 날',{exact:true})).toHaveValue('2020-11-03');await expect(page.getByRole('textbox',{name:'우리의 약속',exact:true})).toHaveValue(saved.invitation.story.promise);
  await guest.reload();await expect(guest.locator('.invitation-page')).toHaveAttribute('data-theme','briller-night');
  const story=guest.getByRole('region',{name:'우리가 함께 쓴 이야기'});await expect(story).toBeVisible();await expect(story).toContainText('2020');await expect(story).toContainText('11');await expect(story).toContainText(saved.invitation.story.firstMetText.split('\n')[0]);
  for(const heading of ['우리의 첫 만남','신랑이 전하는 말','신부가 전하는 말','우리의 약속']) await expect(story.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  await expect(guest.getByRole('button',{name:/예산 관리|하객 관리|신혼여행|백업/})).toHaveCount(0);

  await page.getByRole('textbox',{name:'신부가 전하는 말',exact:true}).fill('');await page.getByRole('button',{name:'청첩장 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('청첩장을 저장했어요');await guest.reload();
  await expect(guest.getByRole('heading',{name:'신부가 전하는 말',exact:true})).toHaveCount(0);await expect(guest.getByRole('heading',{name:'신랑이 전하는 말',exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:/우리의 이야기 공개/}).uncheck();await page.getByRole('button',{name:'청첩장 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('청첩장을 저장했어요');
  const hidden=await page.evaluate(()=>JSON.parse(localStorage.getItem('our-chapter-v1')));
  expect(hidden.invitation.story.enabled).toBe(false);expect(hidden.invitation.story.firstMetText).toBe(saved.invitation.story.firstMetText);expect(hidden.invitation.story.promise).toBe(saved.invitation.story.promise);
  await page.reload();await page.getByRole('button',{name:'모바일 청첩장',exact:true}).click();await expect(page.getByRole('checkbox',{name:/우리의 이야기 공개/})).not.toBeChecked();await expect(page.getByRole('textbox',{name:'우리의 약속',exact:true})).toHaveValue(saved.invitation.story.promise);
  await guest.reload();await expect(guest.getByRole('region',{name:'우리가 함께 쓴 이야기'})).toHaveCount(0);await expect(guest.locator('body')).not.toContainText(saved.invitation.story.promise);await expect(guest.locator('.invitation-page')).toHaveAttribute('data-theme','briller-night');
  await guest.close();expect(errors).toEqual([]);
});

test('both invitation themes wrap long stories on phones, tablets and desktop',async({page})=>{
  await enterAdmin(page);await page.getByRole('checkbox',{name:/우리의 이야기 공개/}).check();
  const longText='서로의소중한하루를기억하며함께걷겠습니다'.repeat(60).slice(0,1000);
  await page.getByRole('textbox',{name:'첫 만남 이야기',exact:true}).fill(longText);await page.getByRole('textbox',{name:'우리의 약속',exact:true}).fill('서로의 말을 끝까지 듣고 작은 순간을 함께 기뻐하겠습니다.');
  for(const [theme,label] of [['ivory','아이보리 · 올리브'],['briller-night','블랙 · 샴페인 골드']]) {
    await page.getByRole('radio',{name:label}).check();
    for(const width of [1440,768,390,320]) {await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
    await page.getByRole('button',{name:'청첩장 미리보기',exact:true}).click();const preview=page.getByRole('dialog',{name:'모바일 청첩장 미리보기'});
    await expect(preview.locator('.invitation-page')).toHaveAttribute('data-theme',theme);
    for(const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(await preview.evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth)).toBe(true);
    }
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'청첩장 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('청첩장을 저장했어요');
    const guest=await page.context().newPage();await guest.goto('/?invite=1');
    for(const width of [1440,768,390,320]) {await guest.setViewportSize({width,height:844});expect(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(guest.getByRole('region',{name:'우리가 함께 쓴 이야기'})).toContainText(longText)}
    await guest.setViewportSize({width:390,height:844});await guest.screenshot({path:`/tmp/our-chapter-invitation-${theme}-story-mobile.png`,fullPage:true,animations:'disabled'});
    await guest.setViewportSize({width:1440,height:1000});await guest.screenshot({path:`/tmp/our-chapter-invitation-${theme}-story-desktop.png`,fullPage:true,animations:'disabled'});await guest.close();
  }
});
