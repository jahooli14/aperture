import { fetchHistoricalData, loadDataFromFile, saveDataToFile } from './fetchData';
import { allStrategies } from './strategies';
import { calculatePerformance, formatMetrics, compareStrategies } from './analytics';
import * as fs from 'fs';

const INITIAL_CAPITAL = 100000; // $100,000 starting capital
const DATA_FILE = 'market_data.json';

async function main() {
  console.log('='.repeat(80));
  console.log('PATHWAY INVESTMENT MODEL');
  console.log('Analyzing 40 years of market data (1985-2025)');
  console.log('='.repeat(80));
  console.log('');

  // Fetch or load data
  let data;
  if (fs.existsSync(DATA_FILE)) {
    console.log(`Loading cached data from ${DATA_FILE}...`);
    data = loadDataFromFile(DATA_FILE);
  } else {
    console.log('Fetching fresh market data...');
    data = await fetchHistoricalData('SPY', 1985);
    saveDataToFile(data, DATA_FILE);
  }

  console.log(`Loaded ${data.length} trading days`);
  console.log(`Date range: ${data[0].date.toDateString()} to ${data[data.length - 1].date.toDateString()}`);
  console.log(`Initial capital: $${INITIAL_CAPITAL.toLocaleString()}`);
  console.log('');

  // Run all strategies
  const results = [];

  for (const strategy of allStrategies) {
    console.log(`Running strategy: ${strategy.name}...`);

    const portfolios = strategy.execute(data, INITIAL_CAPITAL);
    const metrics = calculatePerformance(portfolios, data, INITIAL_CAPITAL);

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
    initialCapital: INITIAL_CAPITAL,
    dataPoints: data.length,
    dateRange: {
      start: data[0].date,
      end: data[data.length - 1].date
    },
    strategies: results.map(r => ({
      name: r.strategy,
      metrics: r.metrics
    }))
  };

  fs.writeFileSync('results.json', JSON.stringify(resultsSummary, null, 2));
  console.log('Detailed results saved to results.json');

  // Winner announcement
  const winner = results.sort((a, b) => b.metrics.finalValue - a.metrics.finalValue)[0];
  console.log('');
  console.log('='.repeat(80));
  console.log(`🏆 BEST PERFORMING STRATEGY: ${winner.strategy}`);
  console.log(`   Final Value: $${winner.metrics.finalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
  console.log(`   Total Return: ${(winner.metrics.totalReturn * 100).toFixed(2)}%`);
  console.log('='.repeat(80));
}

// Run the model
main().catch(err => {
  console.error('Error running model:', err);
  process.exit(1);
});
