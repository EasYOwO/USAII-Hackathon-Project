import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { ensureStorage, pdfRoot, safeFileName } from './storage';

export function parsePageSelection(value: string, totalPages: number) {
  const pages = new Set<number>();

  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startRaw, endRaw] = trimmed.split('-');
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        for (let page = Math.max(1, start); page <= Math.min(totalPages, end); page += 1) {
          pages.add(page - 1);
        }
      }
    } else {
      const page = Number.parseInt(trimmed, 10);
      if (Number.isFinite(page) && page >= 1 && page <= totalPages) {
        pages.add(page - 1);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export async function saveUploadedPdf(file: File) {
  await ensureStorage();
  const safeName = safeFileName(file.name.toLowerCase().endsWith('.pdf') ? file.name : `${file.name}.pdf`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(pdfRoot, safeName);
  await writeFile(filePath, bytes);
  return safeName;
}

export async function mergePdfs(fileNames: string[]) {
  await ensureStorage();
  const output = await PDFDocument.create();

  for (const fileName of fileNames) {
    const safeName = safeFileName(fileName);
    const bytes = await readFile(path.join(pdfRoot, safeName));
    const source = await PDFDocument.load(bytes);
    const copiedPages = await output.copyPages(source, source.getPageIndices());
    copiedPages.forEach((page) => output.addPage(page));
  }

  const outputName = safeFileName(`merged-${Date.now()}.pdf`);
  await writeFile(path.join(pdfRoot, outputName), await output.save());
  return outputName;
}

export async function extractPages(fileName: string, selection: string) {
  await ensureStorage();
  const safeName = safeFileName(fileName);
  const bytes = await readFile(path.join(pdfRoot, safeName));
  const source = await PDFDocument.load(bytes);
  const pageIndexes = parsePageSelection(selection, source.getPageCount());

  if (pageIndexes.length === 0) {
    throw new Error('No valid pages selected.');
  }

  const output = await PDFDocument.create();
  const copiedPages = await output.copyPages(source, pageIndexes);
  copiedPages.forEach((page) => output.addPage(page));

  const outputName = safeFileName(`pages-${selection.replace(/[^0-9,-]/g, '')}-${Date.now()}.pdf`);
  await writeFile(path.join(pdfRoot, outputName), await output.save());
  return outputName;
}

export async function deletePages(fileName: string, selection: string) {
  await ensureStorage();
  const safeName = safeFileName(fileName);
  const bytes = await readFile(path.join(pdfRoot, safeName));
  const source = await PDFDocument.load(bytes);
  const removeIndexes = new Set(parsePageSelection(selection, source.getPageCount()));
  const keepIndexes = source.getPageIndices().filter((index) => !removeIndexes.has(index));

  if (keepIndexes.length === 0) {
    throw new Error('Cannot delete every page.');
  }

  const output = await PDFDocument.create();
  const copiedPages = await output.copyPages(source, keepIndexes);
  copiedPages.forEach((page) => output.addPage(page));

  const outputName = safeFileName(`deleted-pages-${Date.now()}.pdf`);
  await writeFile(path.join(pdfRoot, outputName), await output.save());
  return outputName;
}

async function embedImageBytes(pdf: PDFDocument, bytes: Buffer) {
  try {
    return await pdf.embedPng(bytes);
  } catch {
    return await pdf.embedJpg(bytes);
  }
}

export async function createIdDocumentPdf(frontBytes: Buffer, backBytes: Buffer, username: string) {
  await ensureStorage();
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 24;
  const slotHeight = (height - margin * 3) / 2;

  const frontImage = await embedImageBytes(pdf, frontBytes);
  const backImage = await embedImageBytes(pdf, backBytes);

  const drawFitted = (image: Awaited<ReturnType<typeof embedImageBytes>>, y: number) => {
    const scale = Math.min((width - margin * 2) / image.width, slotHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    page.drawImage(image, {
      x: (width - drawWidth) / 2,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  };

  drawFitted(frontImage, height - margin - slotHeight);
  drawFitted(backImage, margin);

  const safeUser = username.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || 'user';
  const outputName = safeFileName(`ID-${safeUser}.pdf`);
  await writeFile(path.join(pdfRoot, outputName), await pdf.save());
  return outputName;
}

export async function deletePdfFile(fileName: string) {
  await ensureStorage();
  const safeName = safeFileName(fileName);
  if (!safeName.startsWith('ID-')) {
    throw new Error('Only temporary ID documents can be deleted.');
  }
  await unlink(path.join(pdfRoot, safeName));
  return safeName;
}
