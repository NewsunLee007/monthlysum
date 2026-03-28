export async function parseFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt' || extension === 'md') {
    return await file.text();
  } else if (extension === 'pdf') {
    return await parsePDF(file);
  } else if (extension === 'docx') {
    return await parseDocx(file);
  } else {
    throw new Error(`Unsupported file type: ${extension}`);
  }
}

async function parsePDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configure worker for pdfjs
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str ?? '')
      .join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

async function parseDocx(file: File): Promise<string> {
  // Mammoth is easier to run on the server, or we can use mammoth browser version
  // We'll dynamically import mammoth to avoid server-side issues
  const mammoth = (await import('mammoth/mammoth.browser')).default;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
