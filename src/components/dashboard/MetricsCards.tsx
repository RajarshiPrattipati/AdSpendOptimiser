'use client';

import { ArrowUp, ArrowDown, TrendingUp, DollarSign, Target, MousePointerClick, Eye } from 'lucide-react';

interface MetricsCardsProps {
  summary: {
    totalSpend: number;
    totalConversions: number;
    averageCpa: number;
    averageRoas: number;
    averageCtr: number;
    totalClicks: number;
    totalImpressions: number;
  };
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  format?: 'currency' | 'number' | 'percentage';
}

function MetricCard({ title, value, change, icon, format = 'number' }: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
            }`}>
              {isPositive ? (
                <ArrowUp className="w-4 h-4" />
              ) : isNegative ? (
                <ArrowDown className="w-4 h-4" />
              ) : null}
              <span>{Math.abs(change)}% vs last period</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MetricsCards({ summary }: MetricsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total Spend"
        value={formatCurrency(summary.totalSpend)}
        icon={<DollarSign className="w-5 h-5 text-blue-600" />}
        format="currency"
      />

      <MetricCard
        title="Total Conversions"
        value={formatNumber(summary.totalConversions)}
        icon={<Target className="w-5 h-5 text-blue-600" />}
        format="number"
      />

      <MetricCard
        title="Average CPA"
        value={formatCurrency(summary.averageCpa)}
        icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
        format="currency"
      />

      <MetricCard
        title="Average ROAS"
        value={summary.averageRoas.toFixed(2) + 'x'}
        icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
      />

      <MetricCard
        title="Average CTR"
        value={formatPercentage(summary.averageCtr)}
        icon={<MousePointerClick className="w-5 h-5 text-blue-600" />}
        format="percentage"
      />

      <MetricCard
        title="Total Clicks"
        value={formatNumber(summary.totalClicks)}
        icon={<MousePointerClick className="w-5 h-5 text-blue-600" />}
        format="number"
      />

      <MetricCard
        title="Total Impressions"
        value={formatNumber(summary.totalImpressions)}
        icon={<Eye className="w-5 h-5 text-blue-600" />}
        format="number"
      />
    </div>
  );
}
