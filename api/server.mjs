import { createServer } from "node:http";
import { health, migrate, pool, readMarket } from "./db.mjs";
import { accurateHistoryStart } from "./session.mjs";
import { configured, KisClient, publicUsOverview, resetLeaderFlows, searchUsStocks, selectCandidateStrategies } from "./kis.mjs";

const port = Number(process.env.FLOWPULSE_API_PORT) || 8789,
  json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" });
    res.end(JSON.stringify(body));
  };
let candidateCache = { savedAt:0, body:{ live:true, source:"KIS 거래대금·수급", calculatedAt:null, universeCount:0, priceCount:0, trackingCount:0, stocks:[] } }, candidateRefresh = null;
const candidateHistory = new Map();
async function refreshCandidates() {
  try {
    const savedAt=Date.now(), raw=await new KisClient().candidates();
    candidateCache={savedAt,body:{...raw,stocks:selectCandidateStrategies(raw.stocks,candidateHistory,savedAt),trackingCount:raw.stocks.length}};
  } catch (error) {
    console.error("[candidates]", error);
  } finally {
    candidateRefresh=null;
  }
}

function responseWithHistory(market, rows) {
  const latest = rows.at(-1)?.payload;
  if (!latest) return null;
  if (market === "NASDAQ") {
    return {
      ...latest,
      indices: (latest.indices ?? []).map((index) => {
        const points = index.points ?? [];
        return { ...index, points: points.filter((point, i, all) => all.findLastIndex((item) => item.time === point.time) === i).sort((a, b) => a.time.localeCompare(b.time)) };
      }),
      collection: { intervalSeconds: 60, stored: rows.length, maxStored: 7 * 24 * 60, lastStoredAt: rows.at(-1).capturedAt },
    };
  }
  const investorPoints = rows.map(({ capturedAt, payload }) => ({ time: capturedAt, ...payload.snapshot })),
    programPoints = investorPoints.map((point) => ({ time: point.time, value: point.program }));
  return { ...latest, leaders:resetLeaderFlows(latest.leaders, rows[0].payload.leaders, rows.length > 1), investorPoints, programPoints, collection: { intervalSeconds: 60, stored: rows.length, maxStored: 7 * 24 * 60, lastStoredAt: rows.at(-1).capturedAt } };
}

await migrate();
createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api/health") return json(res, 200, { ok: true, database: "postgresql", ingestion: await health() });
    if (url.pathname === "/api/candidates") {
      if (!configured()) return json(res, 503, { live:false, message:"KIS 설정이 필요합니다." });
      if (Date.now()-candidateCache.savedAt>60000 && !candidateRefresh) candidateRefresh=refreshCandidates();
      return json(res, 200, candidateCache.body);
    }
    if (url.pathname === "/api/stocks/search") {
      const query=url.searchParams.get("q")?.trim();
      return json(res, 200, query ? await searchUsStocks(query) : []);
    }
    if (url.pathname !== "/api/market/flow") return json(res, 404, { message: "Not found" });
    const requested = url.searchParams.get("market"), market = requested === "KOSDAQ" || requested === "NASDAQ" ? requested : "KOSPI",
      rows = await readMarket(market, accurateHistoryStart(market)), response = responseWithHistory(market, rows);
    if (response) return json(res, 200, response);
    if (market === "NASDAQ") return json(res, 200, await publicUsOverview());
    return json(res, 503, { live: false, code: "COLLECTING", message: "첫 시장 데이터를 수집하고 있습니다.", retryAfterMs: 3000 });
  } catch (error) {
    console.error("[api]", error);
    return json(res, 503, { live: false, code: "DATABASE_UNAVAILABLE", message: "데이터베이스 연결을 확인하고 있습니다.", retryAfterMs: 3000 });
  }
}).listen(port, "0.0.0.0", () => console.log(`FlowPulse API http://0.0.0.0:${port}`));

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => { await pool.end(); process.exit(); });
