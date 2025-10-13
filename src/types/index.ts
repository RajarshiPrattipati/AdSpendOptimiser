// User types
export interface User {
  id: string;
  email: string;
  name?: string | null;
  googleId?: string | null;
}

// Ad Account types
export interface AdAccount {
  id: string;
  customerId: string;
  accountName: string;
  currency: string;
  timezone?: string | null;
  isActive: boolean;
  lastSyncedAt?: Date | null;
}

// Campaign types
export interface Campaign {
  id: string;
  campaignId: string;
  campaignName: string;
  status: string;
  biddingStrategy?: string | null;
  budget?: number | null;
  targetCpa?: number | null;
  targetRoas?: number | null;
}

// Metrics types
export interface CampaignMetrics {
  date: Date;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  averageCpc: number;
  costPerConversion: number;
  roas: number;
}

// Campaign with metrics
export interface CampaignWithMetrics extends Campaign {
  metrics: CampaignMetrics[];
  totalSpend?: number;
  totalConversions?: number;
  averageCpa?: number;
  averageRoas?: number;
}

// Dashboard summary
export interface DashboardSummary {
  totalSpend: number;
  totalConversions: number;
  averageCpa: number;
  averageRoas: number;
  averageCtr: number;
  totalClicks: number;
  totalImpressions: number;
  previousPeriod: {
    totalSpend: number;
    totalConversions: number;
    averageCpa: number;
    averageRoas: number;
  };
}

// Auth types
export interface AuthSession {
  userId: string;
  email: string;
  accessToken: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
