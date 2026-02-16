import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import JSZip from 'jszip';
import { SurveyActivityService } from './surveyacts.service';

type MonthlyStaffZipBody = {
  userId: string;
  month: number;
  year: number;
  ppkId: string;
  ppkName: string;
  ppkNip: string;
  nomorSPK: string;
  nomorBAST: string;
  docDate: string | Date;
  rows: Array<{
    subSurveyActivityId: string;
    totalDocs: number;
    unitCost: number;
    totalCost: number;
    budgetCode?: string;
  }>;
};

@Controller('surveyact/docs')
export class SurveyactDocsController {
  constructor(private readonly service: SurveyActivityService) {}

  /**
   * Download SPK + BAST dalam 1 file ZIP, tanpa menyimpan ke storage.
   */
  @Post('monthly-staff/zip')
  async downloadMonthlyStaffZip(
    @Body() body: MonthlyStaffZipBody,
    @Res() res: Response,
  ) {
    const docDate = body.docDate instanceof Date ? body.docDate : new Date(body.docDate);

    const built = await this.service.generateMonthlyStaffDocsBuffers({
      userId: body.userId,
      month: Number(body.month),
      year: Number(body.year),
      ppkId: String(body.ppkId || ''),
      ppkName: String(body.ppkName || ''),
      ppkNip: String(body.ppkNip || ''),
      nomorSPK: String(body.nomorSPK || ''),
      nomorBAST: String(body.nomorBAST || ''),
      docDate,
      rows: Array.isArray(body.rows) ? body.rows : [],
    });

    const zip = new JSZip();
    zip.file(built.spkFileName, built.spkBuffer);
    zip.file(built.bastFileName, built.bastBuffer);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    const mm = String(body.month).padStart(2, '0');
    const zipName = `SPK-BAST-${mm}-${body.year}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.send(zipBuffer);
  }
}
