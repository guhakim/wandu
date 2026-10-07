// OpenRouter (OpenAI 호환 API) 경유. 키는 서버에서만 읽는다.
// 무료 모델은 혼잡·중단이 잦아서, 아래 순서대로 직접 대체(fallback)한다.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const PER_MODEL_MS = 12000; // 한 모델이 12초 넘게 붙잡으면 다음 모델로
const BUDGET_MS = 45000;    // 전체 예산. 함수 최대 60초(vercel.json), 앱 대기 55초보다 짧게

// OPENROUTER_MODELS 환경변수로 덮어쓸 수 있다(쉼표 구분). 모두 ':free' = 무료.
// 2026-10-06 측정(생각 끔): ling 1.2초·한국어 자연스러움, nemotron-super 0.9초(영어 섞일 때 있음), gemma는 한도 초과가 잦음
const DEFAULT_MODELS = [
  "inclusionai/ling-3.0-flash-sante:free",  // 빠름, 한국어 자연스러움
  "nvidia/nemotron-3-super-120b-a12b:free", // 빠름
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-lightning:free",     // 한국어 좋지만 느릴 때가 있음
  "openrouter/free",                        // 마지막 (OpenRouter 자동 선택 무료)
];
// 표지 사진 글자 읽기는 이미지를 볼 수 있는 모델만
const VISION_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "openrouter/free",
];

const SYSTEM =
  "너는 사용자의 독서를 돕는 다정한 친구 '완두'다. 한국어로만 답한다. " +
  "사용자가 요청한 JSON 형식 하나만 출력하고, 그 밖의 설명·머리말·코드펜스는 붙이지 않는다.";

// 앱이 읽을 수 있는 JSON이고, 내용이 주로 한국어인지 (잘린 응답·영어 섞인 답 등은 다음 모델로)
function isJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return false;
  let obj;
  try { obj = JSON.parse(m[0]); } catch (_) { return false; }
  const strs = []; (function walk(v) { if (typeof v === "string") strs.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); })(obj);
  const vals = strs.join(" "); // 글자 값만 검사
  const ko = (vals.match(/[가-힣]/g) || []).length, en = (vals.match(/[A-Za-z]/g) || []).length;
  return ko === 0 && en === 0 ? true : en <= ko * 0.3;
}

// WANDU에 로그인한 사람만 AI를 쓰게 한다(무료 한도를 남이 다 쓰지 못하게). 공개용 publishable 키로 토큰만 확인.
const SB_URL = "https://kmsccnbxzqtdxjtzukbe.supabase.co";
const SB_KEY = "sb_publishable_HpqxywclKGQd1Jo2rRE8mw_kTsA5eDt";
async function loggedIn(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch (_) {
    return null; // 확인 서버에 닿지 못함
  }
}

function models() {
  const env = process.env.OPENROUTER_MODELS;
  if (!env) return DEFAULT_MODELS;
  const list = env.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const auth = await loggedIn(req);
  if (auth === false) {
    res.status(401).json({ error: "login_required", message: "로그인이 필요합니다." });
    return;
  }
  if (auth === null) {
    res.status(502).json({ error: "auth_unreachable", message: "로그인 확인 서버에 연결하지 못했습니다." });
    return;
  }

  const raw = process.env.OPENROUTER_API_KEY;
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) {
    // 값 자체는 절대 내보내지 않는다. 길이만 알려 원인을 구분한다.
    res.status(503).json({
      error: "missing_key",
      message:
        raw === undefined
          ? "OPENROUTER_API_KEY 환경변수가 아예 없습니다."
          : "OPENROUTER_API_KEY 환경변수는 있는데 값이 비어 있습니다.",
      defined: raw !== undefined,
      length: typeof raw === "string" ? raw.length : 0,
    });
    return;
  }

  const body = req.body || {};
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) {
    res.status(400).json({ error: "bad_request", message: "prompt가 비어 있습니다." });
    return;
  }
  if (prompt.length > 20000) {
    res.status(413).json({ error: "too_long", message: "입력이 너무 깁니다." });
    return;
  }

  // OpenAI 호환 content 형식
  let content;
  const image = body.image;
  if (image && typeof image.data === "string" && image.data.length > 0) {
    if (image.data.length > 6_000_000) {
      res.status(413).json({ error: "image_too_large", message: "이미지가 너무 큽니다." });
      return;
    }
    const mime = ["image/jpeg", "image/png", "image/webp"].includes(image.media_type) ? image.media_type : "image/jpeg";
    content = [
      { type: "image_url", image_url: { url: `data:${mime};base64,${image.data}` } },
      { type: "text", text: prompt },
    ];
  } else {
    content = prompt;
  }

  const list = image && typeof image.data === "string" && image.data ? VISION_MODELS : models();
  let lastStatus = 502;
  let lastMessage = "모든 모델에서 응답을 받지 못했습니다.";

  const deadline = Date.now() + BUDGET_MS;
  for (const model of list) {
    const left = deadline - Date.now();
    if (left < 3000) break; // 남은 시간으로는 다음 모델을 기다릴 수 없음
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://wandu.vercel.app",
          "X-Title": "WANDU",
        },
        signal: AbortSignal.timeout(Math.min(PER_MODEL_MS, left)), // 한 모델이 붙잡고 있으면 끊고 다음 모델로
        body: JSON.stringify({
          model,
          max_tokens: 600,
          reasoning: { enabled: false }, // 속으로 '생각'하는 단계를 꺼서 응답 속도 높임
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content },
          ],
        }),
      });

      if (r.ok) {
        const data = await r.json();
        const text = data?.choices?.[0]?.message?.content;
        // 앱은 항상 JSON을 요청한다. 파싱이 안 되면(안전 분류기·잘린 응답 등) 다음 모델로.
        if (typeof text === "string" && isJSON(text)) {
          res.status(200).json({ text, model });
          return;
        }
        lastStatus = 502;
        lastMessage = `${model}: 빈 응답 또는 JSON 아님`;
        continue; // 다음 모델로
      }

      // 키 문제는 대체해도 소용없으니 즉시 중단
      if (r.status === 401 || r.status === 403) {
        res.status(401).json({ error: "auth", message: "OpenRouter API 키가 올바르지 않습니다." });
        return;
      }

      let detail = "";
      try {
        const e = await r.json();
        detail = e?.error?.message || "";
      } catch (_) {}
      lastStatus = r.status;
      lastMessage = `${model}: ${r.status} ${detail}`.trim();
      // 429(한도)·5xx·모델 없음 등은 다음 모델로 넘어간다
    } catch (err) {
      lastStatus = 504;
      lastMessage = `${model}: ${err && err.message ? err.message : String(err)}`;
    }
  }

  if (lastStatus === 429) {
    res.status(429).json({
      error: "rate_limited",
      message: "무료 한도(하루 50회)를 다 썼거나 혼잡합니다. 잠시 뒤 다시 시도해 주세요.",
      detail: lastMessage,
    });
    return;
  }
  res.status(lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502).json({
    error: "upstream_error",
    message: lastMessage,
  });
}
