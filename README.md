# 로또 분석기

과거 로또 당첨 데이터를 시각화하고 통계 기반으로 번호를 추천하는 웹 도구.
기획 상세는 [PLAN.md](./PLAN.md) 참고.

## 빠른 시작

```bash
npm install
npm run dev      # http://localhost:5173 (샘플 데이터로 바로 뜸)
```

## 데이터 수집/갱신

`public/lotto.json` 은 현재 **샘플 10회차**(1110~1119)입니다. 실제 데이터로 채우려면:

```bash
# 첫 수집: 반드시 --full 로 1회부터 전체를 받아 샘플을 덮어씁니다.
node scripts/fetch-lotto.mjs --full

# 이후 매주: 증분 갱신 (기존 데이터 뒤부터 최신 회차까지만 추가)
npm run fetch
```

> ⚠️ **첫 수집에 `npm run fetch`(증분)를 쓰면 안 됩니다.** 샘플의 마지막(1119회) 다음부터 받으려 해
> 1~1109회가 비게 됩니다. 처음엔 꼭 `--full`.

> ⚠️ 동행복권 서버는 **해외 IP를 차단**합니다. 수집 스크립트는 **한국 IP 환경**에서 실행하세요.
> 주간 갱신은 매주 토요일 추첨 후 `npm run fetch` → 재배포 흐름을 권장합니다.

> 견고성: 요청당 10초 타임아웃 + 최대 3회 재시도가 내장되어 있어, 일시적 네트워크 오류는 자동 복구합니다.

### 공식 API가 막힐 때 — 공개 미러 사용

일부 네트워크에서는 동행복권 공식 API가 **메인페이지로 리다이렉트되거나 443 연결이 차단**되어
`npm run fetch`가 실패합니다 (프록시·VPN·보안장비·IP 차단 등). 그럴 때 공개 미러로 받습니다:

```bash
npm run fetch:mirror
```

- 출처: [smok95/lotto](https://smok95.github.io/lotto/results/all.json) — 동행복권 데이터를 GitHub에 공개 호스팅하는 커뮤니티 미러
- 1회~최신 회차 전체를 받아 `public/lotto.json` 생성 (GitHub만 접속되면 동작)
- ⚠️ 비공식 미러라 최신성은 저장소 갱신에 의존. 공식 `npm run fetch`가 되는 환경이면 그쪽을 우선.

## 구조

```
public/lotto.json       정적 당첨 데이터 (앱이 fetch)
scripts/fetch-lotto.mjs 동행복권 수집 스크립트
src/lib/stats.ts        빈도/미출현/패턴 집계 (F2~F4)
src/lib/recommend.ts    번호 추천 로직 (F5, 4개 모드)
src/App.tsx             단일 대시보드 화면
```

## 면책
로또는 독립 시행이므로 어떤 추천도 당첨 확률을 높이지 않습니다. 통계적 재미를 위한 도구입니다.
