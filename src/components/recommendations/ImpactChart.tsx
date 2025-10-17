'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';

interface ImpactData {
  metric: string;
  currentValue: number;
  projectedValue: number;
  changePercentage: number;
}

interface ImpactChartProps {
  impacts: ImpactData[];
  title?: string;
}

export default function ImpactChart({ impacts, title = 'Projected Impact' }: ImpactChartProps) {
  const formatValue = (value: number, metric: string) => {
    if (metric.toLowerCase().includes('cost') || metric.toLowerCase().includes('cpa')) {
      return `$${value.toFixed(2)}`;
    }
    if (metric.toLowerCase().includes('roas')) {
      return `${value.toFixed(2)}x`;
    }
    if (metric.toLowerCase().includes('ctr')) {
      return `${value.toFixed(2)}%`;
    }
    return value.toFixed(2);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

      <div className="space-y-4">
        {impacts.map((impact, index) => {
          const isPositive = impact.changePercentage > 0;
          const isCost = impact.metric.toLowerCase().includes('cost') ||
                         impact.metric.toLowerCase().includes('cpa');
          const isGoodChange = isCost ? !isPositive : isPositive;

          return (
            <div key={index} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{impact.metric}</span>
                <div className={`inline-flex items-center gap-1 text-sm font-semibold ${
                  isGoodChange ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {Math.abs(impact.changePercentage).toFixed(1)}%
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">Current</div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatValue(impact.currentValue, impact.metric)}
                  </div>
                </div>

                <div className="flex-1">
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    {/* Progress bar showing change */}
                    <div
                      className={`absolute h-full rounded-full transition-all ${
                        isGoodChange ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{
                        width: `${Math.min(Math.abs(impact.changePercentage), 100)}%`,
                        left: isPositive ? '50%' : 'auto',
                        right: !isPositive ? '50%' : 'auto',
                      }}
                    />
                    <div className="absolute top-0 left-1/2 w-0.5 h-full bg-gray-300" />
                  </div>
                </div>

                <div className="flex-1 text-right">
                  <div className="text-xs text-gray-500 mb-1">Projected</div>
                  <div className={`text-sm font-medium ${
                    isGoodChange ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {formatValue(impact.projectedValue, impact.metric)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {impacts.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No impact data available
        </p>
      )}
    </div>
  );
}
