const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const MAX_FILE_CHARS = 5000;

async function parseFile(buffer, mimeType, fileName) {
  const ext = (fileName || '').toLowerCase();

  if (mimeType === 'text/plain' || ext.endsWith('.txt')) {
    return buffer.toString('utf-8').slice(0, MAX_FILE_CHARS);
  }

  if (mimeType === 'application/pdf' || ext.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return data.text.slice(0, MAX_FILE_CHARS);
  }

  if (
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.slice(0, MAX_FILE_CHARS);
  }

  return null;
}

module.exports = { parseFile };
