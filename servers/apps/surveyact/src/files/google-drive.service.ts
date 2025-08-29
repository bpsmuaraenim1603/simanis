// servers/apps/surveyact/src/files/google-drive.service.ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { Readable } from 'stream';

@Injectable()
export class GoogleDriveService {
  private jwt = new google.auth.JWT({
    email: process.env.GDRIVE_CLIENT_EMAIL,
    key: (process.env.GDRIVE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  private drive = google.drive({ version: 'v3', auth: this.jwt });
  private parentFolder = process.env.GDRIVE_SPJ_FOLDER_ID!; // ← folder di Shared Drive

  async uploadBuffer(file: Express.Multer.File, name: string) {
    const res = await this.drive.files.create({
      requestBody: {
        name,
        parents: [this.parentFolder],       // ← Shared Drive folder
        mimeType: file.mimetype,
      },
      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),   // ← stream, fix error .pipe
      },
      fields: 'id,name,webViewLink,webContentLink',
      supportsAllDrives: true,              // ← wajib utk Shared Drive
    });
    return res.data;
  }

  async setReaderAnyone(fileId: string) {
    await this.drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  }
}
