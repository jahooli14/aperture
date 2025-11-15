import { fetchHistoricalData, loadDataFromFile } from './fetchData';
import { highGrowthStrategies } from './highGrowthStrategies';
import { calculatePerformance, formatMetrics, compareStrategies } from './analytics';
import * as fs from 'fs';

const INITIAL_CAPITAL = 100000; // $100,000 starting capital
const DATA_FILE = 'market_data.json';

async function main() {
  console.log('='.repeat(80));
  console.log('PATHWAY HIGH-GROWTH STRATEGIES: 2020-2025 ANALYSIS');
  console.log('Finding strategies with exceptional returns in the last 5 years');
  console.log('='.repeat(80));
  console.log('');

  // Load data
  let data;
  if (fs.existsSync(DATA_FILE)) {
    console.log(`Loading cached data from ${DATA_FILE}...`);
    data = loadDataFromFile(DATA_FILE);
  } else {
    console.log('Fetching fresh market data...');
    data = await fetchHistoricalData('SPY', 1985);
  }

  // Filter to last 5 years (2020-2025)
  const last5YearsStart = new Date('2020-01-01');
  const filteredData = data.filter(d => d.date >= last5YearsStart);

  console.log(`Analyzing ${filteredData.length} trading days from 2020-2025`);
  console.log(`Date range: ${filteredData[0].date.toDateString()} to ${filteredData[filteredData.length - 1].date.toDateString()}`);
  console.log(`Initial capital: $${INITIAL_CAPITAL.toLocaleString()}`);
  console.log('');
  console.log('These strategies represent what would have worked exceptionally well:');
  console.log('- Tech concentration (NVDA, MSFT, etc.)');
  console.log('- Crypto allocation (BTC/ETH)');
  console.log('- AI/ML focused portfolios');
  console.log('- Leveraged growth strategies');
  console.log('- Perfect pandemic timing');
  console.log('');

  // Run all high-growth strategies
  const results = [];

  for (const strategy of highGrowthStrategies) {
    console.log(`Running strategy: ${strategy.name}...`);

    const portfolios = strategy.execute(filteredData, INITIAL_CAPITAL);
    const metrics = calculatePerformance(portfolios, filteredData, INITIAL_CAPITAL);

    results.push({
      strategy: strategy.name,
      metrics,
      portfolios
    });

    console.log(formatMetrics(metrics, strategy.name));
  }

  // Compare all strategies
  console.log(compareStrategies(results));

  // Save detailed results
  const resultsSummary = {
    period: '2020-2025',
    initialCapital: INITIAL_CAPITAL,
    dataPoints: filteredData.length,
    dateRange: {
      start: filteredData[0].date,
      end: filteredData[filteredData.length - 1].date
    },
    strategies: results.map(r => ({
      name: r.strategy,
      metrics: r.metrics
    }))
  };

  fs.writeFileSync('results_2020_2025.json', JSON.stringify(resultsSummary, null, 2));
  console.log('Detailed results saved to results_2020_2025.json');

  // Winner announcement
  const winner = results.sort((a, b) => b.metrics.finalValue - a.metrics.finalValue)[0];
  const topPerformance = (winner.metrics.totalReturn * 100).toFixed(0);

  console.log('');
  console.log('='.repeat(80));
  console.log(`🚀 HIGHEST RETURNS 2020-2025: ${winner.strategy}`);
  console.log(`   Initial Investment: $${INITIAL_CAPITAL.toLocaleString()}`);
  console.log(`   Final Value: $${winner.metrics.finalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
  console.log(`   Total Return: ${topPerformance}%`);
  console.log(`   Annualized Return: ${(winner.metrics.annualizedReturn * 100).toFixed(2)}%`);
  console.log('='.repeat(80));
  console.log('');
  console.log('⚠️  Past performance does not guarantee future results.');
  console.log('   These strategies carry significant risk and volatility.');
}

// Run the model
main().catch(err => {
  console.error('Error running model:', err);
  process.exit(1);
});
