const PDFDocument = require('pdfkit');

const COLORS = {
  accent: '#e0353d',
  border: '#d9d9de',
  header: '#f1f1f3',
  muted: '#66666f',
  text: '#202024',
  white: '#ffffff',
};

function formatNumber(value, maximumFractionDigits = 2) {
  return Number(value).toLocaleString('de-DE', { maximumFractionDigits });
}

function formatMoney(value) {
  return Number(value).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
}

// Zellen, die Tabellenprogramme als Formel lesen würden (=, +, -, @, Tab, CR)
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCsv(value) {
  let text = value === undefined || value === null ? '' : String(value);
  // Formel-Injection verhindern; echte Zahlen (z.B. -1.5) bleiben unverändert
  if (typeof value !== 'number' && FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function sendCsv(res, filename, headers, rows) {
  const content = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(';'))
    .join('\r\n');

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.send(`\uFEFF${content}`);
}

function normalizeCell(cell) {
  if (cell && typeof cell === 'object') return cell;
  return { text: cell === undefined || cell === null ? '' : String(cell) };
}

function sendPdf(res, { filename, title, subtitle, summary, sections }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: title } });
  const contentX = doc.page.margins.left;
  const contentWidth = 495;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  doc.pipe(res);

  doc.fillColor(COLORS.accent).fontSize(22).font('Helvetica-Bold')
    .text(title, contentX, doc.y, { width: contentWidth });
  doc.moveDown(0.25).fillColor(COLORS.muted).fontSize(9).font('Helvetica')
    .text(subtitle, contentX, doc.y, { width: contentWidth });
  if (summary) {
    doc.moveDown(0.7).fillColor(COLORS.text).fontSize(12).font('Helvetica-Bold')
      .text(summary, contentX, doc.y, { width: contentWidth });
  }

  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const ensureSpace = (height, onNewPage) => {
    if (doc.y + height <= pageBottom()) return;
    doc.addPage();
    onNewPage?.();
  };

  sections.forEach((section) => {
    ensureSpace(70);
    doc.moveDown(1.2).fillColor(COLORS.text).fontSize(14).font('Helvetica-Bold')
      .text(section.title, contentX, doc.y, { width: contentWidth });
    doc.moveDown(0.35);

    const startX = contentX;
    const drawHeader = () => {
      const y = doc.y;
      doc.rect(startX, y, 495, 22).fill(COLORS.header);
      let x = startX;
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8);
      section.columns.forEach((column) => {
        doc.text(column.label, x + 4, y + 7, { width: column.width - 8, lineBreak: false });
        x += column.width;
      });
      doc.x = startX;
      doc.y = y + 22;
    };

    drawHeader();
    section.rows.forEach((rawRow) => {
      const cells = rawRow.map(normalizeCell);
      doc.font('Helvetica').fontSize(8);
      const rowHeight = Math.max(24, ...cells.map((cell, index) => (
        doc.heightOfString(String(cell.text), { width: section.columns[index].width - 8 }) + 10
      )));

      ensureSpace(rowHeight, drawHeader);
      const y = doc.y;
      let x = startX;
      doc.strokeColor(COLORS.border).moveTo(startX, y + rowHeight).lineTo(startX + 495, y + rowHeight).stroke();
      cells.forEach((cell, index) => {
        const options = { width: section.columns[index].width - 8 };
        if (cell.link) options.link = cell.link;
        doc.fillColor(cell.link ? COLORS.accent : COLORS.text)
          .font(cell.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(String(cell.text), x + 4, y + 7, options);
        x += section.columns[index].width;
      });
      doc.x = startX;
      doc.y = y + rowHeight;
    });
  });

  doc.moveDown(1.5).fillColor(COLORS.muted).fontSize(8).font('Helvetica')
    .text('Erstellt mit cablebuilder', contentX, doc.y, { width: contentWidth, align: 'right' });
  doc.end();
}

function configurationCsvRows(configurations) {
  return configurations.map((item) => [
    item.name,
    item.connector_a_name,
    item.connector_a_website || '',
    item.cable_name,
    item.cable_website || '',
    item.connector_b_name,
    item.connector_b_website || '',
    formatNumber(item.length_m),
    item.quantity,
    formatNumber(item.unit_price),
    formatNumber(item.total_price),
  ]);
}

