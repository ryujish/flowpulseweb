export type FlowPoint = {
  time: string;
  foreign: number;
  personal: number;
  institution: number;
  program: number;
};
export type ProgramPoint = { time: string; value: number };
export function recentWindow<T extends { time: string }>(points: T[], asOf: string, limit = 30) {
  const end = new Date(asOf).getTime(), first = points[0],
    minutes = first ? Math.max(1, Math.min(limit, Math.round((end - new Date(first.time).getTime()) / 60000))) : 0,
    start = [...points].reverse().find((point) => new Date(point.time).getTime() <= end - minutes * 60000) ?? first;
  return { minutes, start };
}
export type MarketFlow = {
  live: boolean;
  source: string;
  asOf?: string;
  market?: string;
  snapshot?: Omit<FlowPoint, "time">;
  investorAvailable?: boolean;
  investorPoints?: FlowPoint[];
  programPoints?: ProgramPoint[];
  index?: {
    price: number;
    changeRate: number;
    twentyDay: number;
    advancing: number;
    declining: number;
  };
  leaders?: Array<{
    code: string;
    name: string;
    price: number;
    changeRate: number;
    twentyDay: number;
    personal: number;
    foreign: number;
    institution: number;
    program: number;
    investorAvailable?: boolean;
    investorEstimated?: boolean;
    personalAvailable?: boolean;
    preMarketPrice?: number;
    preMarketChangeRate?: number;
  }>;
  indices?: Array<{
    code: string;
    name: string;
    price: number;
    changeRate: number;
    points: ProgramPoint[];
  }>;
  forex?: { date: string; usdKrw: number; usdChange: number; jpyKrw: number; jpyChange: number } | null;
  collection?: { intervalSeconds: number; stored: number; maxStored?: number; lastStoredAt?: string };
  message?: string;
  code?: string;
};
export type MarketBundle = {
  live: boolean;
  source: string;
  asOf?: string;
  markets?: Record<"KOSPI" | "KOSDAQ", MarketFlow>;
  message?: string;
  code?: string;
};
export type MarketEvent = {
  time: string;
  title: string;
  detail: string;
  tone: "mint" | "violet" | "orange";
};
