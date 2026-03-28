import { NextRequest, NextResponse } from 'next/server';
import { mcpListTools } from '@/lib/mcp/client';
import { getMcpData, getMcpSwapQuote } from '@/lib/collectors/mcp';

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    if (action === 'tools') {
      const tools = await mcpListTools();
      return NextResponse.json({ tools: tools.tools });
    }

    if (action === 'swap-quote') {
      const tokenIn = req.nextUrl.searchParams.get('tokenIn') || '';
      const tokenOut = req.nextUrl.searchParams.get('tokenOut') || '';
      const amountIn = req.nextUrl.searchParams.get('amountIn') || '1';
      const quote = await getMcpSwapQuote(tokenIn, tokenOut, amountIn);
      return NextResponse.json({ quote });
    }

    // Default: return lending markets + chain status
    const data = await getMcpData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'MCP error' },
      { status: 500 }
    );
  }
}