function shoppingCsvRows(shoppingList) {
  return [
    ...shoppingList.cables.map((item) => [
      'Kabel', item.name, formatNumber(item.amount), 'm',
      formatNumber(item.unitPrice), formatNumber(item.totalPrice), item.website || '',
    ]),
    ...shoppingList.connectors.map((item) => [
      'Stecker', item.name, item.amount, 'Stück',
      formatNumber(item.unitPrice), formatNumber(item.totalPrice), item.website || '',
    ]),
  ];
}

function exportFilename(setName, date, extension) {
  const safeName = String(setName || 'konfiguration')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'konfiguration';
  return `kabelplanung-${safeName}-${date}.${extension}`;
}

function combinedCsv(res, configurations, shoppingList, date, setName) {
  sendCsv(res, exportFilename(setName, date, 'csv'), [`Konfiguration: ${setName || 'Ohne Namen'}`], [
    [],
    ['Konfigurationsliste'],
    [
      'Bezeichnung', 'Stecker A', 'Link Stecker A', 'Kabel', 'Link Kabel', 'Stecker B',
      'Link Stecker B', 'Länge je Kabel (m)', 'Menge', 'Preis je Kabel brutto (EUR)',
      'Gesamt brutto (EUR)',
    ],
    ...configurationCsvRows(configurations),
    [],
    ['Einkaufsliste'],
    ['Kategorie', 'Produkt', 'Benötigt', 'Einheit', 'Einzelpreis brutto (EUR)', 'Gesamt brutto (EUR)', 'Produktlink'],
    ...shoppingCsvRows(shoppingList),
  ]);
}

function combinedPdf(res, configurations, shoppingList, date, setName) {
  const shoppingColumns = [
    { label: 'Produkt', width: 165 },
    { label: 'Benötigt', width: 70 },
    { label: 'Einzelpreis', width: 75 },
    { label: 'Summe', width: 75 },
    { label: 'Produktlink', width: 110 },
  ];
  const shoppingRows = (items, unit) => items.map((item) => [
    { text: item.name, bold: true },
    `${formatNumber(item.amount)} ${unit}`,
    unit === 'm' ? `${formatMoney(item.unitPrice)}/m` : formatMoney(item.unitPrice),
    formatMoney(item.totalPrice),
    item.website ? { text: 'Produkt öffnen', link: item.website } : 'Kein Link',
  ]);
  const total = configurations.reduce((sum, item) => sum + item.total_price, 0);
  sendPdf(res, {
    filename: exportFilename(setName, date, 'pdf'),
    title: 'Kabelplanung',
    subtitle: `${setName || 'Ohne Namen'} · Stand ${new Date().toLocaleDateString('de-DE')} · ${configurations.length} ${configurations.length === 1 ? 'Kabelposition' : 'Kabelpositionen'}`,
    summary: `Konfigurationswert: ${formatMoney(total)} · Materialbedarf: ${formatMoney(shoppingList.totalPrice)}`,
    sections: [
      {
        title: 'Konfigurationsliste',
        columns: [
          { label: 'Bezeichnung', width: 105 },
          { label: 'Aufbau', width: 170 },
          { label: 'Länge', width: 55 },
          { label: 'Menge', width: 40 },
          { label: 'Einzel', width: 60 },
          { label: 'Gesamt', width: 65 },
        ],
        rows: configurations.map((item) => [
          { text: item.name, bold: true },
          `${item.connector_a_name} / ${item.cable_name} / ${item.connector_b_name}`,
          `${formatNumber(item.length_m)} m`,
          `${item.quantity}x`,
          formatMoney(item.unit_price),
          formatMoney(item.total_price),
        ]),
      },
      {
        title: 'Einkaufsliste · Kabel',
        columns: shoppingColumns,
        rows: shoppingRows(shoppingList.cables, 'm'),
      },
      {
        title: 'Einkaufsliste · Stecker',
        columns: shoppingColumns,
        rows: shoppingRows(shoppingList.connectors, 'Stück'),
      },
    ],
  });
}

module.exports = {
  combinedCsv,
  combinedPdf,
};
