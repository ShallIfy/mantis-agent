import { NextRequest, NextResponse } from 'next/server';
import { buildStateSnapshot } from '@/lib/collectors';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
  }

  try {
    const snapshot = await buildStateSnapshot(wallet);

    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'public, s-maxage=30' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
