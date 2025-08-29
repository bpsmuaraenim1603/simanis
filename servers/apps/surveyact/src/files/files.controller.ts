// servers/apps/surveyact/src/files/files.controller.ts
import { Body, Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { GoogleDriveService } from './google-drive.service';
import { Express } from 'express';

@Controller('uploads')
export class FilesController {
  constructor(private readonly drive: GoogleDriveService) {}

  @Post('spj-drive')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() })) // ⬅️ penting
  async uploadSpjDrive(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    if (!file) throw new BadRequestException('file is required');

    const spjId = (body?.spjId || 'spj').toString();
    const sanitize = (s: string) => s.replace(/[^\w\-]+/g, '_').slice(0, 60);
    const name = `${sanitize(spjId)}-${Date.now()}-${sanitize(file.originalname)}`;

    // (opsional) validasi
    if (file.size > 20 * 1024 * 1024) throw new BadRequestException('File terlalu besar (maks 20MB)');
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Tipe file tidak diizinkan');

    const created = await this.drive.uploadBuffer(file, name);

    // kalau ingin link publik:
    // await this.drive.setReaderAnyone(created.id);

    return {
      provider: 'gdrive',
      fileId: created.id,
      name: created.name,
      webViewLink: created.webViewLink,
      webContentLink: created.webContentLink,
    };
  }
}
