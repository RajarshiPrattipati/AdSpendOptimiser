'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RecommendationsDashboard from '@/components/recommendations/RecommendationsDashboard';
import { Recommendation } from '@/components/recommendations/RecommendationCard';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function RecommendationsPage() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  useEffect(() => {
    // Get account ID from URL params
    const params = new URLSearchParams(window.location.search);
    const accountId = params.get('accountId');

    if (accountId) {
      setSelectedAccountId(accountId);
      fetchRecommendations(accountId);
    } else {
      setLoading(false);
      setError('Please select an account first');
    }
  }, []);

  const fetchRecommendations = async (accountId: string) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `/api/recommendations?accountId=${accountId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();
      if (data.success) {
        setRecommendations(data.data.recommendations);
      } else {
        throw new Error(data.error || 'Failed to fetch recommendations');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImplement = async (recommendationId: string) => {
    try {
      setActionLoading(true);

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/recommendations/implement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ recommendationId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to implement recommendation');
      }

      // Show success message
      alert(`✓ ${data.message}`);

      // Refresh recommendations
      if (selectedAccountId) {
        await fetchRecommendations(selectedAccountId);
      }
    } catch (err: any) {
      alert(`✗ Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (recommendationId: string, status: string) => {
    try {
      setActionLoading(true);

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/recommendations/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ recommendationId, status }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update recommendation');
      }

      // Show success message
      alert(`✓ ${data.message}`);

      // Refresh recommendations
      if (selectedAccountId) {
        await fetchRecommendations(selectedAccountId);
      }
    } catch (err: any) {
      alert(`✗ Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollback = async (recommendationId: string) => {
    if (!confirm('Are you sure you want to rollback this recommendation? This will revert all changes made to your Google Ads account.')) {
      return;
    }

    try {
      setActionLoading(true);

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/recommendations/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ recommendationId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to rollback recommendation');
      }

      // Show success message
      alert(`✓ ${data.message}`);

      // Refresh recommendations
      if (selectedAccountId) {
        await fetchRecommendations(selectedAccountId);
      }
    } catch (err: any) {
      alert(`✗ Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading recommendations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RecommendationsDashboard
          recommendations={recommendations}
          onImplement={handleImplement}
          onApprove={handleApprove}
          onRollback={handleRollback}
          loading={actionLoading}
        />
      </div>
    </div>
  );
}
