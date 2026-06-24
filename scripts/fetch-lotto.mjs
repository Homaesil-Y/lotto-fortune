// 동행복권 회차별 당첨번호 수집 스크립트
//
// 사용법:
//   node scripts/fetch-lotto.mjs          # 증분 갱신 (기존 lotto.json 뒤부터 최신까지)
//   node scripts/fetch-lotto.mjs --full   # 1회부터 전체 재수집
//
// ⚠️ 동행복권 서버는 해외 IP를 차단합니다. 반드시 한국 IP 환경에서 실행하세요.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = `${ROOT}/public/lotto.json`;
const ENDPOINT = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=";

const full = process.argv.includes("--full");

// API 응답에서 우리가 보관할 필드만 추린다.
function pick(r) {
  return {
    drwNo: r.drwNo,
    drwNoDate: r.drwNoDate,
    numbers: [r.drwtNo1, r.drwtNo2, r.drwtNo3, r.drwtNo4, r.drwtNo5, r.drwtNo6],
    bonus: r.bnusNo,
    firstWinamnt: r.firstWinamnt,
    firstPrzwnerCo: r.firstPrzwnerCo,
    totSellamnt: r.totSellamnt,
  };
}

async function fetchDraw(no, attempt = 1) {
  try {
    const res = await fetch(ENDPOINT + no, {
      // 브라우저 직접접근(Accept: text/html)은 메인페이지로 리다이렉트되므로,
      // XHR/프로그램 요청처럼 보이게 헤더를 지정해 JSON 응답을 받는다.
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://www.dhlottery.co.kr/gameResult.do?method=byWin",
      },
      signal: AbortSignal.timeout(10000), // 요청당 10초 타임아웃
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = (await res.text()).trimStart();
    if (!text.startsWith("{")) {
      // 메인페이지 HTML 등 JSON이 아닌 응답 → 헤더/세션/차단 문제
      throw new Error("JSON이 아닌 응답(메인페이지로 리다이렉트된 것으로 보임)");
    }
    return JSON.parse(text);
  } catch (e) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * attempt)); // 재시도 전 짧은 대기
      return fetchDraw(no, attempt + 1);
    }
    throw new Error(`회차 ${no} 실패 (${attempt}회 시도): ${e.message}`);
  }
}

async function loadExisting() {
  if (full) return [];
  try {
    return JSON.parse(await readFile(OUT, "utf8"));
  } catch {
    return [];
  }
}

const existing = await loadExisting();
const draws = [...existing];
let no = (existing.at(-1)?.drwNo ?? 0) + 1;

console.log(full ? "전체 수집 시작 (1회부터)" : `증분 수집 시작 (${no}회부터)`);

while (true) {
  let data;
  try {
    data = await fetchDraw(no);
  } catch (e) {
    console.error(`회차 ${no} 요청 실패: ${e.message}`);
    break;
  }
  if (data.returnValue !== "success") {
    console.log(`회차 ${no} 미추첨 — 수집 종료.`);
    break;
  }
  draws.push(pick(data));
  if (no % 50 === 0) console.log(`...${no}회까지 수집`);
  no += 1;
}

// 수집 결과가 비었거나 기존보다 줄었으면 덮어쓰지 않는다 (네트워크 실패로 데이터 유실 방지).
if (draws.length === 0) {
  console.error("수집된 회차가 0개라 파일을 덮어쓰지 않습니다. (네트워크에서 동행복권 443 연결 실패로 보임)");
  process.exit(1);
}
if (draws.length < existing.length) {
  console.error(`수집 결과(${draws.length})가 기존(${existing.length})보다 적어 덮어쓰지 않습니다.`);
  process.exit(1);
}
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(draws, null, 0));
console.log(`완료: 총 ${draws.length}회차 → ${OUT}`);
