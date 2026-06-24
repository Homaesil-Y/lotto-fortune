// 공개 미러(smok95/lotto)에서 전회차 데이터를 받아 public/lotto.json 생성.
//
// 동행복권 공식 API(getLottoNumber)는 일부 네트워크에서 메인페이지로 리다이렉트되거나
// 443 연결이 막혀 받을 수 없는 경우가 있다. 그럴 때 이 미러를 대안으로 사용한다.
// 미러는 동행복권 데이터를 GitHub에 공개 호스팅하는 커뮤니티 저장소다.
//
// 사용법: node scripts/fetch-lotto-mirror.mjs
// ⚠️ 비공식 미러이므로 최신성은 저장소 갱신에 의존한다. 가능하면 공식 fetch-lotto.mjs를 우선 사용.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = `${ROOT}/public/lotto.json`;
const MIRROR = "https://smok95.github.io/lotto/results/all.json";

const res = await fetch(MIRROR, { signal: AbortSignal.timeout(30000) });
if (!res.ok) throw new Error(`미러 응답 오류: HTTP ${res.status}`);
const raw = await res.json();

const draws = raw
  .map((r) => {
    const divs = (r.divisions || []).filter((x) => x.prize);
    const first = divs.length ? divs.reduce((a, b) => (b.prize > a.prize ? b : a)) : {};
    return {
      drwNo: r.draw_no,
      drwNoDate: String(r.date).slice(0, 10),
      numbers: r.numbers,
      bonus: r.bonus_no,
      firstWinamnt: first.prize ?? 0,
      firstPrzwnerCo: first.winners ?? 0,
      totSellamnt: r.total_sales_amount ?? 0,
    };
  })
  .sort((a, b) => a.drwNo - b.drwNo);

if (draws.length === 0) {
  console.error("받은 회차가 0개라 파일을 덮어쓰지 않습니다.");
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(draws));
console.log(`완료: ${draws.length}회차 (1~${draws.at(-1).drwNo}, ${draws.at(-1).drwNoDate}) → ${OUT}`);
