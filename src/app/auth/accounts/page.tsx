'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface AdAccount {
  id?: string;
  customerId: string;
  accountName: string;
  currency: string;
  timezone: string;
  isLinked: boolean;
  isManagerAccount: boolean;
  isTestAccount?: boolean;
  canManageClients?: boolean;
}

interface AccountGroup {
  manager?: AdAccount;
  clients: AdAccount[];
}

function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
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

      const fetchedAccounts = data.data;
      setAccounts(fetchedAccounts);

      // Group accounts by manager
      const groups: AccountGroup[] = [];
      const managerAccounts = fetchedAccounts.filter((acc: AdAccount) => acc.isManagerAccount);
      const clientAccounts = fetchedAccounts.filter((acc: AdAccount) => !acc.isManagerAccount);

      // For each manager, create a group with its clients
      managerAccounts.forEach((manager: AdAccount) => {
        groups.push({
          manager,
          clients: clientAccounts.filter((client: AdAccount) =>
            // Match clients that might belong to this manager
            // Since we don't have the managerAccountId in the frontend response,
            // we'll show them grouped together
            true
          ),
        });
      });

      // If there are client accounts with no manager, add them as a separate group
      if (clientAccounts.length > 0 && managerAccounts.length === 0) {
        groups.push({
          clients: clientAccounts,
        });
      }

      setAccountGroups(groups);

      // Pre-select already linked accounts (including both managers and clients)
      const linked = new Set<string>(
        fetchedAccounts.filter((acc: AdAccount) => acc.isLinked).map((acc: AdAccount) => acc.customerId)
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

      // Redirect to dashboard with the first selected account's database ID
      // Find a client account (non-manager) if available, as managers can't view campaigns
      const clientAccounts = data.data.filter((acc: any) => !acc.isManagerAccount);
      const firstAccount = clientAccounts.length > 0 ? clientAccounts[0] : data.data[0];

      if (!firstAccount?.id) {
        console.error('No valid account ID found in response:', data.data);
        throw new Error('Failed to get account ID. Please try again.');
      }

      router.push(`/dashboard?accountId=${firstAccount.id}`);
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
              <div className="space-y-6 mb-8">
                {accountGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="space-y-3">
                    {/* Manager Account Header */}
                    {group.manager && (
                      <div
                        onClick={() => group.manager && toggleAccount(group.manager.customerId)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all bg-gradient-to-r from-purple-50 to-blue-50 ${
                          group.manager && selectedAccounts.has(group.manager.customerId)
                            ? 'border-purple-500'
                            : 'border-purple-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  group.manager && selectedAccounts.has(group.manager.customerId)
                                    ? 'bg-purple-600 border-purple-600'
                                    : 'border-gray-300'
                                }`}
                              >
                                {group.manager && selectedAccounts.has(group.manager.customerId) && (
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
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-900">{group.manager.accountName}</h3>
                                <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded font-semibold">
                                  MANAGER ACCOUNT
                                </span>
                                {group.manager.isTestAccount && (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold">
                                    TEST DATA
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                Customer ID: {group.manager.customerId}
                              </p>
                              <p className="text-xs text-purple-700 mt-1">
                                📊 Manages {group.clients.length} client account{group.clients.length !== 1 ? 's' : ''}
                              </p>
                              <div className="flex gap-4 mt-2">
                                <span className="text-xs text-gray-500">
                                  Currency: {group.manager.currency}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Timezone: {group.manager.timezone}
                                </span>
                              </div>
                            </div>
                          </div>
                          {group.manager.isLinked && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              Already linked
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Client Accounts */}
                    {group.clients.length > 0 && (
                      <div className="ml-8 space-y-2">
                        {group.clients.map((account) => (
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
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">{account.accountName}</h3>
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                      Client Account
                                    </span>
                                    {account.isTestAccount && (
                                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold">
                                        TEST DATA
                                      </span>
                                    )}
                                  </div>
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
                    )}
                  </div>
                ))}

                {/* Fallback: Show accounts that don't have groups */}
                {accountGroups.length === 0 && accounts.map((account) => (
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
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{account.accountName}</h3>
                            {account.isManagerAccount && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                Manager Account
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Customer ID: {account.customerId}
                          </p>
                          {account.isManagerAccount && (
                            <p className="text-xs text-orange-600 mt-1">
                              ⚠️ Manager accounts cannot view campaigns directly. Select client accounts instead.
                            </p>
                          )}
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

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AccountsPageContent />
    </Suspense>
  );
}
