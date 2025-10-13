'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface AdAccount {
  customerId: string;
  accountName: string;
  currency: string;
  timezone: string;
  isLinked: boolean;
}

export default function AccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      localStorage.setItem('auth_token', tokenParam);
      fetchAccounts(tokenParam);
    } else {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        setToken(storedToken);
        fetchAccounts(storedToken);
      } else {
        router.push('/');
      }
    }
  }, [searchParams, router]);

  const fetchAccounts = async (authToken: string) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/accounts', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch accounts');
      }

      setAccounts(data.data);

      // Pre-select already linked accounts
      const linked = new Set(
        data.data.filter((acc: AdAccount) => acc.isLinked).map((acc: AdAccount) => acc.customerId)
      );
      setSelectedAccounts(linked);
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError('Failed to load accounts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAccount = (customerId: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedAccounts(newSelected);
  };

  const handleContinue = async () => {
    if (selectedAccounts.size === 0) {
      setError('Please select at least one account');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountIds: Array.from(selectedAccounts),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to link accounts');
      }

      // Redirect to dashboard with the first selected account
      const firstAccountId = data.data[0].id;
      router.push(`/dashboard?accountId=${firstAccountId}`);
    } catch (err) {
      console.error('Error linking accounts:', err);
      setError('Failed to link accounts. Please try again.');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your Google Ads accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Ad Accounts</h1>
            <p className="text-gray-600">
              Choose which Google Ads accounts you'd like to monitor and optimize with ADSO.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {accounts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No Google Ads accounts found.</p>
              <p className="text-sm text-gray-500">
                Make sure you have access to at least one Google Ads account.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-8">
                {accounts.map((account) => (
                  <div
                    key={account.customerId}
                    onClick={() => toggleAccount(account.customerId)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedAccounts.has(account.customerId)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedAccounts.has(account.customerId)
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300'
                            }`}
                          >
                            {selectedAccounts.has(account.customerId) && (
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
                        <div>
                          <h3 className="font-semibold text-gray-900">{account.accountName}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Customer ID: {account.customerId}
                          </p>
                          <div className="flex gap-4 mt-2">
                            <span className="text-xs text-gray-500">
                              Currency: {account.currency}
                            </span>
                            <span className="text-xs text-gray-500">
                              Timezone: {account.timezone}
                            </span>
                          </div>
                        </div>
                      </div>
                      {account.isLinked && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          Already linked
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-6 border-t">
                <p className="text-sm text-gray-600">
                  {selectedAccounts.size} account{selectedAccounts.size !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={handleContinue}
                  disabled={selectedAccounts.size === 0 || isSaving}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    'Continue to Dashboard'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
