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
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices with filters and aggregates' })
  findAll(
    @CurrentWorkspace('id') workspaceId: string,
    @Query() query: QueryInvoicesDto,
  ) {
    return this.invoicesService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice with its activity timeline' })
  findOne(
    @CurrentWorkspace('id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.invoicesService.findOne(workspaceId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an invoice (draft or send)' })
  create(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(workspaceId, userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an invoice' })
  update(
    @CurrentWorkspace('id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an invoice' })
  remove(
    @CurrentWorkspace('id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.invoicesService.remove(workspaceId, id);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send an invoice to the client' })
  sendInvoice(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.invoicesService.send(workspaceId, userId, id, false);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend an invoice email' })
  resendInvoice(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.invoicesService.send(workspaceId, userId, id, true);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update invoice status (e.g. mark as paid)' })
  updateStatus(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.invoicesService.updateStatus(
      workspaceId,
      userId,
      id,
      dto.status,
    );
  }
}
