# 실제 동기화 연결

공개 연결 설정은 `https://sxbhdoukjljqzdzfrsms.supabase.co` 프로젝트에 맞춰 `app/cloud-config.json`에 반영했습니다. URL 뒤의 `/rest/v1/`은 SDK가 붙이므로 설정에는 프로젝트 기본 주소만 사용합니다. 실제 사용 전에는 아래 SQL과 이메일 인증 설정이 필요합니다. 빌드·로컬 검사만으로 실제 Supabase 동기화가 완료된 것은 아닙니다.

## 1. Supabase 프로젝트 준비

[Supabase Dashboard](https://supabase.com/dashboard)에서 새 프로젝트를 만들거나 기존 프로젝트를 선택합니다. Project URL과 **publishable key**를 확인합니다. 공개 연결 키는 브라우저에서 사용하는 키입니다. `secret` 또는 `service_role` 키는 이 사이트에 넣지 않습니다.

현재 공개 설정은 저장소에 포함되어 GitHub Pages의 후속 빌드에서도 같은 연결을 재현합니다. 다른 프로젝트를 개발용으로 사용할 때는 클라우드 환경 설정의 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`로 덮어쓸 수 있습니다. 설정 파일의 내용은 공개되므로 공개 연결 값만 기록합니다. 관리자 이메일은 여기에 넣지 않습니다.

클라우드 개발 환경의 네트워크 허용 목록에는 `sxbhdoukjljqzdzfrsms.supabase.co`가 필요합니다. 설정 초안 저장만으로 현재 환경에 적용되지는 않습니다. 환경 설정을 저장·게시한 뒤 접속을 다시 확인합니다. 이 제한은 개발 환경의 접속 정책이며 방문자 브라우저의 접속 정책과는 별개입니다.

## 2. 데이터베이스와 권한

Supabase SQL Editor에서 `supabase/setup.sql`을 실행합니다. 기존 공유 기록은 재실행해도 삭제되지 않습니다. 관리자 이메일 등록은 SQL Editor에서 별도로 실행하며, 관리자 이메일 목록은 공개 클라이언트가 접근하지 못하는 `private.wedding_admins`에 저장합니다.

현재 사용자가 등록을 요청한 관리자는 송윤오 한 명입니다. 실제 이메일을 포함한 등록 SQL은 공개 저장소에 올리지 않습니다. 박예은의 이메일은 추가 요청 후 등록합니다.

```sql
insert into private.wedding_admins(email,name)
values ('관리자 이메일을 여기에 입력','송윤오')
on conflict (email) do update set name=excluded.name;
```

게스트는 공유 기록 조회만 가능합니다. 로그인 여부와 별개로 데이터베이스 직접 쓰기는 막으며, 인증 완료된 등록 관리자만 저장 RPC를 실행할 수 있습니다. 이메일이 등록되지 않았거나 인증이 완료되지 않았다면 쓰기를 거부합니다. 전체 준비 기록은 게스트에게 공개되므로 공개하면 안 되는 정보는 입력하지 마세요.

## 3. 이메일 인증

Supabase Authentication에서 Email 인증을 켭니다. **Authentication → Notifications → Emails → Templates**에서 **Confirm sign up**과 **Magic Link / OTP** 두 템플릿의 본문을 다음과 같이 설정합니다. 첫 접속에서 계정이 생성될 때는 Confirm sign up이 사용되고, 이후 로그인에는 Magic Link / OTP가 사용됩니다. 한쪽만 수정하면 인증 코드 없이 링크만 있는 메일을 받을 수 있습니다.

```html
<h2>Our Chapter 관리자 인증</h2>
<p>이메일 인증 코드: <strong>{{ .Token }}</strong></p>
```

템플릿 편집 화면에서 `Set up custom SMTP to edit templates`가 표시되면 사용자 소유 SMTP를 먼저 설정합니다. 2026-06-03 이후 생성된 무료 프로젝트는 기본 발송 서비스 사용 시 템플릿 편집이 제한됩니다. SMTP 비밀번호나 Google 앱 비밀번호는 Supabase 설정에만 입력하고 공개 저장소·브라우저 설정에 넣지 않습니다.

**Authentication → URL Configuration**의 **Site URL**을 `https://devuknow.github.io/Ethan_Wedding_Planning/`로 설정합니다. Redirect URLs에도 같은 주소를 등록합니다. 기본값 `http://localhost:3000`은 배포 사이트 주소로 변경해야 합니다. 이 사이트의 로그인은 이메일에 표시된 코드를 직접 입력하는 방식입니다.

사이트에서 이름·별명·등록된 이메일을 입력하고 메일의 인증 코드를 입력합니다. 실제 저장 권한은 서버가 이메일 인증 결과로 판단합니다. 브라우저의 역할 값을 바꿔도 서버 쓰기 권한을 얻을 수 없습니다.

이미 코드 없는 가입 확인 메일을 받았다면 두 템플릿을 저장한 뒤 사이트에서 **이메일 다시 입력 → 인증 메일 받기**로 새 메일을 요청합니다. 새로 받은 메일의 코드를 사이트에 입력합니다. 발송 간격 제한이 표시되면 지정된 시간 뒤에 다시 요청합니다.

Supabase의 기본 메일 발송 서비스는 프로젝트 팀의 승인된 주소로 발송을 제한할 수 있습니다. 외부 주소로 발송하려면 사용자 소유 SMTP를 설정하거나 해당 이메일을 Supabase 프로젝트 팀에 추가해야 합니다. 발송 제한·이메일 수신·인증 성공을 실제 프로젝트에서 확인하세요.

## 4. 실시간 반영과 기존 기록

설정 SQL이 `wedding_state`를 `supabase_realtime` publication에 추가합니다. Dashboard에서 해당 테이블의 Realtime 활성화 상태도 확인하세요.

연결 시 기존 localStorage 기록을 자동으로 지우거나 공유 기록 위에 덮어쓰지 않습니다. 인증된 관리자에게 표시되는 **기존 브라우저 기록 가져오기**를 누르고 확인하면 해당 기록으로 공유 기록을 교체합니다. 여러 기기에 기존 기록이 있다면 먼저 백업해 비교하세요.

저장할 때 최신 서버 기록을 읽고 revision을 비교해 갱신합니다. 다른 기기가 먼저 저장하면 최신 기록에 변경 작업을 다시 적용합니다. 웹소켓 연결이 회복되면 서버 기록을 다시 읽습니다. 실패한 저장은 성공으로 표시하지 않습니다.

## 5. 배포와 검증

연결값 반영 후 `npm test`, `npm run build`와 브라우저 검증을 수행하고 소스와 게시 파일을 함께 커밋·푸시합니다. 관리자 브라우저와 게스트 브라우저 두 개를 열어 실제 이메일 인증, 기록 저장, 다른 기기 실시간 반영, 새로고침 후 유지, 게스트 저장 거부를 확인해야 실제 연결 완료입니다.

```sh
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:cloud
```

`test:cloud`는 테스트 전용 Supabase HTTP/웹소켓 응답을 사용한 브라우저 검사입니다. 실제 프로젝트나 실제 이메일 발송 검증을 대체하지 않습니다. PostgreSQL 권한·충돌 검사도 테스트용 DB에서 실행합니다.
