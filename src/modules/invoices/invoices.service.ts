import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import {
  InvoiceStatusFilter,
  QueryInvoicesDto,
} from './dto/query-invoices.dto';

const invoiceInclude = {
  lineItems: true,
  activity: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, userId: string, dto: CreateInvoiceDto) {
    const totals = this.computeTotals(
      dto.lineItems,
      dto.taxPercent ?? 0,
      dto.discount ?? 0,
    );
    const number = await this.nextInvoiceNumber(workspaceId);
    const send = dto.send === true;

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          workspaceId,
          number,
          status: send ? InvoiceStatus.PENDING : InvoiceStatus.DRAFT,
          clientName: dto.client.name,
          clientEmail: dto.client.email,
          clientAddress: dto.client.address,
          fromName: dto.from.name,
          fromEmail: dto.from.email,
          invoiceDate: new Date(dto.invoiceDate),
          dueDate: new Date(dto.dueDate),
          currency: dto.currency,
          subtotal: totals.subtotal,
          taxPercent: dto.taxPercent ?? 0,
          tax: totals.tax,
          discount: dto.discount ?? 0,
          grandTotal: totals.grandTotal,
          notes: dto.notes,
          lineItems: {
            create: dto.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: this.round(item.quantity * item.unitPrice),
            })),
          },
          activity: {
            create: [
              { action: 'Invoice created', done: true },
              ...(send
                ? [{ action: 'Invoice sent to client', done: true }]
                : []),
            ],
          },
        },
        include: invoiceInclude,
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: `${send ? 'Sent' : 'Created'} invoice ${number}`,
          type: ActivityType.INVOICE,
        },
      });

      return created;
    });

    return this.toResponse(invoice);
  }

  async findAll(workspaceId: string, query: QueryInvoicesDto) {
    const now = new Date();
    const where: Prisma.InvoiceWhereInput = { workspaceId };
    const dueDate: Prisma.DateTimeFilter = {};

    if (query.search) {
      where.OR = [
        { clientName: { contains: query.search, mode: 'insensitive' } },
        { number: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.fromDate) dueDate.gte = new Date(query.fromDate);
    if (query.toDate) dueDate.lte = new Date(query.toDate);

    if (query.status && query.status !== InvoiceStatusFilter.All) {
      switch (query.status) {
        case InvoiceStatusFilter.Paid:
          where.status = InvoiceStatus.PAID;
          break;
        case InvoiceStatusFilter.Draft:
          where.status = InvoiceStatus.DRAFT;
          break;
        case InvoiceStatusFilter.Pending:
          where.status = InvoiceStatus.PENDING;
          dueDate.gte = now;
          break;
        case InvoiceStatusFilter.Overdue:
          where.status = InvoiceStatus.PENDING;
          dueDate.lt = now;
          break;
      }
    }

    if (Object.keys(dueDate).length > 0) {
      where.dueDate = dueDate;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });

    const aggregates = await this.computeAggregates(workspaceId, now);

    return {
      data: invoices.map((invoice) => this.toResponse(invoice)),
      aggregates,
    };
  }

  async findOne(workspaceId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, workspaceId },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return this.toResponse(invoice);
  }

  async update(workspaceId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, workspaceId },
      include: { lineItems: true },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    const lineItems = dto.lineItems;
    const taxPercent =
      dto.taxPercent ?? Number(existing.taxPercent);
    const discount = dto.discount ?? Number(existing.discount);

    const totals = lineItems
      ? this.computeTotals(lineItems, taxPercent, discount)
      : this.computeTotals(
          existing.lineItems.map((item) => ({
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
          taxPercent,
          discount,
        );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (lineItems) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          clientName: dto.client?.name,
          clientEmail: dto.client?.email,
          clientAddress: dto.client?.address,
          fromName: dto.from?.name,
          fromEmail: dto.from?.email,
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          currency: dto.currency,
          notes: dto.notes,
          taxPercent,
          discount,
          subtotal: totals.subtotal,
          tax: totals.tax,
          grandTotal: totals.grandTotal,
          ...(lineItems
            ? {
                lineItems: {
                  create: lineItems.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: this.round(item.quantity * item.unitPrice),
                  })),
                },
              }
            : {}),
        },
        include: invoiceInclude,
      });
    });

    return this.toResponse(updated);
  }

  async remove(workspaceId: string, id: string) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    await this.prisma.invoice.delete({ where: { id } });

    return { id, deleted: true };
  }

  async send(workspaceId: string, userId: string, id: string, resend = false) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status:
            existing.status === InvoiceStatus.DRAFT
              ? InvoiceStatus.PENDING
              : existing.status,
          activity: {
            create: {
              action: resend
                ? 'Invoice resent to client'
                : 'Invoice sent to client',
              done: true,
            },
          },
        },
        include: invoiceInclude,
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: `${resend ? 'Resent' : 'Sent'} invoice ${existing.number}`,
          type: ActivityType.INVOICE,
        },
      });

      return updated;
    });

    return this.toResponse(invoice);
  }

  async updateStatus(
    workspaceId: string,
    userId: string,
    id: string,
    status: InvoiceStatus,
  ) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status,
          activity:
            status === InvoiceStatus.PAID
              ? { create: { action: 'Payment received', done: true } }
              : undefined,
        },
        include: invoiceInclude,
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: `Marked invoice ${existing.number} as ${status.toLowerCase()}`,
          type:
            status === InvoiceStatus.PAID
              ? ActivityType.PAYMENT
              : ActivityType.INVOICE,
        },
      });

      return updated;
    });

    return this.toResponse(invoice);
  }

  private async computeAggregates(workspaceId: string, now: Date) {
    const invoices = await this.prisma.invoice.findMany({
      where: { workspaceId },
      select: { status: true, dueDate: true, grandTotal: true },
    });

    let totalInvoiced = 0;
    let paid = 0;
    let pending = 0;
    let overdue = 0;

    for (const invoice of invoices) {
      const amount = Number(invoice.grandTotal);

      if (invoice.status !== InvoiceStatus.DRAFT) {
        totalInvoiced += amount;
      }

      if (invoice.status === InvoiceStatus.PAID) {
        paid += amount;
      } else if (invoice.status === InvoiceStatus.PENDING) {
        if (invoice.dueDate < now) {
          overdue += amount;
        } else {
          pending += amount;
        }
      }
    }

    return {
      totalInvoiced: this.round(totalInvoiced),
      paid: this.round(paid),
      pending: this.round(pending),
      overdue: this.round(overdue),
    };
  }

  private async nextInvoiceNumber(workspaceId: string) {
    const count = await this.prisma.invoice.count({ where: { workspaceId } });
    return `INV-${String(count + 1).padStart(3, '0')}`;
  }

  private computeTotals(
    lineItems: { quantity: number; unitPrice: number }[],
    taxPercent: number,
    discount: number,
  ) {
    const subtotal = this.round(
      lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      ),
    );
    const tax = this.round((subtotal * taxPercent) / 100);
    const grandTotal = this.round(subtotal + tax - discount);

    return { subtotal, tax, grandTotal };
  }

  private effectiveStatus(invoice: InvoiceWithRelations): InvoiceStatus {
    if (
      invoice.status === InvoiceStatus.PENDING &&
      invoice.dueDate < new Date()
    ) {
      return InvoiceStatus.OVERDUE;
    }
    return invoice.status;
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toResponse(invoice: InvoiceWithRelations) {
    return {
      id: invoice.id,
      number: invoice.number,
      status: this.effectiveStatus(invoice),
      client: {
        name: invoice.clientName,
        email: invoice.clientEmail,
        address: invoice.clientAddress,
      },
      from: {
        name: invoice.fromName,
        email: invoice.fromEmail,
      },
      invoiceDate: invoice.invoiceDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      currency: invoice.currency,
      lineItems: invoice.lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      subtotal: Number(invoice.subtotal),
      taxPercent: Number(invoice.taxPercent),
      tax: Number(invoice.tax),
      discount: Number(invoice.discount),
      grandTotal: Number(invoice.grandTotal),
      notes: invoice.notes,
      activity: invoice.activity.map((entry) => ({
        action: entry.action,
        time: entry.createdAt.toISOString(),
        done: entry.done,
      })),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }
}
