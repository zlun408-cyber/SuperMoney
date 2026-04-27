import { NextRequest, NextResponse } from 'next/server';
import { getNavWithCache } from '@/lib/funds/nav-cache';
import type { NavCacheEntry } from '@/lib/funds/types';

interface NavApiResponse {
  success: boolean;
  data?: NavCacheEntry;
  error?: {
    code: string;
    message: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<NavApiResponse>> {
  const fundCode = request.nextUrl.searchParams.get('fundCode');
  const date = request.nextUrl.searchParams.get('date');

  if (!fundCode || !date) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'fundCode and date are required',
        },
      },
      { status: 400 }
    );
  }

  try {
    const entry = await getNavWithCache(fundCode, date);

    if (!entry) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NAV_NOT_FOUND',
            message: '净值未找到，请确认交易日期和下单时段后重试',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch nav';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message,
        },
      },
      { status: 502 }
    );
  }
}
