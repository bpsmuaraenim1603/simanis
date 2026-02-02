import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from './storage.service';

@Injectable()
export class TempDocCleanupService {
  private readonly logger = new Logger(TempDocCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Jalankan berkala. Aman karena operasi idempotent (file yang sudah hilang akan di-skip).
  @Cron('*/10 * * * *')
  async cleanupExpiredTempDocs() {
    const now = new Date();
    const batchSize = 200;

    const expired = await this.prisma.tempDoc.findMany({
      where: { expiresAt: { lte: now } },
      take: batchSize,
      orderBy: { expiresAt: 'asc' },
    });

    if (expired.length === 0) return;

    // group by bucket supaya delete lebih efisien
    const byBucket = new Map<string, string[]>();
    for (const row of expired) {
      if (!byBucket.has(row.bucket)) byBucket.set(row.bucket, []);
      byBucket.get(row.bucket)!.push(row.path);
    }

    for (const [bucket, paths] of byBucket.entries()) {
      try {
        await this.storage.removeMany(bucket, paths);
      } catch (e: any) {
        this.logger.warn(
          `Cleanup: gagal remove bucket=${bucket} paths=${paths.length}: ${e?.message || e}`,
        );
      }
    }

    await this.prisma.tempDoc.deleteMany({
      where: { id: { in: expired.map((x) => x.id) } },
    });

    this.logger.log(`Cleanup: terhapus ${expired.length} dokumen sementara`);
  }
}
