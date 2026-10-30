import type { AiInsight } from '../types';

export const mockInsights: AiInsight[] = [
  {
    id: 'ai-01',
    title: 'Cooking Oil may need a larger purchase soon',
    summary:
      'Cooking Oil may require a larger purchase soon while supplier prices are trending upward.',
    whyItMatters:
      'Forecasted demand for the next 7 days is 34 bottles, but only 12 bottles are on hand — roughly 2 to 3 days of cover.',
    recommendedAction:
      'Review your next purchase quantity and consider ordering before the price adjustment takes effect in October.',
    impact: 'high',
    category: 'Purchasing',
    productId: 'p-01',
    supportingData: [
      { label: 'Current stock', value: '12 bottles' },
      { label: 'Forecast demand (7d)', value: '34 bottles' },
      { label: 'Estimated unit price', value: '₱59' },
      { label: 'Estimated cost', value: '₱2,006' },
    ],
    confidence: 82,
    generatedAt: '2026-09-03T06:00:00',
  },
  {
    id: 'ai-02',
    title: 'Pandesal is selling faster than it is restocked',
    summary:
      'Pandesal reached zero stock for the third time this month while daily demand stayed steady.',
    whyItMatters:
      'Average demand is 9.4 dozens per day, but the standing order is 15 dozens every two days. Weekend demand peaks near 12 dozens.',
    recommendedAction:
      'Increase the standing order to about 20 dozens, or schedule a second delivery on Saturdays.',
    impact: 'high',
    category: 'Inventory',
    productId: 'p-07',
    supportingData: [
      { label: 'Stock-outs this month', value: '3' },
      { label: 'Average daily demand', value: '9.4 dozens' },
      { label: 'Weekend peak', value: '12 dozens' },
      { label: 'Estimated lost sales', value: '₱1,560' },
    ],
    confidence: 88,
    generatedAt: '2026-09-03T06:00:00',
  },
  {
    id: 'ai-03',
    title: 'Flour cost is rising faster than your selling price',
    summary:
      'Flour supplier price rose 4.8% over three months while your selling price stayed at ₱82.',
    whyItMatters:
      'Profit per pack has narrowed from ₱24 to ₱20. At the forecast price of ₱65, profit would fall to ₱17.',
    recommendedAction:
      'Consider a small price adjustment, or request a volume discount from Masaganang Bakeshop Supplies.',
    impact: 'medium',
    category: 'Pricing',
    productId: 'p-03',
    supportingData: [
      { label: 'Cost 3 months ago', value: '₱58' },
      { label: 'Cost today', value: '₱62' },
      { label: 'Forecast cost', value: '₱65' },
      { label: 'Current margin', value: '₱20 per pack' },
    ],
    confidence: 76,
    generatedAt: '2026-09-03T06:00:00',
  },
  {
    id: 'ai-04',
    title: 'Soft Drinks stock is ahead of demand',
    summary:
      'Soft Drinks inventory covers roughly 15 days, more than double your usual 7-day target.',
    whyItMatters:
      'About ₱1,380 in cash is tied up in excess stock while supplier prices are expected to ease by 2.1%.',
    recommendedAction:
      'Hold the next Soft Drinks order and reallocate that budget to Cooking Oil or Pandesal.',
    impact: 'medium',
    category: 'Inventory',
    productId: 'p-06',
    supportingData: [
      { label: 'Days of stock left', value: '15.5 days' },
      { label: 'Target cover', value: '7 days' },
      { label: 'Excess value', value: '₱1,380' },
      { label: 'Price trend', value: 'Decreasing 2.1%' },
    ],
    confidence: 79,
    generatedAt: '2026-09-02T06:00:00',
  },
  {
    id: 'ai-05',
    title: 'Spoiled bakery items are concentrated on Mondays',
    summary:
      'Two-thirds of expired Pandesal was recorded on Mondays over the last eight weeks.',
    whyItMatters:
      'Sunday orders are sized for weekend demand, but Monday foot traffic is about 30% lower.',
    recommendedAction:
      'Reduce the Sunday evening order by about 3 dozens and monitor for two weeks.',
    impact: 'low',
    category: 'Waste',
    productId: 'p-07',
    supportingData: [
      { label: 'Monday share of losses', value: '66%' },
      { label: 'Monthly cost of losses', value: '₱303' },
      { label: 'Monday traffic vs. average', value: '-30%' },
      { label: 'Estimated monthly saving', value: '₱190' },
    ],
    confidence: 73,
    generatedAt: '2026-09-01T06:00:00',
  },
];

export const getInsightsForProduct = (productId: string) =>
  mockInsights.filter((i) => i.productId === productId);
