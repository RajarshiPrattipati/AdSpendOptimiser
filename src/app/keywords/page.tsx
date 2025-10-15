'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface KeywordRecommendation {
  keywordId: string;
  keywordText: string;
  action: 'pause' | 'scale' | 'optimize';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  metrics: {
    cost: number;
    clicks: number;
    conversions: number;
    cpa: number;
    ctr: number;
    qualityScore?: number;
  };
}

interface KeywordData {
  summary: {
    totalKeywords: number;
    potentialSavings: number;
    scaleOpportunity: number;
    totalRecommendations: number;
    byAction: {
      pause: number;
      scale: number;
      optimize: number;
    };
  };
  recommendations: {
    pause: KeywordRecommendation[];
    scale: KeywordRecommendation[];
    optimize: KeywordRecommendation[];
  };
}

export default function KeywordsPage() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId');
  const campaignId = searchParams.get('campaignId');

  const [data, setData] = useState<KeywordData | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pause' | 'scale' | 'optimize'>('pause');
  const [targetCpa, setTargetCpa] = useState<string>('100');

  useEffect(() => {
    if (accountId && campaignId) {
      fetchKeywords();
    }
  }, [accountId, campaignId, targetCpa]);

  const fetchKeywords = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const params = new URLSearchParams({
        accountId: accountId!,
        campaignId: campaignId!,
        targetCpa,
      });

      const response = await fetch(`/api/keywords?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch keywords');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching keywords:', err);
      setError('Failed to load keyword analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleKeyword = (keywordId: string) => {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(keywordId)) {
      newSelected.delete(keywordId);
    } else {
      newSelected.add(keywordId);
    }
    setSelectedKeywords(newSelected);
  };

  const selectAll = (recommendations: KeywordRecommendation[]) => {
    const newSelected = new Set(selectedKeywords);
    recommendations.forEach(rec => newSelected.add(rec.keywordId));
    setSelectedKeywords(newSelected);
  };

  const getRecommendations = () => {
    if (!data) return [];
    return data.recommendations[activeTab];
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'pause':
        return 'bg-red-600 hover:bg-red-700';
      case 'scale':
        return 'bg-green-600 hover:bg-green-700';
      case 'optimize':
        return 'bg-yellow-600 hover:bg-yellow-700';
      default:
        return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'pause':
        return 'Pause Selected Keywords';
      case 'scale':
        return 'Scale Selected Keywords';
      case 'optimize':
        return 'Review Selected Keywords';
      default:
        return 'Take Action';
    }
  };

  if (!accountId || !campaignId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">No account or campaign selected</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Analyzing keyword performance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Keyword Performance Analysis</h1>
          <p className="text-gray-600 mb-6">
            Optimize your campaigns with data-driven keyword recommendations
          </p>

          {/* Target CPA Input */}
          <div className="flex gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target CPA ($)
              </label>
              <input
                type="number"
                value={targetCpa}
                onChange={(e) => setTargetCpa(e.target.value)}
                onBlur={fetchKeywords}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-32"
                placeholder="100"
              />
            </div>
          </div>

          {/* Summary Stats */}
          {data && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Total Keywords</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.totalKeywords}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-700">Pause ({data.summary.byAction.pause})</p>
                <p className="text-2xl font-bold text-red-600">
                  ${data.summary.potentialSavings.toFixed(2)}
                </p>
                <p className="text-xs text-red-600 mt-1">potential savings</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-700">Scale ({data.summary.byAction.scale})</p>
                <p className="text-2xl font-bold text-green-600">
                  ${data.summary.scaleOpportunity.toFixed(2)}
                </p>
                <p className="text-xs text-green-600 mt-1">opportunity</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm text-yellow-700">Optimize ({data.summary.byAction.optimize})</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {data.summary.byAction.optimize}
                </p>
                <p className="text-xs text-yellow-600 mt-1">keywords to optimize</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700">Total Recommendations</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data.summary.totalRecommendations}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex">
              {[
                { key: 'pause', label: 'Pause', icon: '⏸️', count: data?.recommendations.pause.length || 0 },
                { key: 'scale', label: 'Scale', icon: '📈', count: data?.recommendations.scale.length || 0 },
                { key: 'optimize', label: 'Optimize', icon: '🎯', count: data?.recommendations.optimize.length || 0 },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {data && getRecommendations().length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => selectAll(getRecommendations())}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Select All
                  </button>
                  {selectedKeywords.size > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">
                        {selectedKeywords.size} selected
                      </span>
                      <button className={`px-4 py-2 text-white rounded-md transition-colors text-sm font-medium ${getActionColor(activeTab)}`}>
                        {getActionLabel(activeTab)}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {getRecommendations().map((recommendation) => (
                    <div
                      key={recommendation.keywordId}
                      onClick={() => toggleKeyword(recommendation.keywordId)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedKeywords.has(recommendation.keywordId)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-1">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                selectedKeywords.has(recommendation.keywordId)
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selectedKeywords.has(recommendation.keywordId) && (
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">
                                {recommendation.keywordText}
                              </h3>
                              <span className={`text-xs px-2 py-1 rounded border ${getPriorityColor(recommendation.priority)}`}>
                                {recommendation.priority.toUpperCase()}
                              </span>
                              {recommendation.metrics.qualityScore && (
                                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                  QS: {recommendation.metrics.qualityScore}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{recommendation.reason}</p>
                            <div className="grid grid-cols-5 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Cost:</span>
                                <span className="font-medium text-gray-900 ml-1">
                                  ${recommendation.metrics.cost.toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Clicks:</span>
                                <span className="font-medium text-gray-900 ml-1">
                                  {recommendation.metrics.clicks}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Conversions:</span>
                                <span className="font-medium text-gray-900 ml-1">
                                  {recommendation.metrics.conversions}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">CPA:</span>
                                <span className="font-medium text-gray-900 ml-1">
                                  ${recommendation.metrics.cpa.toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">CTR:</span>
                                <span className="font-medium text-gray-900 ml-1">
                                  {(recommendation.metrics.ctr * 100).toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  {data
                    ? `No keywords recommended for ${activeTab}.`
                    : 'No data available'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
