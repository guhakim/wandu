# WANDU — Vercel 배포본 (OpenRouter 무료 AI)

공개 주소: **https://wandu.vercel.app**

Vercel 호스팅은 무료(Hobby). AI는 **OpenRouter 무료 모델**을 쓴다.
지인은 계정 없이 링크만으로 전부 사용할 수 있다.

## 구조
```
wandu/
  index.html      앱 (AI 호출은 /api/chat 으로 감)
  api/chat.js     서버 함수 — 여기서만 API 키를 읽는다
  package.json    의존성 없음 (Node 내장 fetch 사용)
```
키는 서버 함수 안에서만 쓰이고 **브라우저로 절대 내려가지 않는다**.

## ⚠️ 남은 한 단계: OpenRouter 키 등록

지금은 키가 없어서 AI가 꺼진 상태다(완두가 고정 질문 3개로 동작).
아래를 **직접** 실행한다. 키는 누구에게도 보여주지 말 것.

```bash
cd ~/Desktop/북산/wandu

# 1) 키 등록 — 실행하면 값을 입력하라고 나온다(화면에 안 찍힘)
vercel env add OPENROUTER_API_KEY production

# 2) 환경변수는 재배포해야 적용된다
vercel --prod
```

키 발급(무료): https://openrouter.ai → 가입 → Keys → Create Key

### 학습 거부 설정 (권장)
openrouter.ai → Settings → Privacy 에서 **무료 모델에 대해**
"학습하는 제공자로 라우팅 허용"을 끄면 메모가 학습에 쓰이지 않는다.
단, 끄면 사용 가능한 무료 모델이 줄어들 수 있다.

### 확인
```bash
curl -s -X POST https://wandu.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"JSON으로만: {\"ok\":true}"}'
```
`{"text":"...","model":"..."}` 가 나오면 성공. `missing_key` 면 아직 1~2단계가 안 끝난 것.

## 무료 한도 (OpenRouter 공식)

| | 분당 | 하루 |
|---|---|---|
| 무료 모델 (크레딧 구매 전) | 20회 | **50회** |
| $10 크레딧 구매 후 | 20회 | 1,000회 |

**한 세션당 약 5~7회 호출**(질문 1 + 대화 2~4 + 요약 1, 표지 인식하면 +1)
→ 하루 **8~10 세션** 정도. 이 한도는 **지인 전체가 함께 쓰는 것**이다(키 주인 계정 기준).

한도를 넘기면 앱이 멈추지 않고 **고정 질문으로 자동 전환**된다.

## 모델

`api/chat.js` 의 `DEFAULT_MODELS` 순서대로 시도하고, 실패하면 다음 모델로 자동 대체한다.

1. `qwen/qwen3.8-27b:free` — 한국어·비전 지원
2. `google/gemma-4-31b-it:free`
3. `openrouter/free`

**코드 수정 없이** 환경변수로 바꿀 수 있다(쉼표 구분):
```bash
vercel env add OPENROUTER_MODELS production
# 예: qwen/qwen3.8-27b:free,google/gemma-4-26b-a4b-it:free
vercel --prod
```

사용 가능한 무료 모델 목록 확인:
```bash
curl -s https://openrouter.ai/api/v1/models | python3 -c "
import json,sys
for m in json.load(sys.stdin)['data']:
    p=m.get('pricing',{})
    if float(p.get('prompt',1))==0 and float(p.get('completion',1))==0:
        vis='image' in (m.get('architecture',{}).get('input_modalities') or [])
        print(('[비전] ' if vis else '      ')+m['id'])
"
```

## 더 좋은 품질로 올리려면
OpenRouter는 OpenAI 호환이라 **모델 이름만 바꾸면** 유료 모델로 전환된다.
`OPENROUTER_MODELS` 에 `anthropic/claude-haiku-4.5` 같은 유료 모델을 넣고 크레딧을 충전하면 된다.

## 수정하고 다시 올리기
```bash
cd ~/Desktop/북산/wandu
# index.html 또는 api/chat.js 수정 후
vercel --prod
```

## 기록 저장 위치
폴더·메모·대화 기록은 **각자 브라우저(localStorage)** 에 저장된다.
지인끼리 서로의 기록은 보이지 않고, 기기를 바꾸면 따라가지 않는다.
