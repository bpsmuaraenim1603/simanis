import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import dayjs = require("dayjs");
import utc = require("dayjs/plugin/utc");
import timezone = require("dayjs/plugin/timezone");
import { PrismaService } from '../../../../prisma/prisma.service';
import { SubSurveyStatus } from '@prisma/client';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class SubSurveyStatusJob {
  private readonly logger = new Logger(SubSurveyStatusJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('10 0 * * *', { timeZone: "Asia/Jakarta" })
  async autoFinishSubSurvey() {
    const now = dayjs().tz('Asia/Jakarta');
    const startOfToday = now.startOf('day');

    const res = await this.prisma.subSurveyActivity.updateMany({
      where: {
        endDate: { lt: startOfToday.toDate() },
        status: { not: SubSurveyStatus.SELESAI },
      },
      data: { status: SubSurveyStatus.SELESAI },
    });

    this.logger.log(`Auto-finish updated=${res.count}`);
  }
}
