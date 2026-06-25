import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';

@ApiTags('Public')
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':token/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Download invoice PDF via public share link' })
  async downloadPdf(@Param('token') token: string) {
    const { buffer, filename } =
      await this.invoicesService.generatePublicPdf(token);

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get(':token')
  @ApiOperation({ summary: 'View an invoice via public share link' })
  view(@Param('token') token: string) {
    return this.invoicesService.findByPublicToken(token);
  }
}
