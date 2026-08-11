import assert from "node:assert/strict";
import { test } from "node:test";
import { accurateHistoryStart, marketIsOpen, marketSessionStart } from "./session.mjs";

test("국내장은 08시, 미국장은 뉴욕 09시 30분에 새 세션을 연다", () => {
  assert.equal(marketSessionStart("KOSPI", new Date("2026-08-07T01:00:00Z")).toISOString(), "2026-08-06T23:00:00.000Z");
  assert.equal(marketSessionStart("NASDAQ", new Date("2026-08-07T14:00:00Z")).toISOString(), "2026-08-07T13:30:00.000Z");
});

test("개장 전과 주말에는 직전 평일 세션을 유지한다", () => {
  assert.equal(marketSessionStart("NASDAQ", new Date("2026-08-10T12:00:00Z")).toISOString(), "2026-08-07T13:30:00.000Z");
});

test("국내 수급 차트는 수정 로직 적용 시각 이후 데이터만 쓴다", () => {
  assert.equal(accurateHistoryStart("KOSPI", new Date("2026-08-10T04:00:00Z")).toISOString(), "2026-08-10T03:31:00.000Z");
  assert.equal(accurateHistoryStart("KOSDAQ", new Date("2026-08-11T03:00:00Z")).toISOString(), "2026-08-10T23:00:00.000Z");
});

test("시장 개장 판정은 서버 시간대와 무관하다", () => {
  assert.equal(marketIsOpen("KOSPI", new Date("2026-08-10T22:59:00Z")), false);
  assert.equal(marketIsOpen("KOSPI", new Date("2026-08-10T23:00:00Z")), true);
  assert.equal(marketIsOpen("KOSPI", new Date("2026-08-11T04:30:00Z")), true);
  assert.equal(marketIsOpen("KOSPI", new Date("2026-08-11T10:59:00Z")), true);
  assert.equal(marketIsOpen("KOSPI", new Date("2026-08-11T11:30:00Z")), false);
  assert.equal(marketIsOpen("NASDAQ", new Date("2026-08-11T14:30:00Z")), true);
  assert.equal(marketIsOpen("NASDAQ", new Date("2026-08-11T04:30:00Z")), false);
});
