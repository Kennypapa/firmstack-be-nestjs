import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  ExpenseStatus,
  Prisma,
  WorkspaceMemberRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';

const expenseInclude = {
  user: { select: { firstName: true, lastName: true, email: true } },
} satisfies Prisma.ExpenseInclude;

type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: typeof expenseInclude;
}>;

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, userId: string, dto: CreateExpenseDto) {
    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          workspaceId,
          userId,
          date: new Date(dto.date),
          category: dto.category,
          description: dto.description,
          amount: dto.amount,
          receiptUrl: dto.receiptUrl,
        },
        include: expenseInclude,
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: `Added expense: ${dto.description}`,
          type: ActivityType.EXPENSE,
        },
      });

      return created;
    });

    return this.toResponse(expense);
  }

  async findAll(
    workspaceId: string,
    role: WorkspaceMemberRole,
    userId: string,
    query: QueryExpensesDto,
  ) {
    const where: Prisma.ExpenseWhereInput = { workspaceId };

    if (role === WorkspaceMemberRole.MEMBER) {
      where.userId = userId;
    }

    if (query.search) {
      where.description = { contains: query.search, mode: 'insensitive' };
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.fromDate || query.toDate) {
      where.date = {};
      if (query.fromDate) where.date.gte = new Date(query.fromDate);
      if (query.toDate) where.date.lte = new Date(query.toDate);
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: { date: 'desc' },
    });

    const aggregates = await this.computeAggregates(where);

    return {
      data: expenses.map((expense) => this.toResponse(expense)),
      aggregates,
    };
  }

  async update(
    workspaceId: string,
    role: WorkspaceMemberRole,
    userId: string,
    id: string,
    dto: UpdateExpenseDto,
  ) {
    const existing = await this.findOwnedOrThrow(workspaceId, role, userId, id);

    const updated = await this.prisma.expense.update({
      where: { id: existing.id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        receiptUrl: dto.receiptUrl,
      },
      include: expenseInclude,
    });

    return this.toResponse(updated);
  }

  async remove(
    workspaceId: string,
    role: WorkspaceMemberRole,
    userId: string,
    id: string,
  ) {
    const existing = await this.findOwnedOrThrow(workspaceId, role, userId, id);
    await this.prisma.expense.delete({ where: { id: existing.id } });
    return { id, deleted: true };
  }

  async approve(workspaceId: string, userId: string, id: string) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    const expense = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: { status: ExpenseStatus.APPROVED },
        include: expenseInclude,
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: `Approved expense: ${existing.description}`,
          type: ActivityType.EXPENSE,
        },
      });

      return updated;
    });

    return this.toResponse(expense);
  }

  private async findOwnedOrThrow(
    workspaceId: string,
    role: WorkspaceMemberRole,
    userId: string,
    id: string,
  ) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    if (role === WorkspaceMemberRole.MEMBER && existing.userId !== userId) {
      throw new ForbiddenException('You can only manage your own expenses');
    }

    return existing;
  }

  private async computeAggregates(where: Prisma.ExpenseWhereInput) {
    const expenses = await this.prisma.expense.findMany({
      where,
      select: { amount: true, category: true, date: true, status: true },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalThisMonth = 0;
    let pendingReimbursements = 0;
    const byCategory = new Map<string, number>();

    for (const expense of expenses) {
      const amount = Number(expense.amount);

      if (expense.date >= monthStart) {
        totalThisMonth += amount;
      }

      if (expense.status === ExpenseStatus.PENDING) {
        pendingReimbursements += amount;
      }

      byCategory.set(
        expense.category,
        (byCategory.get(expense.category) ?? 0) + amount,
      );
    }

    let highestCategory: { category: string; amount: number } | null = null;
    for (const [category, amount] of byCategory.entries()) {
      if (!highestCategory || amount > highestCategory.amount) {
        highestCategory = { category, amount: this.round(amount) };
      }
    }

    return {
      totalThisMonth: this.round(totalThisMonth),
      highestCategory,
      pendingReimbursements: this.round(pendingReimbursements),
    };
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toResponse(expense: ExpenseWithRelations) {
    const addedBy =
      [expense.user.firstName, expense.user.lastName]
        .filter(Boolean)
        .join(' ') || expense.user.email;

    return {
      id: expense.id,
      date: expense.date.toISOString(),
      category: expense.category,
      description: expense.description,
      amount: Number(expense.amount),
      addedBy,
      status: expense.status,
      receiptUrl: expense.receiptUrl,
      createdAt: expense.createdAt.toISOString(),
    };
  }
}
