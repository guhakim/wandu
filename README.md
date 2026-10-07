# wandu

종이책을 끝까지 읽게 돕는 독서 친구 **완두(WANDU)**.
조금 읽고 기억나는 문장을 메모하면, AI 친구 완두가 그 메모로 질문해 줍니다.

- 사이트: https://wandu.vercel.app

## 폴더 구성

| 경로 | 설명 |
|---|---|
| `wandu/` | 실제 배포본 (Vercel) |
| `wandu/index.html` | 앱 전체: 소개 화면, 로그인, 내 책장, 대화 |
| `wandu/api/chat.js` | AI 서버 함수 (OpenRouter 무료 모델, 로그인한 사용자만) |
| `wandu/vercel.json` | 함수 실행 시간, 보안 헤더(CSP) |
| `WANDU.html` | claude.ai 아티팩트용 버전 (로그인 없이 브라우저에만 저장) |
| `WANDU_프로젝트/` | 초기 버전·프로토타입 보관 |

## 쓰는 서비스

- **Vercel**: 호스팅과 서버 함수. 환경변수 `OPENROUTER_API_KEY`가 필요합니다.
- **Supabase**: 메일/비밀번호 로그인, 기록 저장(`public.folders` 표, 본인 기록만 보이는 RLS).
- **OpenRouter**: AI 모델 (무료 모델을 차례로 시도).

API 키 같은 비밀값은 저장소에 넣지 않습니다. `index.html`의 Supabase 키는 공개용(publishable) 키입니다.

## 배포

```bash
cd wandu
vercel --prod
```
