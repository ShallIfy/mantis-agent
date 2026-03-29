import { NextRequest, NextResponse } from 'next/server';
import { mcpListTools, mcpCallTool } from '@/lib/mcp/client';
import { getMcpData, getMcpSwapQuote } from '@/lib/collectors/mcp';

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    if (action === 'tools') {
      const tools = await mcpListTools();
      return NextResponse.json({ tools: tools.tools });
    }

    if (action === 'invoke') {
      const tool = req.nextUrl.searchParams.get('tool');
      if (!tool) {
        return NextResponse.json({ error: 'tool parameter required' }, { status: 400 });
      }
      const argsRaw = req.nextUrl.searchParams.get('args') || '{}';
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(argsRaw);
      } catch {
        return NextResponse.json({ error: 'Invalid args JSON' }, { status: 400 });
      }
      const start = Date.now();
      const result = await mcpCallTool(tool, args);
      const latencyMs = Date.now() - start;
      return NextResponse.json({ result, latencyMs });
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
