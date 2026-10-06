# Our Chapter · 우리의 결혼 준비

송윤오 ♥ 박예은의 결혼 준비를 위한 아이보리·올리브 테마의 한국어 개인 웨딩 플래너. React + Vite 기반으로 데스크톱과 모바일을 지원합니다.

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

데이터는 해당 브라우저의 localStorage에만 저장됩니다. 다중 사용자 동기화와 서버 인증은 없습니다. 첫 화면의 할 일은 수정 가능한 시작용 예시이며 결혼 날짜·하객·지출은 비어 있습니다. 하단의 백업 버튼으로 기록을 안전하게 보관하세요.

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

## GitHub Pages 배포

현재 설정: **Settings → Pages → Deploy from a branch → main / (root)**.

`app/`에 개발 소스가 있고, 저장소 루트의 `index.html`, `assets/`, `.nojekyll`은 Pages용 빌드 결과입니다. `npm run build`는 Vite로 빌드한 뒤 루트 게시 파일을 갱신합니다. 기능을 수정할 때 소스와 갱신된 게시 파일을 함께 커밋·푸시하세요. 이전 빌드의 에셋은 `.pages-manifest.json`에 기록된 파일만 정리합니다.

예상 주소: https://devuknow.github.io/Ethan_Wedding_Planning/

상대 에셋 경로를 사용해 저장소 하위 경로에서도 JavaScript와 CSS가 로드됩니다. `.github/workflows/ci.yml`은 테스트와 빌드 후 커밋된 게시 파일이 최신인지 검사합니다. 실제 게시 작업은 기존 GitHub Pages 브랜치 설정에서 수행됩니다.

## 접속 화면과 역할

첫 접속 시 이름·별명을 입력하거나 **게스트로 보기**를 선택합니다. 지정한 두 관리자 조합으로 들어오면 편집·추가·삭제·설정·백업·복원을 사용할 수 있습니다. 게스트는 화면을 둘러보고 필터를 사용할 수 있지만 할 일 완료·삭제, 참석 상태 변경, 영감 저장, 설정 변경, 데이터 복원은 사용할 수 없습니다.

상단의 나가기 아이콘으로 접속 화면으로 돌아갈 수 있습니다. 접속 역할은 현재 탭의 sessionStorage에 보관해 새로고침 시 유지하며, 별명 입력값은 저장하지 않습니다. 준비 내역은 역할 전환으로 삭제되지 않습니다.

이것은 정적 사이트의 **화면 권한 구분**이며 보안 인증이 아닙니다. 관리자 이름·별명 비교는 공개된 프런트엔드에서 이루어지므로 개발자 도구로 우회할 수 있습니다. 실제 접근 통제 및 여러 기기에서 같은 준비 내역을 보려면 서버 인증과 공유 데이터 저장소가 필요합니다. 게스트에게 보이는 내용도 현재 브라우저에 저장된 내용입니다.
