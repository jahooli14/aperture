export interface MarketDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Portfolio {
  cash: number;
  shares: number;
  value: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  yearlyReturns: YearlyReturn[];
  finalValue: number;
  initialValue: number;
}

export interface YearlyReturn {
  year: number;
  return: number;
  value: number;
}

export interface InvestmentStrategy {
  name: string;
  execute: (data: MarketDataPoint[], initialCapital: number) => Portfolio[];
}
