import { NextResponse } from 'next/server';
import { getRegistrationInfo } from '@/lib/identity/erc8004';

export async function GET() {
  try {
    const info = await getRegistrationInfo();
    return NextResponse.json(info);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Identity error' },
      { status: 500 }
    );
  }
}
