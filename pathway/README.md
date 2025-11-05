# Pathway Investment Model

An investment data analysis and modeling system that analyzes 40 years of historical market data to test investment strategies.

## Features

- Historical data fetching (S&P 500, bonds, commodities)
- Multiple investment strategy models
- Backtesting engine
- Performance metrics and reporting

## Setup

```bash
npm install
npm run fetch-data
npm run run-model
```

## Data Sources

- Uses public market data APIs for historical pricing
- Covers 40+ years of market history (1985-2025)

## Investment Strategies

The model implements several strategies:
1. Buy and Hold
2. Dollar Cost Averaging
3. Rebalancing Portfolio
4. Momentum-based Trading

## Output

Results include:
- Total returns
- Annualized returns
- Maximum drawdown
- Sharpe ratio
- Year-by-year performance
