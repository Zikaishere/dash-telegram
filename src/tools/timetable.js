const Tool = require('./base');
const Event = require('../database/models/Event');

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const COLORS = ['#4A90D9', '#7B68EE', '#2ECC71', '#E74C3C', '#F39C12', '#1ABC9C', '#E91E63', '#00BCD4'];
const CELL_W = 68;
const CELL_H = 24;
const TIME_W = 48;
const HEADER_H = 28;
const MARGIN = 40;
const PAGE_W = 595;
const PAGE_H = 842;
const C_WIDTH = CELL_W * 7;

class GenerateTimetableTool extends Tool {
  constructor() {
    super('generate_timetable', 'Generate and send a visual PDF timetable (weekly, daily, or monthly view) showing all calendar events. Call when the user asks for their schedule or timetable.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        range: { type: 'string', enum: ['week', 'today', 'month'], description: 'View: week (Mon-Sun), today (single day), or month (full month overview)' },
        startDate: { type: 'string', description: 'Optional ISO date to start from. Defaults to current week/today/month.' },
      },
      required: ['userId', 'range'],
    };
  }

  async execute({ userId, range, startDate }) {
    const base = startDate ? new Date(startDate) : new Date();
    const { from, to, label } = this._getRange(base, range);

    const events = await Event.find({
      userId,
      start: { $gte: from, $lte: to },
    }).sort({ start: 1 });

    const PDFDocument = require('pdfkit');
    const { getBot } = require('../bot');
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
    const bufs = [];
    doc.on('data', (c) => bufs.push(c));

    await new Promise((resolve) => {
      doc.on('end', resolve);

      doc.fontSize(20).font('Helvetica-Bold').text(label, { align: 'center' });
      doc.moveDown(1.5);

      if (range === 'today') {
        this._drawDayView(doc, events, base);
      } else if (range === 'month') {
        this._drawMonthView(doc, events, base);
      } else {
        this._drawWeekView(doc, events, base);
      }

      doc.end();
    });

    const buf = Buffer.concat(bufs);
    const bot = getBot();
    await bot.sendDocument(userId, buf, {}, {
      filename: `timetable_${range}_${from.toISOString().slice(0, 10)}.pdf`,
      contentType: 'application/pdf',
    });

    return `Timetable (${range}) PDF sent.`;
  }

  _getRange(base, range) {
    const d = new Date(base);
    if (range === 'today') {
      const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const e = new Date(s);
      e.setDate(e.getDate() + 1);
      return { from: s, to: e, label: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) };
    }
    if (range === 'month') {
      const s = new Date(d.getFullYear(), d.getMonth(), 1);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      e.setHours(23, 59, 59);
      return { from: s, to: e, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
    }
    // week: Mon-Sun
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((day + 6) % 7));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59);
    const label = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' — ' + sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { from: mon, to: sun, label };
  }

  _drawWeekView(doc, events, base) {
    const day = base.getDay();
    const mon = new Date(base);
    mon.setDate(base.getDate() - ((day + 6) % 7));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      days.push(d);
    }

    const x0 = MARGIN + TIME_W;
    const y0 = doc.y;

    // Header row
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Time', MARGIN, y0 + 6, { width: TIME_W, align: 'center' });
    days.forEach((d, i) => {
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      doc.text(label, x0 + i * CELL_W, y0 + 6, { width: CELL_W, align: 'center' });
    });

    // Grid
    let colorIdx = 0;
    const eventColors = {};
    const colorFor = (title) => {
      if (!eventColors[title]) {
        eventColors[title] = COLORS[colorIdx % COLORS.length];
        colorIdx++;
      }
      return eventColors[title];
    };

    HOURS.forEach((h, hi) => {
      const y = y0 + HEADER_H + hi * CELL_H;
      const ampm = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

      // Time label
      doc.fontSize(7).font('Helvetica').fillColor('#666');
      doc.text(ampm, MARGIN, y + 2, { width: TIME_W - 4, align: 'right' });
      doc.fillColor('#000');

      // Row line
      doc.moveTo(MARGIN, y + CELL_H).lineTo(MARGIN + TIME_W + C_WIDTH, y + CELL_H).strokeColor('#eee').stroke();

      // Column lines and event cells
      days.forEach((d, di) => {
        const cx = x0 + di * CELL_W;
        if (hi === 0) {
          doc.moveTo(cx, y0 + HEADER_H).lineTo(cx, y0 + HEADER_H + HOURS.length * CELL_H).strokeColor('#ddd').stroke();
        }

        const cellStart = new Date(d);
        cellStart.setHours(h, 0, 0, 0);
        const cellEnd = new Date(d);
        cellEnd.setHours(h + 1, 0, 0, 0);

        const matching = events.filter(e => {
          const es = new Date(e.start);
          return es >= cellStart && es < cellEnd &&
            es.toDateString() === d.toDateString();
        });

        matching.forEach(ev => {
          doc.rect(cx + 1, y + 1, CELL_W - 2, CELL_H - 2).fill(colorFor(ev.title));
          doc.fontSize(6).font('Helvetica-Bold').fillColor('#fff');
          doc.text(ev.title, cx + 3, y + 3, { width: CELL_W - 4, height: CELL_H - 4, lineGap: -1 });
          doc.fillColor('#000');
        });
      });
    });

    // Right border
    doc.moveTo(x0 + C_WIDTH, y0 + HEADER_H).lineTo(x0 + C_WIDTH, y0 + HEADER_H + HOURS.length * CELL_H).strokeColor('#ddd').stroke();
  }

  _drawDayView(doc, events, base) {
    const y0 = doc.y;
    const x0 = MARGIN + TIME_W;
    const labelW = PAGE_W - MARGIN * 2 - TIME_W - 20;

    const dateLabel = base.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    doc.fontSize(14).font('Helvetica-Bold').text(dateLabel, x0, y0);
    doc.moveDown(0.5);

    const eventsToday = events.filter(e => new Date(e.start).toDateString() === base.toDateString());
    const dayY = doc.y;
    const headerH = 20;

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Time', MARGIN, dayY + 4, { width: TIME_W, align: 'center' });
    doc.text('Events', x0, dayY + 4, { width: labelW, align: 'center' });

    HOURS.forEach((h, hi) => {
      const y = dayY + headerH + hi * CELL_H;
      const ampm = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

      doc.fontSize(7).font('Helvetica').fillColor('#666');
      doc.text(ampm, MARGIN, y + 2, { width: TIME_W - 4, align: 'right' });
      doc.fillColor('#000');

      doc.moveTo(MARGIN, y + CELL_H).lineTo(PAGE_W - MARGIN, y + CELL_H).strokeColor('#eee').stroke();

      const cellStart = new Date(base);
      cellStart.setHours(h, 0, 0, 0);
      const cellEnd = new Date(base);
      cellEnd.setHours(h + 1, 0, 0, 0);

      const matching = eventsToday.filter(e => {
        const es = new Date(e.start);
        return es >= cellStart && es < cellEnd;
      });

      matching.forEach(ev => {
        doc.rect(x0 + 1, y + 1, labelW - 2, CELL_H - 2).fill('#4A90D9');
        doc.fontSize(6).font('Helvetica-Bold').fillColor('#fff');
        doc.text(ev.title, x0 + 4, y + 3, { width: labelW - 8, height: CELL_H - 4 });
        doc.fillColor('#000');
      });
    });

    if (eventsToday.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#999');
      doc.text('No events today.', x0, dayY + headerH + 10);
      doc.fillColor('#000');
    }
  }

  _drawMonthView(doc, events, base) {
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay();
    const daysInMonth = last.getDate();
    const cols = 7;
    const cw = 64;
    const ch = 52;
    const headerH = 20;
    const x0 = MARGIN;
    const y0 = doc.y;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    doc.fontSize(8).font('Helvetica-Bold');
    dayNames.forEach((n, i) => {
      doc.text(n, x0 + i * cw, y0 + 4, { width: cw, align: 'center' });
    });

    const gridY = y0 + headerH;
    let dayNum = 1;
    let done = false;

    for (let row = 0; row < 6 && !done; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = x0 + col * cw;
        const cy = gridY + row * ch;

        if (row === 0 && col < startDay) continue;
        if (dayNum > daysInMonth) { done = true; break; }

        const d = new Date(year, month, dayNum);
        doc.rect(cx, cy, cw, ch).strokeColor('#ddd').stroke();

        doc.fontSize(8).font('Helvetica-Bold').text(String(dayNum), cx + 3, cy + 2);

        const dayEvents = events.filter(e => new Date(e.start).toDateString() === d.toDateString());
        dayEvents.slice(0, 2).forEach(ev => {
          doc.fontSize(6).font('Helvetica').fillColor('#4A90D9');
          doc.text(ev.title.length > 12 ? ev.title.slice(0, 12) + '..' : ev.title, cx + 2, cy + 12 + (dayEvents.indexOf(ev) * 10), { width: cw - 4 });
          doc.fillColor('#000');
        });
        if (dayEvents.length > 2) {
          doc.fontSize(5).fillColor('#999').text(`+${dayEvents.length - 2} more`, cx + 2, cy + ch - 10);
          doc.fillColor('#000');
        }

        doc.font('Helvetica');
        dayNum++;
      }
    }

    // legend
    const legendY = gridY + 6 * ch + 10;
    doc.fontSize(9).font('Helvetica').fillColor('#666');
    doc.text('Events are shown as blue labels. Use a weekly view for details.', MARGIN, legendY);
    doc.fillColor('#000');
  }
}

module.exports = GenerateTimetableTool;
