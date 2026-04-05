import { MarketDataPoint, Portfolio, InvestmentStrategy } from './types';

/**
 * Strategy: AI/Tech Heavy Portfolio
 * 100% allocation to tech/AI sector with assumed 3x S&P performance
 * Represents aggressive tech stock picking (NVDA, MSFT, GOOGL, META, etc.)
 */
export const aiTechHeavy: InvestmentStrategy = {
  name: 'AI/Tech Heavy (3x S&P)',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    let value = initialCapital;

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        portfolios.push({
          cash: 0,
          shares: 0,
          value: initialCapital
        });
        continue;
      }

      // Calculate daily return and amplify by 3x for tech concentration
      const dailyReturn = (data[i].close - data[i - 1].close) / data[i - 1].close;
      const techMultiplier = 3.0; // Tech outperformed S&P by ~3x in AI boom

      // Apply multiplier, especially strong 2020-2025
      const year = data[i].date.getFullYear();
      let effectiveReturn = dailyReturn * techMultiplier;

      // Extra boost during AI boom (2023-2025)
      if (year >= 2023) {
        effectiveReturn *= 1.5; // AI boom multiplier
      }

      value = value * (1 + effectiveReturn);

      portfolios.push({
        cash: 0,
        shares: 0,
        value: Math.max(value, 0) // Can't go negative
      });
    }

    return portfolios;
  }
};

/**
 * Strategy: Crypto Allocation (10% BTC/ETH)
 * 90% S&P 500, 10% cryptocurrency
 * Crypto assumed to follow extreme growth pattern: 100x from 2020-2021, then volatile
 */
export const cryptoAllocation: InvestmentStrategy = {
  name: 'Crypto Allocation (10% BTC/ETH)',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    let stockValue = initialCapital * 0.9;
    let cryptoValue = initialCapital * 0.1;
    let shares = stockValue / data[0].close;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      const year = point.date.getFullYear();
      const month = point.date.getMonth();

      // Update stock value
      stockValue = shares * point.close;

      // Crypto growth model based on historical patterns
      let cryptoDailyGrowth = 0;

      if (year === 2020) {
        cryptoDailyGrowth = 0.005; // ~300% annual (BTC: $7k -> $29k)
      } else if (year === 2021) {
        cryptoDailyGrowth = 0.003; // ~170% annual (BTC: $29k -> $47k)
      } else if (year === 2022) {
        cryptoDailyGrowth = -0.003; // -60% crash (BTC: $47k -> $17k)
      } else if (year === 2023) {
        cryptoDailyGrowth = 0.004; // ~250% rally (BTC: $17k -> $42k)
      } else if (year === 2024) {
        cryptoDailyGrowth = 0.003; // ~170% (BTC: $42k -> $70k+)
      } else if (year === 2025) {
        cryptoDailyGrowth = 0.002; // Continued growth
      } else {
        cryptoDailyGrowth = 0.0001; // Minimal pre-2020
      }

      cryptoValue *= (1 + cryptoDailyGrowth + (Math.random() - 0.5) * 0.05); // High volatility

      const totalValue = stockValue + cryptoValue;

      portfolios.push({
        cash: cryptoValue,
        shares,
        value: totalValue
      });
    }

    return portfolios;
  }
};

/**
 * Strategy: Leveraged Growth (2x Leverage)
 * Uses 2x leverage on S&P 500 (like TQQQ or SSO)
 * Higher risk, higher reward
 */
export const leveragedGrowth: InvestmentStrategy = {
  name: 'Leveraged 2x S&P',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    let value = initialCapital;
    const leverage = 2.0;
    const borrowingCost = 0.00008; // ~2% annual interest on margin

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        portfolios.push({
          cash: 0,
          shares: 0,
          value: initialCapital
        });
        continue;
      }

      // Calculate leveraged daily return
      const dailyReturn = (data[i].close - data[i - 1].close) / data[i - 1].close;
      const leveragedReturn = dailyReturn * leverage - borrowingCost;

      value = value * (1 + leveragedReturn);

      // Margin call protection - can't lose more than 100%
      if (value < 0) value = 0;

      portfolios.push({
        cash: 0,
        shares: 0,
        value
      });
    }

    return portfolios;
  }
};

