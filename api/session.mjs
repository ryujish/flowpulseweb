const partsAt = (date, timeZone) => Object.fromEntries(
  new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).map((part) => [part.type, Number(part.value)]),
);

function zonedUtc(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute), atGuess = partsAt(new Date(guess), timeZone),
    offset = Date.UTC(atGuess.year, atGuess.month - 1, atGuess.day, atGuess.hour, atGuess.minute) - guess;
  return new Date(guess - offset);
}

function previousWeekday(year, month, day) {
  const value = new Date(Date.UTC(year, month - 1, day));
  do value.setUTCDate(value.getUTCDate() - 1); while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return [value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()];
}

export function marketSessionStart(market, now = new Date()) {
  const timeZone = market === "NASDAQ" ? "America/New_York" : "Asia/Seoul",
    opening = market === "NASDAQ" ? [9, 30] : [8, 0], p = partsAt(now, timeZone),
    minutes = p.hour * 60 + p.minute, openingMinutes = opening[0] * 60 + opening[1],
    date = minutes < openingMinutes || [0, 6].includes(new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay())
      ? previousWeekday(p.year, p.month, p.day)
      : [p.year, p.month, p.day];
  return zonedUtc(date[0], date[1], date[2], opening[0], opening[1], timeZone);
}

export function accurateHistoryStart(market, now = new Date()) {
  const session = marketSessionStart(market, now), corrected = new Date("2026-08-10T03:31:00Z");
  return market === "NASDAQ" || session > corrected ? session : corrected;
}
