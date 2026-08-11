import { configured, KisClient } from "./kis.mjs";
import { cleanup, markFailure, migrate, pool, saveSnapshot } from "./db.mjs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function newYorkMinutes(now) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now),
    value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(value.hour) * 60 + Number(value.minute);
}

function activeMarkets(now = new Date(), force = false) {
  if (force) return ["KOSPI", "NASDAQ", "KOSDAQ"];
  const domestic = now.getHours() >= 8 && now.getHours() < 20,
    ny = newYorkMinutes(now), us = ny >= 9 * 60 + 30 && ny <= 16 * 60;
  return [...(domestic ? ["KOSPI", "KOSDAQ"] : []), ...(us ? ["NASDAQ"] : [])];
}

async function fetchMarket(market) {
  for (let attempt = 0; attempt < 4; attempt++) try {
    const client = new KisClient(),
      flow = market === "NASDAQ" ? { snapshot: null, programPoints: [] } : await client.marketFlow(market),
      overview = market === "NASDAQ" ? await client.marketOverview(market) : await client.marketOverview(market).catch(() => ({}));
    return { live: true, source: "실시간 시장 데이터", asOf: new Date().toISOString(), market, ...flow, ...overview };
  } catch (error) {
    if (!String(error?.message).includes("초당") || attempt === 3) throw error;
    await delay(1500 * (attempt + 1));
  }
}

let running = false;
async function collect(force = false) {
  if (running) return;
  running = true;
  try {
    for (const market of activeMarkets(new Date(), force)) {
      try { await saveSnapshot(await fetchMarket(market)); }
      catch (error) { await markFailure(market, error); console.error(`[collector] ${market}:`, error?.message ?? error); }
      await delay(1200);
    }
    await cleanup();
  } finally { running = false; }
}

if (!configured()) throw new Error("KIS_APP_KEY와 KIS_APP_SECRET이 필요합니다.");
await migrate();
await collect(true);
const timer = setInterval(() => collect(), 60000);
console.log("FlowPulse collector: PostgreSQL에 1분 간격으로 저장합니다.");

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => {
  clearInterval(timer);
  await pool.end();
  process.exit();
});
