import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

export interface InvoicePdfData {
  number: string;
  status: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string | null;
  fromName: string;
  fromEmail: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  taxPercent: number;
  tax: number;
  discount: number;
  grandTotal: number;
  notes?: string | null;
}

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.on('error', reject);

    doc.pipe(stream);

    doc.fontSize(22).text('INVOICE', { align: 'right' });
    doc.fontSize(12).text(data.number, { align: 'right' });
    doc.moveDown();

    doc.fontSize(10).fillColor('#666').text('FROM');
    doc.fillColor('#000').fontSize(11).text(data.fromName);
    doc.fontSize(10).text(data.fromEmail);
    doc.moveDown();

    doc.fontSize(10).fillColor('#666').text('BILL TO');
    doc.fillColor('#000').fontSize(11).text(data.clientName);
    doc.fontSize(10).text(data.clientEmail);
    if (data.clientAddress) {
      doc.text(data.clientAddress);
    }
    doc.moveDown();

    doc.fontSize(10).text(`Invoice date: ${formatDate(data.invoiceDate)}`);
    doc.text(`Due date: ${formatDate(data.dueDate)}`);
    doc.text(`Status: ${data.status}`);
    doc.moveDown();

    const tableTop = doc.y;
    doc.fontSize(10).fillColor('#666');
    doc.text('Description', 50, tableTop, { width: 250 });
    doc.text('Qty', 310, tableTop, { width: 40, align: 'right' });
    doc.text('Price', 360, tableTop, { width: 80, align: 'right' });
    doc.text('Total', 450, tableTop, { width: 80, align: 'right' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(530, doc.y).stroke('#ddd');
    doc.moveDown(0.5);

    doc.fillColor('#000');
    for (const item of data.lineItems) {
      const y = doc.y;
      doc.fontSize(10).text(item.description, 50, y, { width: 250 });
      doc.text(String(item.quantity), 310, y, { width: 40, align: 'right' });
      doc.text(formatMoney(item.unitPrice, data.currency), 360, y, {
        width: 80,
        align: 'right',
      });
      doc.text(formatMoney(item.total, data.currency), 450, y, {
        width: 80,
        align: 'right',
      });
      doc.moveDown();
    }

    doc.moveDown();
    const totalsX = 360;
    doc.text(`Subtotal: ${formatMoney(data.subtotal, data.currency)}`, totalsX, doc.y, {
      align: 'right',
      width: 170,
    });
    doc.text(
      `Tax (${data.taxPercent}%): ${formatMoney(data.tax, data.currency)}`,
      totalsX,
      doc.y,
      { align: 'right', width: 170 },
    );
    if (data.discount > 0) {
      doc.text(
        `Discount: -${formatMoney(data.discount, data.currency)}`,
        totalsX,
        doc.y,
        { align: 'right', width: 170 },
      );
    }
    doc.fontSize(12).text(
      `Total: ${formatMoney(data.grandTotal, data.currency)}`,
      totalsX,
      doc.y + 4,
      { align: 'right', width: 170 },
    );

    if (data.notes) {
      doc.moveDown(2);
      doc.fontSize(10).fillColor('#666').text('Notes');
      doc.fillColor('#000').text(data.notes);
    }

    doc.end();
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
