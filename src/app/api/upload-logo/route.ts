import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = formData.get('name') as string | null;

  if (!file || !name) {
    return NextResponse.json({ error: 'Missing file or name' }, { status: 400 });
  }

  const allowed = ['agni', 'merchant-moe', 'bybit', 'cian', 'mantle', 'aave'];
  if (!allowed.includes(name)) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const finalExt = ['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext) ? ext : 'png';
  const fileName = `${name}.${finalExt}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const logoDir = path.join(process.cwd(), 'public', 'logos');
  await writeFile(path.join(logoDir, fileName), buffer);

  return NextResponse.json({ ok: true, path: `/logos/${fileName}` });
}
