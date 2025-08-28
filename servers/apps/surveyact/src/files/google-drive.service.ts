import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';

@Injectable()
export class GoogleDriveService {
  private jwt = new google.auth.JWT({
    email: process.env.GDRIVE_CLIENT_EMAIL,
    key: (process.env.GDRIVE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  private drive = google.drive({ version: 'v3', auth: this.jwt });
  private parentFolder = process.env.GDRIVE_SPJ_FOLDER_ID!;

  async uploadBuffer(file: Buffer, name: string, mimeType: string) {
    // Upload sederhana (non-resumable) cocok untuk file kecil–menengah
    const res = await this.drive.files.create({
      requestBody: { name, parents: [this.parentFolder], mimeType },
      media: { mimeType, body: Buffer.from(file) as any },
      fields: 'id, name, webViewLink, webContentLink',
    });
    return res.data; // { id, name, webViewLink, ... }
  }

  async setReaderAnyone(fileId: string) {
    await this.drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  }

  async setDomainReader(fileId: string, domain: string) {
    await this.drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'domain', domain },
    });
  }
}
