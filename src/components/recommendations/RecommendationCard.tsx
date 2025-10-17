'use client';

import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface Recommendation {
  id: string;
  type: string;
  status: string;
  title: string;
  description: string;
  reasoning: string;
  expectedImpact: string;
  impactMetric: string;
  impactValue: number;
  confidenceScore: number;
  priority: string;
  suggestedChanges: any;
  campaign?: {
    campaignName: string;
    status: string;
  };
  createdAt: string;
  implementedAt?: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onImplement: (id: string) => void;
  onApprove: (id: string, status: string) => void;
  onRollback: (id: string) => void;
  loading?: boolean;
}

export default function RecommendationCard({
  recommendation,
  onImplement,
  onApprove,
  onRollback,
  loading = false,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      PENDING: {
        icon: Clock,
        text: 'Pending',
        color: 'bg-gray-100 text-gray-700',
      },
      APPROVED: {
        icon: CheckCircle,
        text: 'Approved',
        color: 'bg-green-100 text-green-700',
      },
      REJECTED: {
        icon: XCircle,
        text: 'Rejected',
        color: 'bg-red-100 text-red-700',
      },
      IMPLEMENTED: {
        icon: CheckCircle,
        text: 'Implemented',
        color: 'bg-blue-100 text-blue-700',
      },
      DISMISSED: {
        icon: XCircle,
        text: 'Dismissed',
        color: 'bg-gray-100 text-gray-700',
      },
    };

    const statusConfig = config[status as keyof typeof config] || config.PENDING;
    const Icon = statusConfig.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${statusConfig.color}`}>
        <Icon className="w-3 h-3" />
        {statusConfig.text}
      </span>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      BUDGET_REALLOCATION: 'Budget',
      KEYWORD_OPTIMIZATION: 'Keywords',
      BID_ADJUSTMENT: 'Bids',
      AD_CREATIVE: 'Ad Creative',
      PAUSE_CAMPAIGN: 'Campaign Status',
      PAUSE_KEYWORD: 'Keyword Status',
      ADD_NEGATIVE_KEYWORD: 'Negative Keywords',
      BIDDING_STRATEGY_CHANGE: 'Bidding Strategy',
    };
    return labels[type] || type;
  };

  const getImpactIcon = () => {
    if (recommendation.impactValue < 0) {
      return <TrendingDown className="w-5 h-5 text-green-600" />;
    } else if (recommendation.impactValue > 0) {
      return <TrendingUp className="w-5 h-5 text-blue-600" />;
    }
    return <AlertCircle className="w-5 h-5 text-gray-600" />;
  };

  const canImplement = recommendation.status === 'APPROVED' || recommendation.status === 'PENDING';
  const canRollback = recommendation.status === 'IMPLEMENTED';
  const canApprove = recommendation.status === 'PENDING';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(recommendation.priority)}`}>
                {recommendation.priority.toUpperCase()}
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                {getTypeLabel(recommendation.type)}
              </span>
              {getStatusBadge(recommendation.status)}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {recommendation.title}
            </h3>
            {recommendation.campaign && (
              <p className="text-sm text-gray-600">
                Campaign: {recommendation.campaign.campaignName}
              </p>
            )}
          </div>
          <div className="text-right">
            {getImpactIcon()}
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {recommendation.expectedImpact}
            </div>
            <div className="text-xs text-gray-500">
              {(recommendation.confidenceScore * 100).toFixed(0)}% confidence
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-sm text-gray-700 mb-3">{recommendation.description}</p>

        {/* Impact Metric */}
        <div className="flex items-center gap-4 py-3 px-4 bg-gray-50 rounded-lg mb-3">
          <div className="flex-1">
            <div className="text-xs text-gray-500 uppercase mb-1">Expected Impact</div>
            <div className="text-sm font-medium text-gray-900">
              {recommendation.impactMetric}: <span className={recommendation.impactValue < 0 ? 'text-green-600' : 'text-blue-600'}>
                {recommendation.impactValue > 0 ? '+' : ''}{recommendation.impactValue.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500 uppercase mb-1">Confidence</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${recommendation.confidenceScore * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900">
                {(recommendation.confidenceScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {expanded ? 'Hide' : 'Show'} Details
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
            <div>
              <div className="text-xs font-medium text-gray-700 uppercase mb-1">Reasoning</div>
              <p className="text-sm text-gray-600">{recommendation.reasoning}</p>
            </div>
            {recommendation.suggestedChanges && (
              <div>
                <div className="text-xs font-medium text-gray-700 uppercase mb-1">Suggested Changes</div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(recommendation.suggestedChanges, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500">
          Created {new Date(recommendation.createdAt).toLocaleDateString()}
          {recommendation.implementedAt && (
            <> • Implemented {new Date(recommendation.implementedAt).toLocaleDateString()}</>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canApprove && (
            <>
              <button
                onClick={() => onApprove(recommendation.id, 'APPROVED')}
                disabled={loading}
                className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve
              </button>
              <button
                onClick={() => onApprove(recommendation.id, 'REJECTED')}
                disabled={loading}
                className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
            </>
          )}
          {canImplement && (
            <button
              onClick={() => onImplement(recommendation.id)}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Implement
            </button>
          )}
          {canRollback && (
            <button
              onClick={() => onRollback(recommendation.id)}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
              Rollback
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
