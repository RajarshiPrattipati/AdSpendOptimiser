'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface SearchTermRecommendation {
  searchTerm: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  estimatedSavings: number;
  metrics: {
    cost: number;
    clicks: number;
    conversions: number;
    cpa: number;
    conversionRate: number;
  };
}

interface SearchTermData {
  summary: {
    totalSearchTerms: number;
    negativeKeywordCandidates: number;
    estimatedSavings: number;
    savingsByPriority: {
      high: number;
      medium: number;
      low: number;
    };
  };
  recommendations: {
    all: SearchTermRecommendation[];
    byPriority: {
      high: SearchTermRecommendation[];
      medium: SearchTermRecommendation[];
      low: SearchTermRecommendation[];
    };
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

function SearchTermsPageContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId');
  const campaignId = searchParams.get('campaignId');

  const [data, setData] = useState<SearchTermData | null>(null);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'high' | 'medium' | 'low' | 'all'>('high');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (accountId) {
      fetchSearchTerms();
    }
  }, [accountId, campaignId, startDate, endDate]);

  const fetchSearchTerms = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const params = new URLSearchParams({
        accountId: accountId!,
        startDate,
        endDate,
      });

      if (campaignId) {
        params.append('campaignId', campaignId);
      }

      const response = await fetch(`/api/search-terms?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch search terms');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching search terms:', err);
      setError('Failed to load search term report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTerm = (term: string) => {
    const newSelected = new Set(selectedTerms);
    if (newSelected.has(term)) {
      newSelected.delete(term);
    } else {
      newSelected.add(term);
    }
    setSelectedTerms(newSelected);
  };

  const selectAll = (recommendations: SearchTermRecommendation[]) => {
    const newSelected = new Set(selectedTerms);
    recommendations.forEach(rec => newSelected.add(rec.searchTerm));
    setSelectedTerms(newSelected);
  };

  const getRecommendations = () => {
    if (!data) return [];
    if (activeTab === 'all') return data.recommendations.all;
    return data.recommendations.byPriority[activeTab];
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

  if (!accountId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">No account selected</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Analyzing search terms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Search Term Report</h1>
          <p className="text-gray-600 mb-6">
            Identify negative keyword opportunities to reduce wasted ad spend
          </p>

          {/* Date Range Selector */}
          <div className="flex gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchSearchTerms}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Update Report
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          {data && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Total Search Terms</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.totalSearchTerms}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Negative Keyword Candidates</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.negativeKeywordCandidates}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-700">Estimated Monthly Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  ${data.summary.estimatedSavings.toFixed(2)}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700">High Priority Savings</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${data.summary.savingsByPriority.high.toFixed(2)}
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
                { key: 'high', label: 'High Priority', count: data?.recommendations.byPriority.high.length || 0 },
                { key: 'medium', label: 'Medium Priority', count: data?.recommendations.byPriority.medium.length || 0 },
                { key: 'low', label: 'Low Priority', count: data?.recommendations.byPriority.low.length || 0 },
                { key: 'all', label: 'All', count: data?.recommendations.all.length || 0 },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
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
                  {selectedTerms.size > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">
                        {selectedTerms.size} selected
                      </span>
                      <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium">
                        Add as Negative Keywords
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {getRecommendations().map((recommendation) => (
                    <div
                      key={recommendation.searchTerm}
                      onClick={() => toggleTerm(recommendation.searchTerm)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedTerms.has(recommendation.searchTerm)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-1">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                selectedTerms.has(recommendation.searchTerm)
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selectedTerms.has(recommendation.searchTerm) && (
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
                                {recommendation.searchTerm}
                              </h3>
                              <span className={`text-xs px-2 py-1 rounded border ${getPriorityColor(recommendation.priority)}`}>
                                {recommendation.priority.toUpperCase()}
                              </span>
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
                                <span className="text-gray-500">Conv. Rate:</span>
                                <span className="font-medium text-gray-900 ml-1">
                                  {recommendation.metrics.conversionRate.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-xs text-gray-500 mb-1">Est. Savings</p>
                          <p className="text-lg font-bold text-green-600">
                            ${recommendation.estimatedSavings.toFixed(2)}
                          </p>
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
                    ? 'No negative keyword recommendations found for this priority level.'
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

export default function SearchTermsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SearchTermsPageContent />
    </Suspense>
  );
}
