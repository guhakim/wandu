# WANDU — Vercel 배포본

공개 주소: **https://wandu.vercel.app**

## 구조
```
wandu/
  index.html      앱 전체 (소개 화면 · 로그인 · 내 책장 · 대화)
  api/chat.js     AI 서버 함수 — 여기서만 OpenRouter 키를 읽는다
  vercel.json     함수 최대 실행 60초, 보안 헤더(CSP 등)
  logo.png, books.jpg
```

## 로그인과 기록 저장 (Supabase)
- 메일 + 비밀번호로 가입·로그인. 비밀번호 찾기 메일 지원.
- 기록은 `public.folders` 표에 저장되고, RLS로 **본인 기록만** 보인다.
- `index.html`의 Supabase 키는 공개용(publishable) 키다. 관리자(service_role) 키는 절대 넣지 않는다.
- 로그인 없이 **체험 모드**로도 쓸 수 있다(기록은 저장되지 않음, 가입하면 옮겨짐).

## AI (OpenRouter)
- `/api/chat`은 **로그인한 사용자만** 쓸 수 있다(무료 한도 보호).
- 키는 Vercel 환경변수 `OPENROUTER_API_KEY`에만 둔다. 등록·변경:
  ```bash
  cd ~/Desktop/WANDU/wandu
  vercel env add OPENROUTER_API_KEY production
  vercel --prod      # 환경변수는 재배포해야 적용
  ```
- `api/chat.js`의 `DEFAULT_MODELS` 순서대로 시도하고, 실패하거나 JSON·한국어 답이 아니면 다음 모델로 넘어간다.
  무료 모델은 예고 없이 사라지거나 한도가 차므로, 느려지면 모델 목록을 다시 점검한다.
- 코드 수정 없이 모델을 바꾸려면 `OPENROUTER_MODELS` 환경변수(쉼표 구분)를 쓴다.
- 무료 한도: 하루 50회(크레딧 $10 충전 시 1,000회). AI가 안 되면 앱이 준비된 질문으로 자동 전환된다.

## 수정하고 다시 올리기
```bash
cd ~/Desktop/WANDU/wandu
vercel --prod
```
