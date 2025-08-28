import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { GoogleDriveService } from './google-drive.service';

@Module({
  controllers: [FilesController],
  providers: [GoogleDriveService],
})
export class FilesModule {}
