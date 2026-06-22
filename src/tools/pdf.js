const Tool = require('./base');

class CreatePdfTool extends Tool {
  constructor() {
    super(
      'create_pdf',
      'Generate a nicely formatted PDF document and send it to the user. Call this when they ask for a report, document, summary, invoice, or anything they want as a PDF file.',
    );
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: "The user's Telegram ID from the system prompt",
        },
        title: {
          type: 'string',
          description: 'The document title, shown as a large heading on the first page',
        },
        content: {
          type: 'string',
          description:
            'The document body. Use markdown-like formatting:\n' +
            '# heading\n' +
            '## subheading\n' +
            '**bold text**\n' +
            '*italic text*\n' +
            '- list item\n' +
            '--- horizontal rule',
        },
      },
      required: ['userId', 'title', 'content'],
    };
  }

  async execute({ userId, title, content }) {
    const PDFDocument = require('pdfkit');
    const { getBot } = require('../bot');

    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', (c) => buffers.push(c));

    await new Promise((resolve) => {
      doc.on('end', resolve);

      this._renderTitle(doc, title);
      this._renderContent(doc, content);

      doc.end();
    });

    const pdfBuffer = Buffer.concat(buffers);
    const filename = title
      .replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .toLowerCase()
      .slice(0, 50) + '.pdf';

    const bot = getBot();
    await bot.sendDocument(userId, pdfBuffer, {}, {
      filename,
      contentType: 'application/pdf',
    });

    return `PDF "${title}" has been sent.`;
  }

  _renderTitle(doc, title) {
    doc.fontSize(28).font('Helvetica-Bold');
    doc.text(title, { align: 'center' });
    doc.moveDown(0.5);

    const now = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.fontSize(10).font('Helvetica').fillColor('#666666');
    doc.text(`Generated on ${now}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(2);

    doc.moveTo(50, doc.y).lineTo(565, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(1.5);
  }

  _renderContent(doc, content) {
    const lines = content.split('\n');

    for (let line of lines) {
      line = line.trimEnd();

      if (line.trim() === '') {
        doc.moveDown(0.5);
        continue;
      }

      if (line.startsWith('---')) {
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(565, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.5);
        continue;
      }

      if (line.startsWith('### ')) {
        doc.fontSize(13).font('Helvetica-Bold').text(line.slice(4), { underline: true });
        doc.fontSize(11).font('Helvetica');
        doc.moveDown(0.3);
        continue;
      }

      if (line.startsWith('## ')) {
        doc.fontSize(16).font('Helvetica-Bold').text(line.slice(3));
        doc.fontSize(11).font('Helvetica');
        doc.moveDown(0.5);
        continue;
      }

      if (line.startsWith('# ')) {
        doc.fontSize(20).font('Helvetica-Bold').text(line.slice(2));
        doc.fontSize(11).font('Helvetica');
        doc.moveDown(0.5);
        continue;
      }

      if (line.startsWith('- ') || line.startsWith('* ')) {
        const bullet = line.startsWith('- ') ? '\u2022' : '\u25E6';
        doc.fontSize(11).font('Helvetica').text(`  ${bullet}  ${line.slice(2)}`, { indent: 12 });
        continue;
      }

      if (/^\d+[.)]\s/.test(line)) {
        doc.fontSize(11).font('Helvetica').text(`  ${line}`, { indent: 12 });
        continue;
      }

      doc.fontSize(11).font('Helvetica').text(this._renderInline(line));
    }
  }

  _renderInline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1');
  }
}

module.exports = CreatePdfTool;
