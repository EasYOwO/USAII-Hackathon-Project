import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { deletePdfFile } from '@/backend/pdf';
import { pdfRoot, safeFileName } from '@/backend/storage';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const url = new URL(request.url);
  const safeName = safeFileName(filename);
  const filePath = path.join(pdfRoot, safeName);
  const bytes = await readFile(filePath);
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Cache-Control': 'no-store',
  });

  if (url.searchParams.get('download') === '1') {
    headers.set('Content-Disposition', `attachment; filename="${safeName}"`);
  } else {
    headers.set('Content-Disposition', `inline; filename="${safeName}"`);
  }

  return new Response(bytes, { headers });
}

export async function DELETE(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  try {
    const deleted = await deletePdfFile(filename);
    return Response.json({ ok: true, fileName: deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    return Response.json({ error: message }, { status: 400 });
  }
}
