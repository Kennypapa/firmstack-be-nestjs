import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Roles(
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
    WorkspaceMemberRole.MEMBER,
  )
  @ApiOperation({ summary: 'List expenses with filters and aggregates' })
  findAll(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentWorkspace('role') role: WorkspaceMemberRole,
    @CurrentUser('id') userId: string,
    @Query() query: QueryExpensesDto,
  ) {
    return this.expensesService.findAll(workspaceId, role, userId, query);
  }

  @Post()
  @Roles(
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
    WorkspaceMemberRole.MEMBER,
  )
  @ApiOperation({ summary: 'Add an expense' })
  create(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(workspaceId, userId, dto);
  }

  @Patch(':id')
  @Roles(
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
    WorkspaceMemberRole.MEMBER,
  )
  @ApiOperation({ summary: 'Update an expense' })
  update(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentWorkspace('role') role: WorkspaceMemberRole,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(workspaceId, role, userId, id, dto);
  }

  @Delete(':id')
  @Roles(
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
    WorkspaceMemberRole.MEMBER,
  )
  @ApiOperation({ summary: 'Delete an expense' })
  remove(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentWorkspace('role') role: WorkspaceMemberRole,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.remove(workspaceId, role, userId, id);
  }

  @Post(':id/approve')
  @Roles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  @ApiOperation({ summary: 'Approve an expense (admin only)' })
  approve(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.approve(workspaceId, userId, id);
  }
}
