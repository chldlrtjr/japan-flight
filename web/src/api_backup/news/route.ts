import { NextRequest, NextResponse } from 'next/server';
import { queryNews } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const isJapanOnly = searchParams.get('japan') === 'true' || searchParams.get('japan') === '1';
    const search = searchParams.get('search') || '';
    const airline = searchParams.get('airline') || 'ALL';

    const result = queryNews({
      isJapanOnly,
      search,
      airline,
    });

    return NextResponse.json({
      success: true,
      news: result.news,
      totalCount: result.totalCount,
      japanCount: result.japanCount,
    });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
