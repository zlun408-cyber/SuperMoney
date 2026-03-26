import { NextRequest, NextResponse } from 'next/server';

import { fetchFundSearchResultsFromSource } from '@/lib/funds/search';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim() ?? '';

  if (!query) {
    return NextResponse.json({ funds: [] });
  }

  try {
    const funds = await fetchFundSearchResultsFromSource(query);
    return NextResponse.json({ funds });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch fund search results';

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
