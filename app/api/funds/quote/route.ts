import { NextRequest, NextResponse } from 'next/server';

import { fetchFundQuotesFromSource } from '@/lib/funds/data-source';

export async function GET(request: NextRequest) {
  const codesParam = request.nextUrl.searchParams.get('codes') ?? '';
  const codes = codesParam
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);

  if (codes.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  try {
    const quotes = await fetchFundQuotesFromSource(codes);
    return NextResponse.json({ quotes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch fund quotes';

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
