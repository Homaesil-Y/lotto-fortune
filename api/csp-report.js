// CSP 위반 리포트 수집 엔드포인트 (Vercel 서버리스 함수)
// 브라우저가 report-uri / report-to 로 보낸 위반 보고를 받아 로그로 남긴다.
// 보고서는 Vercel 대시보드 → 프로젝트 → Logs(Observability)에서 확인.
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end();
  }
  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    // 런타임이 본문을 미리 파싱한 경우 req.body 폴백
    if (!raw && req.body) raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (raw) console.warn("[CSP-Report]", raw.slice(0, 4000));
  } catch (e) {
    console.error("[CSP-Report] parse error", e);
  }
  res.statusCode = 204; // No Content
  res.end();
}
