import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await page.getByLabel('이름',{exact:true}).fill('송윤오');
  await page.getByLabel('별명',{exact:true}).fill('예쁜강아지');
  await page.getByRole('button',{name:'관리자로 들어가기'}).click();
});

test('dashboard opens the actual venue with local photos and visitor links', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', {name: '웨딩홀 소개 보기', exact: true}).click();
  await expect(page.getByRole('heading', {name: '웨딩홀 소개', exact: true})).toBeVisible();
  await expect(page.locator('.venue-facts')).toContainText('5층 브리에홀');
  await expect(page.locator('.venue-location')).toContainText('평촌역 3번 출구');
  await expect(page.locator('.venue-parking li')).toHaveCount(4);
  await expect(page.locator('.venue-parking')).toContainText('공휴일 이용 불가');
  await expect(page.getByRole('link', {name: /031-731-5000/})).toHaveAttribute('href', 'tel:031-731-5000');
  for (const link of await page.locator('.venue-details a[target="_blank"]').all()) {
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(new URL(await link.getAttribute('href')).protocol).toBe('https:');
  }
  await expect(page.locator('.venue-details img')).toHaveCount(4);
  for (const img of await page.locator('.venue-details img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    expect(new URL(await img.getAttribute('src'), page.url()).origin).toBe(new URL(page.url()).origin);
  }
  await expect(page.getByRole('button', {name: '웨딩 영감', exact: true})).toHaveCount(0);
  await expect(page.locator('.save-heart')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path: '/tmp/our-chapter-venue-desktop.png', fullPage: true, animations: 'disabled'});
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({width, height: 844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: '/tmp/our-chapter-venue-mobile.png', fullPage: true, animations: 'disabled'});
  expect(errors).toEqual([]);
});

test('address copy includes the chosen hall and handles unavailable clipboard', async ({page}) => {
  await page.getByRole('button', {name: '더파티움 안양 5층 브리에홀 소개 보기', exact: true}).click();
  const dataBefore = await page.evaluate(() => localStorage.getItem('our-chapter-v1'));
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {
      writeText: async text => { window.copiedVenueAddress = text; },
    }});
  });
  await page.getByRole('button', {name: '주소 복사'}).click();
  await expect(page.getByRole('status')).toHaveText('주소를 복사했습니다.');
  expect(await page.evaluate(() => window.copiedVenueAddress)).toBe('더파티움 안양 경기도 안양시 동안구 시민대로 311 금강스마트빌딩 5층 브리에홀');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {
      writeText: async () => { throw new Error('Clipboard unavailable'); },
    }});
  });
  await page.getByRole('button', {name: '주소 복사'}).click();
  await expect(page.getByRole('status')).toContainText('아래 주소를 선택해 복사');
  expect(await page.evaluate(() => localStorage.getItem('our-chapter-v1'))).toBe(dataBefore);
});
