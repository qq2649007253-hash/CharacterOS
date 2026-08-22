import { NextResponse } from 'next/server';

import { h3Service } from '@/server/services/h3Service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const safeFilename = /^[^\u0000-\u001f\u007f"\\/]{1,240}$/;
const safeSubfolder = /^[\w\-./]{0,120}$/;

export const GET = async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const filename = params.get('filename') || '';
  const subfolder = params.get('subfolder') || '';
  if (!safeFilename.test(filename) || !safeSubfolder.test(subfolder) || subfolder.includes('..')) {
    return NextResponse.json({ error: '媒体路径不合法' }, { status: 400 });
  }
  try {
    const response = await h3Service.media(filename, subfolder);
    if (!response.ok || !response.body) return NextResponse.json({ error: 'H3 媒体不存在' }, { status: response.status || 404 });
    return new Response(response.body, {
      headers: {
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'H3 媒体读取失败' }, { status: 502 });
  }
};
