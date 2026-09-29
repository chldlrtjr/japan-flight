import { NextRequest, NextResponse } from 'next/server';
import { queryPromotions } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const airline = searchParams.get('airline') || 'ALL';
    const region = searchParams.get('region') || 'ALL';
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'default';

    const result = queryPromotions({
      airline,
      region,
      status,
      search,
      sort,
    });

    return NextResponse.json({
      success: true,
      promotions: result.promotions,
      stats: result.stats,
    });
  } catch (error: any) {
    console.error('Error fetching promotions:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
