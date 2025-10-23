import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SearchTermAnalyzer } from '@/lib/search-term-analyzer';
import type { SearchTermData } from '@/lib/google-ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Row = Record<string, string>;

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

// Basic CSV parser that handles quoted fields and commas inside quotes
function parseCsv(content: string): Row[] {
  const rows: Row[] = [];
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.length > 0);
  if (lines.length === 0) return rows;

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(v => v.trim());
  };

  const headerFields = parseLine(lines[0]).map(normalizeHeader);
  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    // Skip empty lines
    if (fields.every(f => f.trim() === '')) continue;
    const row: Row = {};
    for (let j = 0; j < headerFields.length; j++) {
      row[headerFields[j]] = fields[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function mapRowToSearchTerm(row: Row): SearchTermData | null {
  // Accept common variants of headers
  const searchTerm = row['search_term'] || row['search_terms'] || row['search_query'] || row['search_term__query'] || row['search_term__'] || row['search_term_(query)'] || row['search_term_(query)_'] || row['search_term_(query)'] || row['search_term_(search_query)'] || row['search_term_query'] || row['search_term'] || row['query'] || row['search'] || row['term'];
  const matchedKeyword = row['matched_keyword'] || row['keyword'] || row['keyword_text'] || row['keyword_(text)'];
  const matchType = row['match_type'] || row['matchtype'] || row['match_type_(excl._close_variants)'];
  const impressions = parseNumber(row['impressions']);
  const clicks = parseNumber(row['clicks']);
  const costRaw = row['cost'] || row['cost_(usd)'] || row['cost_(micros)'] || row['cost_(converted)'] || row['cost__'];
  let cost = parseNumber(costRaw);
  // If cost seems extremely high, it might be in micros
  if (cost > 100000) cost = cost / 1_000_000;
  const conversions = parseNumber(row['conversions'] || row['all_conversions'] || row['conv.']);
  const dateStr = row['date'] || row['day'] || row['date_(yyyy-mm-dd)'];
  const date = parseDate(dateStr) || new Date().toISOString().split('T')[0];

  if (!searchTerm) return null;

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? cost / clicks : 0;
  const cpa = conversions > 0 ? cost / conversions : 0;
  const conversionRate = impressions > 0 ? (conversions / impressions) * 100 : 0;

  return {
    searchTerm,
    matchedKeyword: matchedKeyword || undefined,
    matchType: matchType || undefined,
    impressions,
    clicks,
    cost,
    conversions,
    ctr,
    cpc,
    cpa,
    conversionRate,
    date,
  };
}

async function persistRows(
  accountId: string,
  rows: Row[],
  fallbackCampaignGoogleId?: string
) {
  // Build campaign cache by google campaign id and by name for the account
  const campaigns = await prisma.campaign.findMany({
    where: { adAccountId: accountId },
    select: { id: true, campaignId: true, campaignName: true },
  });
  const byGoogleId = new Map(campaigns.map(c => [c.campaignId, c]));
  const byName = new Map(campaigns.map(c => [c.campaignName.toLowerCase(), c]));

  let persisted = 0;

  for (const row of rows) {
    const st = mapRowToSearchTerm(row);
    if (!st) continue;

    // Determine campaign mapping
    const csvCampaignId = (row['campaign_id'] || row['campaign'] || '').toString();
    const csvCampaignName = (row['campaign_name'] || row['campaign'] || '').toString();

    let campaign = null as null | { id: string };
    if (csvCampaignId && byGoogleId.has(csvCampaignId)) {
      campaign = byGoogleId.get(csvCampaignId)!;
    } else if (csvCampaignName && byName.has(csvCampaignName.toLowerCase())) {
      campaign = byName.get(csvCampaignName.toLowerCase())!;
    } else if (fallbackCampaignGoogleId && byGoogleId.has(fallbackCampaignGoogleId)) {
      campaign = byGoogleId.get(fallbackCampaignGoogleId)!;
    }

    if (!campaign) {
      // Skip persistence when we can't determine the campaign
      continue;
    }

    try {
      await prisma.searchTerm.upsert({
        where: {
          campaignId_searchTerm_date: {
            campaignId: campaign.id,
            searchTerm: st.searchTerm,
            date: new Date(st.date),
          },
        },
        update: {
          matchedKeyword: st.matchedKeyword,
          matchType: st.matchType,
          impressions: st.impressions,
          clicks: st.clicks,
          cost: st.cost,
          conversions: st.conversions,
          ctr: st.ctr,
          cpc: st.cpc,
          cpa: st.cpa,
          conversionRate: st.conversionRate,
        },
        create: {
          campaignId: campaign.id,
          searchTerm: st.searchTerm,
          matchedKeyword: st.matchedKeyword,
          matchType: st.matchType,
          impressions: st.impressions,
          clicks: st.clicks,
          cost: st.cost,
          conversions: st.conversions,
          ctr: st.ctr,
          cpc: st.cpc,
          cpa: st.cpa,
          conversionRate: st.conversionRate,
          date: new Date(st.date),
        },
      });
      persisted++;
    } catch (e) {
      // Continue on individual row errors
      console.warn('[upload] Failed to persist row for term:', st.searchTerm, e);
    }
  }

  return { persisted };
}

/**
 * POST /api/search-terms/upload
 * Accepts a CSV file of search terms, parses, optionally persists, and returns recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await getUserFromToken(authHeader);

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const accountId = (formData.get('accountId') || '').toString();
    const fallbackCampaignId = (formData.get('campaignId') || '').toString(); // Google campaign ID
    const persist = (formData.get('persist') || 'true').toString() !== 'false';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Missing CSV file' }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Missing accountId' }, { status: 400 });
    }

    // Verify account ownership
    const account = await prisma.adAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    const isTestAccount = ['1234567890', '9876543210'].includes(account.customerId);
    if (!isTestAccount && account.userId !== session.userId) {
      return NextResponse.json({ success: false, error: 'Account not found or unauthorized' }, { status: 404 });
    }

    // Read CSV content
    const text = await (file as File).text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'CSV appears empty' }, { status: 400 });
    }

    // Map rows to SearchTermData
    const terms: SearchTermData[] = [];
    for (const row of rows) {
      const mapped = mapRowToSearchTerm(row);
      if (mapped) terms.push(mapped);
    }

    if (terms.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid search term rows found' }, { status: 400 });
    }

    // Optionally persist to DB
    let persisted = 0;
    if (persist) {
      const { persisted: count } = await persistRows(accountId, rows, fallbackCampaignId || undefined);
      persisted = count;
    }

    // Analyze and build response structure similar to GET /api/search-terms
    const recommendations = SearchTermAnalyzer.analyzeSearchTerms(terms);
    const savings = SearchTermAnalyzer.calculateTotalSavings(recommendations);
    const byPriority = {
      high: recommendations.filter(r => r.priority === 'high'),
      medium: recommendations.filter(r => r.priority === 'medium'),
      low: recommendations.filter(r => r.priority === 'low'),
    } as const;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalSearchTerms: terms.length,
          negativeKeywordCandidates: recommendations.length,
          estimatedSavings: savings.total,
          savingsByPriority: savings.byPriority,
        },
        recommendations: {
          all: recommendations,
          byPriority,
        },
        dateRange: {
          startDate: terms.reduce((min, t) => (min && min < t.date ? min : t.date), terms[0].date),
          endDate: terms.reduce((max, t) => (max && max > t.date ? max : t.date), terms[0].date),
        },
        persisted,
      },
    });
  } catch (error) {
    console.error('Error uploading search term CSV:', error);
    return NextResponse.json({ success: false, error: 'Failed to process CSV' }, { status: 500 });
  }
}

