'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { format, subDays } from 'date-fns';
import MetricsCards from '@/components/dashboard/MetricsCards';
import CampaignTable from '@/components/dashboard/CampaignTable';
import AccountSwitcher from '@/components/dashboard/AccountSwitcher';
import DateRangeSelector from '@/components/dashboard/DateRangeSelector';

interface DashboardData {
  campaigns: any[];
  summary: any;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken) {
      router.push('/');
      return;
    }
    setToken(storedToken);

    const accountIdParam = searchParams.get('accountId');
    if (accountIdParam) {
      setAccountId(accountIdParam);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (token && accountId) {
      fetchDashboardData();
    }
  }, [token, accountId, startDate, endDate]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        accountId: accountId!,
        startDate,
        endDate,
      });

      console.log('[Dashboard] Fetching campaigns for accountId:', accountId);
      const response = await fetch(`/api/campaigns?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      console.log('[Dashboard] API Response:', result);

      if (!response.ok || !result.success) {
        const errorMessage = result.error || 'Failed to fetch dashboard data';
        console.error('[Dashboard] API Error:', errorMessage);
        console.error('[Dashboard] Response status:', response.status);
        console.error('[Dashboard] Full response:', result);
        throw new Error(errorMessage);
      }

      console.log('[Dashboard] Successfully loaded data');
      setData(result.data);
    } catch (err: any) {
      console.error('[Dashboard] Error fetching dashboard data:', err);
      console.error('[Dashboard] Error message:', err.message);
      setError(err.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    router.push(`/dashboard?accountId=${newAccountId}`);
  };

  const handleDateRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleRefresh = () => {
    if (token && accountId) {
      fetchDashboardData();
    }
  };

  if (!token || !accountId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-gray-900">ADSO</h1>
              <AccountSwitcher
                currentAccountId={accountId}
                onAccountChange={handleAccountChange}
                token={token}
              />
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('auth_token');
                router.push('/');
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Recommendations Card */}
          <button
            onClick={() => router.push(`/recommendations?accountId=${accountId}`)}
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-left hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white bg-opacity-20 rounded-lg p-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">View All →</span>
            </div>
            <h3 className="text-white text-xl font-bold mb-2">AI Recommendations</h3>
            <p className="text-blue-100 text-sm">Get AI-powered optimization suggestions for your campaigns</p>
          </button>

          {/* Search Terms Card */}
          <button
            onClick={() => router.push(`/search-terms?accountId=${accountId}`)}
            className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-left hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white bg-opacity-20 rounded-lg p-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">Analyze →</span>
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Search Term Analysis</h3>
            <p className="text-red-100 text-sm">Find negative keyword opportunities to reduce wasted spend</p>
          </button>

          {/* Keywords Card */}
          <button
            onClick={() => router.push(`/keywords?accountId=${accountId}&campaignId=${data?.campaigns[0]?.campaignId || ''}`)}
            className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-left hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-white bg-opacity-20 rounded-lg p-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">Optimize →</span>
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Keyword Performance</h3>
            <p className="text-green-100 text-sm">Identify keywords to pause or scale based on performance</p>
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Campaign Performance</h2>
          <div className="flex items-center gap-4">
            <DateRangeSelector
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateRangeChange}
            />
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading campaign data...</p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Metrics Cards */}
            <MetricsCards summary={data.summary} />

            {/* Campaign Table */}
            <div className="mt-8">
              <CampaignTable campaigns={data.campaigns} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  );
}
