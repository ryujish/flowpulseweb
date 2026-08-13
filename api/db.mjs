import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://localhost/flowpulse" });

export async function migrate() {
  const client=await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock(715026)`);
    await client.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
    await importLegacyHistory();
  } finally {
    await client.query(`SELECT pg_advisory_unlock(715026)`);
    client.release();
  }
}

async function importLegacyHistory() {
  const { rows: [{ count }] } = await pool.query(`SELECT count(*)::int AS count FROM market_snapshots`);
  if (count) return;
  try {
    const saved = JSON.parse(await readFile(new URL("../.cache/market-history.json", import.meta.url), "utf8"));
    for (const market of ["KOSPI", "KOSDAQ", "NASDAQ"])
      for (const point of saved[market] ?? []) {
        const capturedAt = new Date(point.time);
        capturedAt.setSeconds(0, 0);
        const payload = { live: true, source: "저장된 실시간 시장 데이터", asOf: point.time, market, ...point };
        await pool.query(
          `INSERT INTO market_snapshots (market, captured_at, payload) VALUES ($1, $2, $3)
           ON CONFLICT (market, captured_at) DO UPDATE SET payload=EXCLUDED.payload`,
          [market, capturedAt, payload],
        );
      }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export async function saveSnapshot(flow) {
  const capturedAt = new Date(flow.asOf);
  capturedAt.setSeconds(0, 0);
  await pool.query(
    `INSERT INTO market_snapshots (market, captured_at, payload) VALUES ($1, $2, $3)
     ON CONFLICT (market, captured_at) DO UPDATE SET payload=EXCLUDED.payload`,
    [flow.market, capturedAt, flow],
  );
  await pool.query(
    `INSERT INTO ingestion_state (source, last_success_at, status, message) VALUES ($1, now(), 'healthy', NULL)
     ON CONFLICT (source) DO UPDATE SET last_success_at=EXCLUDED.last_success_at, status='healthy', message=NULL`,
    [`kis-${flow.market.toLowerCase()}`],
  );
}

export async function markFailure(market, error) {
  await pool.query(
    `INSERT INTO ingestion_state (source, status, message) VALUES ($1, 'error', $2)
     ON CONFLICT (source) DO UPDATE SET status='error', message=EXCLUDED.message`,
    [`kis-${market.toLowerCase()}`, String(error?.message ?? error).slice(0, 500)],
  );
}

export async function readMarket(market, since) {
  const { rows } = await pool.query(
    `SELECT captured_at AS "capturedAt", payload FROM market_snapshots
     WHERE market=$1 AND captured_at >= $2 ORDER BY captured_at`,
    [market, since],
  );
  return rows;
}

export const cleanup = () => pool.query(`DELETE FROM market_snapshots WHERE captured_at < now() - interval '7 days'`);
export async function saveCandidates(payload) {
  await pool.query(`INSERT INTO candidate_snapshot (id, saved_at, payload) VALUES (true, now(), $1) ON CONFLICT (id) DO UPDATE SET saved_at=now(), payload=EXCLUDED.payload`,[payload]);
}
export async function readCandidates() {
  const {rows}=await pool.query(`SELECT saved_at AS "savedAt", payload FROM candidate_snapshot WHERE id=true`);
  return rows[0]??null;
}
export async function health() {
  const { rows } = await pool.query(`SELECT source, last_success_at AS "lastSuccessAt", status, message FROM ingestion_state ORDER BY source`);
  return rows;
}
