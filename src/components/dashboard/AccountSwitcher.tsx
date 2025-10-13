'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface AdAccount {
  id: string;
  accountName: string;
  customerId: string;
}

interface AccountSwitcherProps {
  currentAccountId: string;
  onAccountChange: (accountId: string) => void;
  token: string;
}

export default function AccountSwitcher({
  currentAccountId,
  onAccountChange,
  token,
}: AccountSwitcherProps) {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLinkedAccounts();
  }, [token]);

  const fetchLinkedAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/accounts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        const linkedAccounts = data.data.filter((acc: any) => acc.isLinked);
        setAccounts(linkedAccounts);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentAccount = accounts.find((acc) => acc.id === currentAccountId);

  if (isLoading) {
    return (
      <div className="h-10 w-64 bg-gray-200 animate-pulse rounded-lg" />
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">
            {currentAccount?.accountName || 'Select Account'}
          </p>
          {currentAccount && (
            <p className="text-xs text-gray-500">{currentAccount.customerId}</p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            {accounts.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No accounts found
              </div>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    onAccountChange(account.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0 ${
                    account.id === currentAccountId ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">
                    {account.accountName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {account.customerId}
                  </p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
