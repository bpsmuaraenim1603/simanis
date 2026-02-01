import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from "path";

@Injectable()
export class GDriveService {
  private drive;

  constructor() {
    const raw = process.env.GDRIVE_SA_JSON_PATH!;
    const keyPath = path.isAbsolute(raw)
      ? raw
      : path.resolve(process.cwd(), raw);
    const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  async uploadBuffer(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    folderId?: string;
    makePublic?: boolean;
  }): Promise<{ fileId: string; viewUrl: string; downloadUrl: string }> {
    const folderId = params.folderId ?? process.env.GDRIVE_FOLDER_ID;
    if (!folderId) throw new Error('GDRIVE_FOLDER_ID belum diset');

    const res = await this.drive.files.create({
      requestBody: {
        name: params.fileName,
        parents: [folderId],
      },
      media: {
        mimeType: params.mimeType,
        body: this.bufferToStream(params.buffer),
      },
      fields: 'id',
    });

    const fileId = res.data.id;
    if (!fileId) throw new Error('Gagal upload file ke Google Drive');

    const makePublic =
      typeof params.makePublic === 'boolean'
        ? params.makePublic
        : process.env.GDRIVE_PUBLIC === 'true';

    if (makePublic) {
      await this.drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    }

    return {
      fileId,
      viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    };
  }

  private bufferToStream(buffer: Buffer) {
    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }
}
