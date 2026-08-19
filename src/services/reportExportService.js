import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import * as portfolioReportService from './portfolioReportService.js';

/**
 * Turning a status report into something you can send: a workbook, a PDF, or
 * the text of an email.
 *
 * exceljs and pdfkit were already dependencies, so none of this adds one.
 */

const RAG_FILL = { green: 'FFD1E7DD', amber: 'FFFFF3CD', red: 'FFF8D7DA', grey: 'FFE9ECEF' };
const RAG_WORD = { green: 'On track', amber: 'Needs watching', red: 'Needs attention', grey: 'No data' };

function headerRow(sheet, values) {
  const row = sheet.addRow(values);
  row.font = { bold: true };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F5' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFADB5BD' } } };
  });
  return row;
}

function autoWidth(sheet, min = 10, max = 60) {
  sheet.columns.forEach(column => {
    let widest = min;
    column.eachCell({ includeEmpty: false }, cell => {
      widest = Math.max(widest, String(cell.value ?? '').length + 2);
    });
    column.width = Math.min(widest, max);
  });
}

/** A workbook: one sheet per section, so each can be filtered and pivoted. */
export async function buildWorkbook(contextId, { startDate, endDate } = {}) {
  const report = await portfolioReportService.getExecutiveSummary(contextId, { startDate, endDate });
  const book = new ExcelJS.Workbook();
  book.creator = 'MyWork';
  book.created = new Date();

  const summary = book.addWorksheet('Summary');
  summary.addRow(['Status report']).font = { bold: true, size: 16 };
  summary.addRow([`Period: ${startDate || '-'} to ${endDate || '-'}`]);
  summary.addRow([`Generated: ${new Date(report.generatedAt).toLocaleString()}`]);
  summary.addRow([]);
  const headline = summary.addRow(['Overall', RAG_WORD[report.headline.rag] || report.headline.rag]);
  headline.font = { bold: true };
  headline.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RAG_FILL[report.headline.rag] || RAG_FILL.grey } };
  summary.addRow(['Records tracked', report.headline.total]);
  summary.addRow(['Complete', report.headline.done]);
  summary.addRow(['Past their date', report.headline.overdue]);
  summary.addRow(['Finished this period', report.headline.completedInRange]);
  summary.addRow(['Time logged (hours)', Math.round((report.headline.minutesLogged / 60) * 10) / 10]);
  autoWidth(summary);

  const portfolio = book.addWorksheet('Portfolio');
  headerRow(portfolio, ['Type', 'Total', 'Complete', 'Not started', 'Past date', 'Finished this period', 'Status', 'Why']);
  for (const row of report.portfolio) {
    const added = portfolio.addRow([
      row.label, row.total, row.done, row.notStarted, row.overdue, row.completedInRange,
      RAG_WORD[row.rag] || row.rag, row.why,
    ]);
    added.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RAG_FILL[row.rag] || RAG_FILL.grey } };
  }
  autoWidth(portfolio);

  const done = book.addWorksheet('Accomplishments');
  headerRow(done, ['Date', 'What', 'Minutes', 'Projects', 'Categories', 'Goals']);
  for (const a of report.accomplishments) {
    done.addRow([a.date, a.title, a.minutes, a.projects.join(', '), a.categories.join(', '), a.goals.join(', ')]);
  }
  autoWidth(done);

  const next = book.addWorksheet('Upcoming');
  headerRow(next, ['Due', 'Type', 'What', 'Status']);
  for (const u of report.upcoming) next.addRow([u.due, u.type, u.title, u.status]);
  autoWidth(next);

  const attention = book.addWorksheet('Needs attention');
  headerRow(attention, ['Severity', 'Type', 'What', 'Status', 'Why it is here']);
  for (const n of report.needsAttention) attention.addRow([n.severity, n.type, n.title, n.status, n.reason]);
  autoWidth(attention);

  return book.xlsx.writeBuffer();
}

/**
 * A PDF of the same report, laid out to be read rather than parsed: headline
 * first, then what got done, then what needs a decision.
 */
