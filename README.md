# FlowPulse

AI가 먼저 읽어주는 수급 중심 투자 인사이트 플랫폼의 반응형 MVP입니다.

## 실제 데이터 연결

```bash
createdb flowpulse
cp .env.example .env
# .env에 KIS_APP_KEY와 KIS_APP_SECRET 입력
npm run dev
```

로컬 구조는 `React/Vite → Node API → PostgreSQL ← 1분 수집 워커 ← KIS`입니다.
API는 PostgreSQL만 읽고 외부 시장 API 호출은 수집 워커만 담당합니다. 원본 1분 스냅샷은 7일 후 자동 삭제됩니다.

## 구현 범위

- AI 선제 시장 홈과 수급 온도
- 외국인·기관·프로그램 스토리 그래프
- 근거·기준시각을 포함한 AI 라이브 브리핑
- 이벤트 중심 Market Replay Lite
- 서버 시점 수급 스냅샷을 표현한 3개 피드 구조

데이터 출처는 한국투자증권 Open API입니다. 서버가 접근 토큰을 관리하고 `시장별 투자자매매동향(FHPTJ04030000)`과 `프로그램매매 종합현황(시간)(FHPPG04600101)`을 결합합니다. 키가 없거나 조회가 실패하면 어떤 숫자도 가짜로 표시하지 않습니다.

실시간 KRX/NXT 종목별 프로그램매매 WebSocket은 다음 단계에서 `H0STPGM0`/`H0NXPGM0` 구독으로 확장합니다. 상용 재배포 전에는 KRX·증권사 데이터 이용 조건을 별도로 확정해야 합니다.

## Oracle Cloud VM 배포

Ubuntu VM에 Docker를 설치하고 프로젝트와 `.env`를 복사한 뒤 실행합니다.

```bash
docker compose up -d --build
docker compose ps
```

웹은 80번 포트로 공개됩니다. Oracle VCN 보안 목록과 VM 방화벽에서 TCP 80을 허용해야 합니다. `.env`는 이미지에 포함되지 않습니다.
