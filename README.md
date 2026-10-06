# Our Chapter · 우리의 결혼 준비

핑크와 꽃 일러스트로 꾸민 한국어 개인 웨딩 플래너. React + Vite 기반으로 데스크톱과 모바일을 지원합니다.

## 실행
Node.js 22 이상 권장. 현재 환경에서는 Node.js 24.19.0으로 검증합니다.

```sh
npm ci
npm run dev
```

개발 서버는 기본 5173 포트를 사용합니다.

```sh
npm test
npm run build
npm run preview
```

## 기능
- 커플 이름, 결혼 날짜, 총 예산 설정
- 할 일 추가·완료·삭제 및 완료 필터
- 지출 기록과 예산 초과 표시
- 하객 추가·삭제 및 참석 상태 변경
- 준비 날짜별 일정과 결혼식 카운트다운
- 웨딩 스타일 즐겨찾기
- JSON 데이터 백업·복원

데이터는 해당 브라우저의 localStorage에만 저장됩니다. 다중 사용자 동기화와 로그인은 없습니다. 첫 화면의 할 일은 수정 가능한 시작용 예시이며 결혼 날짜·하객·지출은 비어 있습니다. 하단의 백업 버튼으로 기록을 안전하게 보관하세요.

디자인 방향과 레퍼런스는 [DESIGN.md](DESIGN.md)에 기록했습니다. 네트워크 제한으로 최신 레퍼런스 화면은 직접 확인하지 못했습니다.

## 브라우저 검증
```sh
npx playwright install chromium
npm run dev
npx playwright test
```

클라우드 환경에 설치된 Chromium을 사용할 때는 다음 명령을 실행하세요.

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test
```