export async function buildPdf(contextId, { startDate, endDate } = {}) {
  const report = await portfolioReportService.getExecutiveSummary(contextId, { startDate, endDate });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const RAG_RGB = { green: '#198754', amber: '#997404', red: '#b02a37', grey: '#6c757d' };

    doc.fontSize(20).fillColor('#212529').text('Status report');
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#6c757d')
       .text(`${startDate || '-'} to ${endDate || '-'}  ·  generated ${new Date(report.generatedAt).toLocaleString()}`);
    doc.moveDown(1);

    doc.fontSize(12).fillColor(RAG_RGB[report.headline.rag] || RAG_RGB.grey)
       .text(`Overall: ${RAG_WORD[report.headline.rag] || report.headline.rag}`);
    doc.fontSize(10).fillColor('#212529').text(
      `${report.headline.total} records tracked · ${report.headline.done} complete · ` +
      `${report.headline.completedInRange} finished this period · ${report.headline.overdue} past their date`
    );
    doc.moveDown(1);

    const section = (title) => {
      doc.moveDown(0.6);
      doc.fontSize(13).fillColor('#212529').text(title);
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#495057');
    };

    section('Portfolio');
    for (const row of report.portfolio) {
      doc.fillColor(RAG_RGB[row.rag] || RAG_RGB.grey).text('■ ', { continued: true });
      doc.fillColor('#495057').text(
        `${row.label}: ${row.done}/${row.total} complete` +
        `${row.overdue ? `, ${row.overdue} past date` : ''} — ${row.why}`
      );
    }

    section('What got done');
    if (report.accomplishments.length === 0) doc.text('Nothing recorded as complete in this period.');
    for (const a of report.accomplishments.slice(0, 25)) {
      doc.text(`• ${a.date} — ${a.title}${a.projects.length ? ` (${a.projects.join(', ')})` : ''}`);
    }

    section('Coming up');
    if (report.upcoming.length === 0) doc.text('Nothing dated in the next two weeks.');
    for (const u of report.upcoming.slice(0, 25)) doc.text(`• ${u.due} — ${u.title} (${u.type})`);

    section('Needs attention');
    if (report.needsAttention.length === 0) doc.text('Nothing overdue or stalled.');
    for (const n of report.needsAttention.slice(0, 25)) doc.text(`• ${n.title} (${n.type}) — ${n.reason}`);

    doc.end();
  });
}

/**
 * The text of an update to management. Written as prose a person would actually
 * send - the surveyed templates are consistent that this reads as outcomes and
 * decisions, not as a dump of every record.
 *
 * Returned as data rather than sent: the app has no mail credentials, and
 * silently sending on someone's behalf is not a thing to do by surprise. The UI
 * offers it for copying or hands it to the mail client.
 */
export async function buildEmailDraft(contextId, { startDate, endDate, audience = 'management' } = {}) {
  const report = await portfolioReportService.getExecutiveSummary(contextId, { startDate, endDate });
  const { headline } = report;

  const subject = `Status update: ${startDate || ''} to ${endDate || ''}` +
    (headline.rag === 'red' ? ' — needs attention' : '');

  const lines = [];
  lines.push(`Here is where things stand for ${startDate} to ${endDate}.`);
  lines.push('');
  lines.push(`Overall: ${RAG_WORD[headline.rag] || headline.rag}. ` +
    `${headline.completedInRange} item${headline.completedInRange === 1 ? '' : 's'} finished this period, ` +
    `${headline.done} of ${headline.total} tracked records are complete` +
    `${headline.overdue ? `, and ${headline.overdue} are past their date` : ''}.`);

  if (report.accomplishments.length) {
    lines.push('');
    lines.push('Completed this period:');
    for (const a of report.accomplishments.slice(0, 8)) {
      lines.push(`  • ${a.title}${a.projects.length ? ` (${a.projects.join(', ')})` : ''}`);
    }
    if (report.accomplishments.length > 8) lines.push(`  • …and ${report.accomplishments.length - 8} more`);
  }

  if (report.upcoming.length) {
    lines.push('');
    lines.push('Coming up:');
    for (const u of report.upcoming.slice(0, 6)) lines.push(`  • ${u.due} — ${u.title}`);
  }

  if (report.needsAttention.length) {
    lines.push('');
    lines.push('Needs a decision:');
    for (const n of report.needsAttention.slice(0, 6)) lines.push(`  • ${n.title} — ${n.reason}`);
  } else {
    lines.push('');
    lines.push('Nothing is blocked or overdue.');
  }

  lines.push('');
  lines.push('Full detail is attached / available on request.');

  const body = lines.join('\n');
  return {
    subject,
    body,
    audience,
    mailto: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    rag: headline.rag,
  };
}
