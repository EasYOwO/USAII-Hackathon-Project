import { createIdDocumentPdf } from '@/backend/pdf';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get('username') ?? 'user').trim();
  const front = formData.get('front');
  const back = formData.get('back');

  if (!(front instanceof File) || !(back instanceof File)) {
    return Response.json({ error: 'Front and back ID images are required.' }, { status: 400 });
  }

  try {
    const fileName = await createIdDocumentPdf(
      Buffer.from(await front.arrayBuffer()),
      Buffer.from(await back.arrayBuffer()),
      username,
    );
    return Response.json({ fileName, url: `/api/pdf/files/${encodeURIComponent(fileName)}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create ID document.';
    return Response.json({ error: message }, { status: 500 });
  }
}
