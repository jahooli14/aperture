import { MarketDataPoint, Portfolio, InvestmentStrategy } from './types';

/**
 * Strategy 1: Buy and Hold
 * Invest all capital on day 1 and hold until the end
 */
export const buyAndHold: InvestmentStrategy = {
  name: 'Buy and Hold',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    const shares = initialCapital / data[0].close;

    for (const point of data) {
      portfolios.push({
        cash: 0,
        shares,
        value: shares * point.close
      });
    }

    return portfolios;
  }
};

/**
 * Strategy 2: Dollar Cost Averaging
 * Invest a fixed amount monthly regardless of price
 */
export const dollarCostAveraging: InvestmentStrategy = {
  name: 'Dollar Cost Averaging',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    const monthlyInvestment = initialCapital / (data.length / 21); // ~21 trading days per month
    let cash = initialCapital;
    let shares = 0;
    let daysSinceLastInvestment = 0;

    for (const point of data) {
      daysSinceLastInvestment++;

      // Invest monthly (every ~21 trading days)
      if (daysSinceLastInvestment >= 21 && cash >= monthlyInvestment) {
        const sharesToBuy = monthlyInvestment / point.close;
        shares += sharesToBuy;
        cash -= monthlyInvestment;
        daysSinceLastInvestment = 0;
      }

      portfolios.push({
        cash,
        shares,
        value: cash + shares * point.close
      });
    }

    return portfolios;
  }
};

/**
 * Strategy 3: Rebalancing Portfolio (60/40 stocks/bonds)
 * Rebalance quarterly to maintain 60/40 allocation
 * Assumes bonds return 4% annually with low volatility
 */
export const rebalancingPortfolio: InvestmentStrategy = {
  name: 'Rebalancing 60/40 Portfolio',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    let stockValue = initialCapital * 0.6;
    let bondValue = initialCapital * 0.4;
    let shares = stockValue / data[0].close;
    let daysSinceRebalance = 0;

    for (const point of data) {
      daysSinceRebalance++;

      // Bonds grow at ~4% annual (0.015% daily)
      bondValue *= 1.00015;

      // Calculate current stock value
      stockValue = shares * point.close;
      const totalValue = stockValue + bondValue;

      // Rebalance quarterly (~63 trading days)
      if (daysSinceRebalance >= 63) {
        const targetStockValue = totalValue * 0.6;
        const targetBondValue = totalValue * 0.4;

        shares = targetStockValue / point.close;
        stockValue = targetStockValue;
        bondValue = targetBondValue;
        daysSinceRebalance = 0;
      }

      portfolios.push({
        cash: bondValue,
        shares,
        value: totalValue
      });
    }

    return portfolios;
  }
};

/**
 * Strategy 4: Momentum Trading
 * Buy when 50-day MA > 200-day MA, sell otherwise
 */
export const momentumTrading: InvestmentStrategy = {
  name: 'Momentum Trading (50/200 MA)',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    let cash = initialCapital;
    let shares = 0;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];

      if (i >= 200) {
        // Calculate moving averages
        const ma50 = data.slice(i - 50, i).reduce((sum, p) => sum + p.close, 0) / 50;
        const ma200 = data.slice(i - 200, i).reduce((sum, p) => sum + p.close, 0) / 200;

        // Buy signal: 50-day MA crosses above 200-day MA
        if (ma50 > ma200 && shares === 0 && cash > 0) {
          shares = cash / point.close;
          cash = 0;
        }
        // Sell signal: 50-day MA crosses below 200-day MA
        else if (ma50 < ma200 && shares > 0) {
          cash = shares * point.close;
          shares = 0;
        }
      }

      portfolios.push({
        cash,
        shares,
        value: cash + shares * point.close
      });
    }

    return portfolios;
  }
};

export const allStrategies: InvestmentStrategy[] = [
  buyAndHold,
  dollarCostAveraging,
  rebalancingPortfolio,
  momentumTrading
];
