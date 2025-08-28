import { Body, Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GoogleDriveService } from './google-drive.service';
import { Express } from 'express';

@Controller('uploads')
export class FilesController {
  constructor(private readonly drive: GoogleDriveService) {}

  @Post('spj-drive')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSpjDrive(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    if (!file) throw new BadRequestException('file is required');
    const { spjId, userId } = body || {};
    const safeName = (txt: string) => (txt || '').replace(/[^\w\-]+/g, '_').slice(0, 60);

    // Nama file rapi: <SPJID atau USERID>-<timestamp>-<asli>
    const name = `${safeName(spjId || userId || 'spj')}-${Date.now()}-${safeName(file.originalname)}`;

    // (Opsional) Validasi tipe & ukuran
    const MAX = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX) throw new BadRequestException('File terlalu besar (maks 20MB)');
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Tipe file tidak diizinkan');

    const created = await this.drive.uploadBuffer(file.buffer, name, file.mimetype);

    // Permission:
    // - Default: tetap restricted (hanya yang punya akses folder)
    // - Jika ingin bisa dilihat siapa saja yang punya link:
    // await this.drive.setReaderAnyone(created.id);

    return {
      provider: 'gdrive',
      fileId: created.id,
      name: created.name,
      webViewLink: created.webViewLink,     // untuk preview di Drive
      webContentLink: created.webContentLink, // untuk download
    };
  }
}
