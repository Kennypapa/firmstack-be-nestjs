import { Injectable } from '@nestjs/common';
import { ActivityType, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(workspaceId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [invoices, expenses] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { workspaceId },
        select: {
          status: true,
          grandTotal: true,
          invoiceDate: true,
          dueDate: true,
        },
      }),
      this.prisma.expense.findMany({
        where: { workspaceId },
        select: { amount: true, date: true },
      }),
    ]);

    const revenue = { current: 0, previous: 0, total: 0 };
    let totalInvoices = 0;
    let pendingInvoices = 0;

    for (const invoice of invoices) {
      totalInvoices += 1;
      const amount = Number(invoice.grandTotal);

      if (
        invoice.status === InvoiceStatus.PENDING &&
        invoice.dueDate >= now
      ) {
        pendingInvoices += 1;
      } else if (invoice.status === InvoiceStatus.PENDING) {
        pendingInvoices += 1;
      }

      if (invoice.status === InvoiceStatus.PAID) {
        revenue.total += amount;
        if (invoice.invoiceDate >= monthStart) revenue.current += amount;
        else if (invoice.invoiceDate >= prevMonthStart)
          revenue.previous += amount;
      }
    }

    const expenseTotals = { current: 0, previous: 0, total: 0 };
    for (const expense of expenses) {
      const amount = Number(expense.amount);
      expenseTotals.total += amount;
      if (expense.date >= monthStart) expenseTotals.current += amount;
      else if (expense.date >= prevMonthStart) expenseTotals.previous += amount;
    }

    const netProfit = revenue.total - expenseTotals.total;
    const netCurrent = revenue.current - expenseTotals.current;
    const netPrevious = revenue.previous - expenseTotals.previous;

    return {
      totalRevenue: this.round(revenue.total),
      totalRevenueChange: this.percentChange(revenue.current, revenue.previous),
      totalExpenses: this.round(expenseTotals.total),
      totalExpensesChange: this.percentChange(
        expenseTotals.current,
        expenseTotals.previous,
      ),
      netProfit: this.round(netProfit),
      netProfitChange: this.percentChange(netCurrent, netPrevious),
      totalInvoices,
      pendingInvoices,
    };
  }

  async charts(workspaceId: string, period: string) {
    const months = period === '12m' ? 12 : period === '3m' ? 3 : 6;
    const now = new Date();
    const buckets: {
      name: string;
      start: Date;
      end: Date;
      revenue: number;
      expenses: number;
    }[] = [];

    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({
        name: start.toLocaleString('en-US', { month: 'short' }),
        start,
        end,
        revenue: 0,
        expenses: 0,
      });
    }

    const rangeStart = buckets[0].start;

    const [invoices, expenses] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          workspaceId,
          status: InvoiceStatus.PAID,
          invoiceDate: { gte: rangeStart },
        },
        select: { grandTotal: true, invoiceDate: true },
      }),
      this.prisma.expense.findMany({
        where: { workspaceId, date: { gte: rangeStart } },
        select: { amount: true, date: true },
      }),
    ]);

    for (const invoice of invoices) {
      const bucket = buckets.find(
        (b) => invoice.invoiceDate >= b.start && invoice.invoiceDate < b.end,
      );
      if (bucket) bucket.revenue += Number(invoice.grandTotal);
    }

    for (const expense of expenses) {
      const bucket = buckets.find(
        (b) => expense.date >= b.start && expense.date < b.end,
      );
      if (bucket) bucket.expenses += Number(expense.amount);
    }

    return {
      revenueVsExpenses: buckets.map((b) => ({
        name: b.name,
        revenue: this.round(b.revenue),
        expenses: this.round(b.expenses),
      })),
      profitTrend: buckets.map((b) => ({
        name: b.name,
        profit: this.round(b.revenue - b.expenses),
      })),
    };
  }

  async activity(workspaceId: string, limit: number) {
    const logs = await this.prisma.activityLog.findMany({
      where: { workspaceId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      user: log.user
        ? [log.user.firstName, log.user.lastName].filter(Boolean).join(' ') ||
          log.user.email
        : 'System',
      action: log.action,
      time: log.createdAt.toISOString(),
      type: this.toType(log.type),
    }));
  }

  private toType(type: ActivityType) {
    return type.toLowerCase();
  }

  private percentChange(current: number, previous: number) {
    if (previous === 0) {
      return current === 0 ? '0%' : '+100%';
    }
    const change = ((current - previous) / Math.abs(previous)) * 100;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
