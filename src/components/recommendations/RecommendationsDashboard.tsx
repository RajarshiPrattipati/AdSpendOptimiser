'use client';

import { useState, useMemo } from 'react';
import { Filter, AlertCircle, CheckCircle, Clock, TrendingUp, X } from 'lucide-react';
import RecommendationCard, { Recommendation } from './RecommendationCard';

interface RecommendationsDashboardProps {
  recommendations: Recommendation[];
  onImplement: (id: string) => void;
  onApprove: (id: string, status: string) => void;
  onRollback: (id: string) => void;
  loading?: boolean;
}

type FilterType = 'all' | 'pending' | 'approved' | 'implemented';
type PriorityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type TypeFilter = 'all' | string;

export default function RecommendationsDashboard({
  recommendations,
  onImplement,
  onApprove,
  onRollback,
  loading = false,
}: RecommendationsDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Get unique types from recommendations
  const uniqueTypes = useMemo(() => {
    const types = new Set(recommendations.map(r => r.type));
    return Array.from(types);
  }, [recommendations]);

  // Filter recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(rec => {
      if (statusFilter !== 'all' && rec.status !== statusFilter.toUpperCase()) {
        return false;
      }
      if (priorityFilter !== 'all' && rec.priority !== priorityFilter) {
        return false;
      }
      if (typeFilter !== 'all' && rec.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [recommendations, statusFilter, priorityFilter, typeFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalImpact = recommendations.reduce((sum, rec) => {
      if (rec.impactMetric.toLowerCase().includes('cost') ||
          rec.impactMetric.toLowerCase().includes('cpa')) {
        return sum + Math.abs(rec.impactValue);
      }
      return sum;
    }, 0);

    return {
      total: recommendations.length,
      pending: recommendations.filter(r => r.status === 'PENDING').length,
      approved: recommendations.filter(r => r.status === 'APPROVED').length,
      implemented: recommendations.filter(r => r.status === 'IMPLEMENTED').length,
      critical: recommendations.filter(r => r.priority === 'critical').length,
      high: recommendations.filter(r => r.priority === 'high').length,
      avgConfidence: recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.confidenceScore, 0) / recommendations.length
        : 0,
      totalImpact,
    };
  }, [recommendations]);

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all';

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setTypeFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
            <p className="text-sm text-gray-600 mt-1">
              AI-powered optimization suggestions for your campaigns
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-600 rounded-full">
                {[statusFilter !== 'all', priorityFilter !== 'all', typeFilter !== 'all'].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
              <AlertCircle className="w-4 h-4" />
              Total
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-600 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Pending
            </div>
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Approved
            </div>
            <div className="text-2xl font-bold text-green-700">{stats.approved}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Implemented
            </div>
            <div className="text-2xl font-bold text-blue-700">{stats.implemented}</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              Est. Impact
            </div>
            <div className="text-2xl font-bold text-orange-700">{stats.totalImpact.toFixed(0)}%</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
              Confidence
            </div>
            <div className="text-2xl font-bold text-purple-700">
              {(stats.avgConfidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filter Recommendations</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <X className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FilterType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="implemented">Implemented</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-medium">{filteredRecommendations.length}</span> of{' '}
          <span className="font-medium">{recommendations.length}</span> recommendations
        </p>
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {priorityFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                Priority: {priorityFilter}
                <button onClick={() => setPriorityFilter('all')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {typeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                Type: {typeFilter.replace(/_/g, ' ')}
                <button onClick={() => setTypeFilter('all')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No recommendations found
            </h3>
            <p className="text-sm text-gray-600">
              {hasActiveFilters
                ? 'Try adjusting your filters or clearing them to see more recommendations.'
                : 'Check back later for new optimization suggestions.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          filteredRecommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              onImplement={onImplement}
              onApprove={onApprove}
              onRollback={onRollback}
              loading={loading}
            />
          ))
        )}
      </div>
    </div>
  );
}