/**
 * Strategy: Pandemic Recovery Play
 * Identifies the 2020 crash and goes all-in during recovery
 * Represents perfect timing on COVID crash bottom
 */
export const pandemicRecoveryPlay: InvestmentStrategy = {
  name: 'Pandemic Recovery Play (2020 Timing)',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    let cash = initialCapital;
    let shares = 0;
    let enteredMarket = false;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      const year = point.date.getFullYear();
      const month = point.date.getMonth();

      // Hold cash until March 2020 (market bottom)
      if (year === 2020 && month === 2 && !enteredMarket) {
        // Buy at the bottom with 3x leverage
        shares = (cash * 3) / point.close;
        cash = 0;
        enteredMarket = true;
      }

      // Before entry, just hold cash with minimal interest
      if (!enteredMarket) {
        cash *= 1.00008; // ~2% annual on cash
      }

      const value = cash + shares * point.close;

      portfolios.push({
        cash,
        shares,
        value
      });
    }

    return portfolios;
  }
};

/**
 * Strategy: Magnificent 7 Tech Stocks
 * Concentrated bet on AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA
 * Assumes 4x S&P performance 2020-2025
 */
export const magnificent7: InvestmentStrategy = {
  name: 'Magnificent 7 Tech Stocks',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    let value = initialCapital;

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        portfolios.push({
          cash: 0,
          shares: 0,
          value: initialCapital
        });
        continue;
      }

      const dailyReturn = (data[i].close - data[i - 1].close) / data[i - 1].close;
      const year = data[i].date.getFullYear();

      let multiplier = 1.0;

      // Magnificent 7 massively outperformed 2020-2025
      if (year >= 2020 && year <= 2025) {
        multiplier = 4.0; // 4x S&P performance

        // NVIDIA boom 2023-2024
        if (year >= 2023) {
          multiplier = 6.0; // NVDA alone did ~10x
        }
      } else {
        multiplier = 1.5; // Still outperformed pre-2020
      }

      value = value * (1 + dailyReturn * multiplier);

      portfolios.push({
        cash: 0,
        shares: 0,
        value: Math.max(value, 0)
      });
    }

    return portfolios;
  }
};

/**
 * Strategy: ARK Innovation Style
 * High-risk, high-reward disruptive tech
 * Massive 2020-2021 gains, then drawdown, recovery 2023+
 */
export const arkInnovation: InvestmentStrategy = {
  name: 'ARK Innovation Style',
  execute: (data: MarketDataPoint[], initialCapital: number): Portfolio[] => {
    const portfolios: Portfolio[] = [];
    let value = initialCapital;

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        portfolios.push({
          cash: 0,
          shares: 0,
          value: initialCapital
        });
        continue;
      }

      const dailyReturn = (data[i].close - data[i - 1].close) / data[i - 1].close;
      const year = data[i].date.getFullYear();

      let multiplier = 1.5;
      let volatilityBoost = (Math.random() - 0.5) * 0.02; // High volatility

      if (year === 2020) {
        multiplier = 8.0; // ARK had ~150% returns
      } else if (year === 2021) {
        multiplier = 6.0; // Another massive year
      } else if (year === 2022) {
        multiplier = -2.0; // -67% drawdown
      } else if (year === 2023) {
        multiplier = 5.0; // AI recovery
      } else if (year >= 2024) {
        multiplier = 4.0; // Continued AI boom
      }

      value = value * (1 + dailyReturn * multiplier + volatilityBoost);
      value = Math.max(value, initialCapital * 0.1); // Floor at 10% of initial

      portfolios.push({
        cash: 0,
        shares: 0,
        value
      });
    }

    return portfolios;
  }
};

export const highGrowthStrategies: InvestmentStrategy[] = [
  magnificent7,
  aiTechHeavy,
  cryptoAllocation,
  arkInnovation,
  leveragedGrowth,
  pandemicRecoveryPlay
];
