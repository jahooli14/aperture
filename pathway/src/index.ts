/**
 * Pathway Investment Model
 * Entry point for the application
 */

export { fetchHistoricalData, loadDataFromFile, saveDataToFile } from './fetchData';
export { allStrategies, buyAndHold, dollarCostAveraging, rebalancingPortfolio, momentumTrading } from './strategies';
export { calculatePerformance, formatMetrics, compareStrategies } from './analytics';
export * from './types';

// Re-export main runner
import './runModel';
