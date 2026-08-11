import { strict as assert } from "node:assert";
import { flowConfidence, flowShift, flowSync, relativeProgramSeries, summary, temperature } from "./engine";
import { recentWindow } from "./domain";
const actual = {
  time: "14:32",
  foreign: 1200,
  personal: -1630,
  institution: -430,
  program: 860,
};
assert.equal(temperature(actual), 74);
assert.equal(temperature({ ...actual, program: -2000 }), 74);
assert.match(summary(actual).text, /기관 순매도/);
assert.match(summary({ ...actual, program: -2000 }).text, /프로그램 순매도/);
assert.equal(flowSync(actual), 65);
assert.equal(flowSync({ ...actual, foreign: 0, institution: 0, program: 0 }), 0);
assert.equal(flowConfidence(136), 87);
assert.equal(flowConfidence(136, false), 0);
assert.equal(flowShift(-1000, 120), "매도 약화");
assert.equal(flowShift(1000, 120), "매수 유지");
assert.equal(flowShift(1000, -120), "매수 약화");
console.log("engine checks passed");
assert.deepEqual(
  relativeProgramSeries([
    { time: "09:00", value: -2000 },
    { time: "09:01", value: -2150 },
  ]),
  [
    { time: "09:00", value: 0 },
    { time: "09:01", value: -150 },
  ],
);
const points = [1, 2, 3].map((value) => ({ time: `2026-08-10T01:${String(value * 10).padStart(2, "0")}:00Z`, value }));
assert.deepEqual(recentWindow(points, "2026-08-10T01:30:00Z"), { minutes: 20, start: points[0] });
assert.deepEqual(recentWindow(points, "2026-08-10T02:00:00Z"), { minutes: 30, start: points[2] });
