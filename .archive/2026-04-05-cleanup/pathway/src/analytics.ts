import { Portfolio, PerformanceMetrics, YearlyReturn, MarketDataPoint } from './types';

/**
 * Calculate comprehensive performance metrics for a portfolio
 */
export function calculatePerformance(
  portfolios: Portfolio[],
  data: MarketDataPoint[],
  initialCapital: number,
  riskFreeRate: number = 0.04 // 4% annual risk-free rate
): PerformanceMetrics {
  const finalValue = portfolios[portfolios.length - 1].value;
  const totalReturn = (finalValue - initialCapital) / initialCapital;

  // Calculate annualized return
  const years = data.length / 252; // ~252 trading days per year
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;

  // Calculate maximum drawdown
  let maxDrawdown = 0;
  let peak = portfolios[0].value;

  for (const portfolio of portfolios) {
    if (portfolio.value > peak) {
      peak = portfolio.value;
    }
    const drawdown = (peak - portfolio.value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Calculate Sharpe ratio (excess return / volatility)
  const returns = portfolios.slice(1).map((p, i) =>
    (p.value - portfolios[i].value) / portfolios[i].value
  );
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 0), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
  const annualizedAvgReturn = avgReturn * 252;
  const sharpeRatio = (annualizedAvgReturn - riskFreeRate) / volatility;

  // Calculate yearly returns
  const yearlyReturns: YearlyReturn[] = [];
  let currentYear = data[0].date.getFullYear();
  let yearStartValue = portfolios[0].value;
  let yearStartIndex = 0;

  for (let i = 0; i < data.length; i++) {
    const year = data[i].date.getFullYear();

    if (year !== currentYear || i === data.length - 1) {
      const yearEndValue = portfolios[i - 1]?.value || portfolios[i].value;
      const yearReturn = (yearEndValue - yearStartValue) / yearStartValue;

      yearlyReturns.push({
        year: currentYear,
        return: yearReturn,
        value: yearEndValue
      });

      currentYear = year;
      yearStartValue = yearEndValue;
      yearStartIndex = i;
    }
  }

  return {
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    sharpeRatio,
    yearlyReturns,
    finalValue,
    initialValue: initialCapital
  };
}

/**
 * Format performance metrics for display
 */
export function formatMetrics(metrics: PerformanceMetrics, strategyName: string): string {
  let output = `\n${'='.repeat(60)}\n`;
  output += `Strategy: ${strategyName}\n`;
  output += `${'='.repeat(60)}\n\n`;

  output += `Initial Investment: $${metrics.initialValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
  output += `Final Value:        $${metrics.finalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
  output += `Total Return:       ${(metrics.totalReturn * 100).toFixed(2)}%\n`;
  output += `Annualized Return:  ${(metrics.annualizedReturn * 100).toFixed(2)}%\n`;
  output += `Max Drawdown:       ${(metrics.maxDrawdown * 100).toFixed(2)}%\n`;
  output += `Sharpe Ratio:       ${metrics.sharpeRatio.toFixed(2)}\n\n`;

  output += `Year-by-Year Performance:\n`;
  output += `${'-'.repeat(40)}\n`;

  for (const yr of metrics.yearlyReturns) {
    const returnStr = (yr.return * 100).toFixed(2);
    const valueStr = yr.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    output += `${yr.year}: ${returnStr.padStart(8)}%  ($${valueStr})\n`;
  }

  return output;
}

/**
 * Compare multiple strategies
 */
export function compareStrategies(results: Array<{ strategy: string; metrics: PerformanceMetrics }>): string {
  let output = `\n${'='.repeat(80)}\n`;
  output += `STRATEGY COMPARISON\n`;
  output += `${'='.repeat(80)}\n\n`;

  // Sort by annualized return
  const sorted = [...results].sort((a, b) => b.metrics.annualizedReturn - a.metrics.annualizedReturn);

  output += `${'Strategy'.padEnd(30)} | ${'Final Value'.padEnd(15)} | ${'Annual Return'.padEnd(12)} | Sharpe\n`;
  output += `${'-'.repeat(78)}\n`;

  for (const result of sorted) {
    const name = result.strategy.padEnd(30);
    const value = `$${result.metrics.finalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`.padEnd(15);
    const annualReturn = `${(result.metrics.annualizedReturn * 100).toFixed(2)}%`.padEnd(12);
    const sharpe = result.metrics.sharpeRatio.toFixed(2);

    output += `${name} | ${value} | ${annualReturn} | ${sharpe}\n`;
  }

  output += `\n`;
  return output;
}
