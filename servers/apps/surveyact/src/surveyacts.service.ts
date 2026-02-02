import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateContentIssueDto,
  CreateDistrictDTO,
  createIssueCommentDto,
  CreateJobLetterDTO,
  CreateSPJDTO,
  CreateSubSurveyActivityDTO,
  CreateSurveyActivityDTO,
  CreateUserProgressDTO,
  CreateVillageDTO,
  PatchUserSamplesDTO,
  UpdateContentIssueDto,
  updateIssueCommentDto,
  UpdateJobLetterStatusDTO,
  UpdateSPJStatusDTO,
  UpdateSubSurveyActivityDTO,
  UpdateSurveyActivityDTO,
  UpdateUserProgressDTO,
} from './dto/surveyact.dto';
import {
  AgreeState,
  CacahStatus,
  Channel,
  NotificationType,
  TargetType,
  IssueStatus,
  JobLetter,
  SubmitSPJ,
  User,
} from '@prisma/client';
import { HttpService } from '@nestjs/axios';
import { identity, lastValueFrom } from 'rxjs';
import {
  SubSurveyActivityType,
  SubSurveyProgressType,
} from './types/surveyact.types';
import { FileUpload } from 'graphql-upload-ts';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { StorageService } from './storage.service';
import * as XLSX from 'xlsx';
import * as JSZip from 'jszip';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DocxMerger = require('docx-merger');
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  PageBreak,
} from 'docx';
import { console } from 'node:inspector';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function getExtLower(name?: string | null) {
  if (!name) return '';
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}
function pickContentType(ext: string, mime?: string | null) {
  const m = (mime || '').toLowerCase();
  if (m && m !== 'application/octet-stream') return m;
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    default:
      return 'image/jpeg';
  }
}

function isAllowedImage(ext: string, mime?: string | null) {
  const allowedExt = new Set(['.jpg', '.jpeg', '.png']);
  const allowedMime = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/octet-stream',
  ]);
  const m = (mime || '').toLowerCase();
  return allowedExt.has(ext) || allowedMime.has(m);
}

@Injectable()
export class SurveyActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly storage: StorageService,
  ) {}

  private canAccessAll(actor: any) {
    const role = actor?.primaryRole;
    return role === 'Superadmin' || role === 'Keuangan';
  }

  private monthNameId(month: number) {
    const m = Number(month);
    const names = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    return names[m - 1] ?? '';
  }

  private dayNameId(date: Date) {
    const d = new Date(date);
    const names = [
      'Minggu',
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu',
    ];
    return names[d.getDay()];
  }

  private formatDateId(date: Date) {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  private formatNumberID(n: number) {
    const v = Number(n);
    const safe = Number.isFinite(v) ? v : 0;
    // Dokumen honor umumnya bilangan bulat.
    return new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: 0,
    }).format(Math.round(safe));
  }

  private terbilang(n: number): string {
    const satuan = [
      '',
      'Satu',
      'Dua',
      'Tiga',
      'Empat',
      'Lima',
      'Enam',
      'Tujuh',
      'Delapan',
      'Sembilan',
      'Sepuluh',
      'Sebelas',
    ];

    if (n < 12) return satuan[n];
    if (n < 20) return this.terbilang(n - 10) + ' Belas';
    if (n < 100)
      return (
        this.terbilang(Math.floor(n / 10)) +
        ' Puluh ' +
        this.terbilang(n % 10)
      ).trim();
    if (n < 200) return 'Seratus ' + this.terbilang(n - 100);
    if (n < 1000)
      return (
        this.terbilang(Math.floor(n / 100)) +
        ' Ratus ' +
        this.terbilang(n % 100)
      ).trim();
    if (n < 2000) return 'Seribu ' + this.terbilang(n - 1000);
    if (n < 1_000_000)
      return (
        this.terbilang(Math.floor(n / 1000)) +
        ' Ribu ' +
        this.terbilang(n % 1000)
      ).trim();

    return '';
  }

  private async enrichActor(actor: any) {
    const actorId = actor?.id;
    if (!actorId) return null;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, primaryRole: true },
    });

    return {
      ...actor,
      ...dbUser,
    };
  }

  private async createInAppNotification(input: {
    recipientId: string;
    actorId?: string | null;
    type: NotificationType;
    targetType: TargetType;
    targetId: string;
    title: string;
    body?: string | null;
    metadata?: any;
    dedupKey?: string;
  }) {
    if (input.dedupKey) {
      const exists = await this.prisma.notification.findFirst({
        where: {
          recipientId: input.recipientId,
          type: input.type,
          targetType: input.targetType,
          targetId: input.targetId,
          channel: Channel.IN_APP,
          metadata: {
            path: ['dedupKey'],
            equals: input.dedupKey,
          },
        },
        select: { id: true },
      });
      if (exists) return;
    }

    await this.prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        title: input.title,
        body: input.body ?? null,
        metadata: input.dedupKey
          ? { ...(input.metadata ?? {}), dedupKey: input.dedupKey }
          : (input.metadata ?? undefined),
        channel: Channel.IN_APP,
      },
    });
  }

  async create(input: CreateSurveyActivityDTO) {
    return this.prisma.surveyActivity.create({ data: input });
  }

  async update(surveyActivityId: string, updateData: UpdateSurveyActivityDTO) {
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value != null),
    );

    return this.prisma.surveyActivity.update({
      where: { id: surveyActivityId },
      data: cleanedData,
    });
  }

  async findBySlug(slug: string) {
    const survey = await this.prisma.surveyActivity.findUnique({
      where: { slug },
    });
    if (!survey) throw new NotFoundException('SurveyActivity not found');
    return survey;
  }

  async findAll(actor: any) {
    actor = await this.enrichActor(actor);
    const actorId = actor?.id;
    if (!actorId) return [];

    if (this.canAccessAll(actor)) {
      return this.prisma.surveyActivity.findMany();
    }

    return this.prisma.surveyActivity.findMany({
      where: {
        OR: [
          { chiefId: actorId },
          {
            SubSurveyActivity: {
              some: {
                UserProgress: {
                  some: { userId: actorId },
                },
              },
            },
          },
        ],
      },
    });
  }

  async createSubSurveyActivity(input: CreateSubSurveyActivityDTO) {
    return this.prisma.subSurveyActivity.create({
      data: input,
    });
  }

  async updateSubSurveyActivity(
    subSurveyActivityId: string,
    updateData: UpdateSubSurveyActivityDTO,
  ) {
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value != null),
    );
    return this.prisma.subSurveyActivity.update({
      where: { id: subSurveyActivityId },
      data: cleanedData,
    });
  }

  async findSubSurveyActivityBySlug(slug: string) {
    const subSurveyActivity = await this.prisma.subSurveyActivity.findUnique({
      where: { slug },
    });
    if (!subSurveyActivity)
      throw new NotFoundException('SubSurveyActivity not found');
    return subSurveyActivity;
  }

  async findSubSurveyActivityTypeBySurveyActivityId(
    surveyActivityId: string,
    actor: any,
  ) {
    actor = await this.enrichActor(actor);
    const actorId = actor?.id;
    if (!actorId) return [];

    if (this.canAccessAll(actor)) {
      return this.prisma.subSurveyActivity.findMany({
        where: { surveyActivityId },
      });
    }

    const team = await this.prisma.surveyActivity.findUnique({
      where: { id: surveyActivityId },
      select: { chiefId: true },
    });

    const isChief = team?.chiefId === actorId;

    if (isChief) {
      return this.prisma.subSurveyActivity.findMany({
        where: { surveyActivityId },
      });
    }

    return this.prisma.subSurveyActivity.findMany({
      where: {
        surveyActivityId,
        UserProgress: { some: { userId: actorId } },
      },
    });
  }

  async findAllSubSurveyActivity() {
    return this.prisma.subSurveyActivity.findMany();
  }

  async getSubSurvey(
    subSurveyActivityId: string,
  ): Promise<SubSurveyActivityType | null> {
    return this.prisma.subSurveyActivity.findUnique({
      where: { id: subSurveyActivityId },
    });
  }

  private async ensureSupervisorProgress(params: {
    subSurveyActivityId?: string | null;
    superVisorId?: string | null;
    districtId?: string | null;
    blockCount?: string | null;
    villageId?: string | null;
  }) {
    const subSurveyActivityId = params.subSurveyActivityId ?? null;
    const superVisorId = params.superVisorId ?? null;
    const districtId = params.districtId ?? null;
    const blockCount = params.blockCount ?? null;
    const villageId = params.villageId ?? null;
    if (!subSurveyActivityId || !superVisorId) return;

    const exists = await this.prisma.userProgress.findFirst({
      where: {
        userId: superVisorId,
        subSurveyActivityId,
        progressRole: 'PENGAWAS',
      },
      select: { id: true },
    });
    if (exists) return;

    await this.prisma.userProgress.create({
      data: {
        userId: superVisorId,
        subSurveyActivityId,
        progressRole: 'PENGAWAS',
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        blockCount: blockCount ?? null,
        districtId: districtId ?? null,
        villageId: villageId ?? null,
        travelBill: '0',
        superVisorId: null,
      },
    });
  }

  async createUserSurveyProgress(
    input: CreateUserProgressDTO,
    actorId?: string,
  ) {
    const { samples, ...rest } = input;
    let totalAssigned = rest.totalAssigned ?? 0;
    let submitCount = rest.submitCount ?? 0;
    let approvedCount = rest.approvedCount ?? 0;
    let rejectedCount = rest.rejectedCount ?? 0;

    if (samples && samples.length > 0) {
      totalAssigned = samples.length;
      submitCount = samples.filter(
        (s) => s.cacahStatus === CacahStatus.Selesai,
      ).length;
      approvedCount = samples.filter(
        (s) => s.approvalStatus === AgreeState.Disetujui,
      ).length;
      rejectedCount = samples.filter(
        (s) => s.approvalStatus === AgreeState.Ditolak,
      ).length;
    }

    const created = await this.prisma.userProgress.create({
      data: {
        ...rest,
        totalAssigned,
        submitCount,
        approvedCount,
        rejectedCount,
        samples: samples
          ? {
              create: samples,
            }
          : undefined,
        progressRole: 'PETUGAS',
      },
      include: {
        samples: true,
      },
    });

    await this.ensureSupervisorProgress({
      superVisorId: created.superVisorId,
      subSurveyActivityId: created.subSurveyActivityId,
      districtId: created.districtId,
      blockCount: created.blockCount,
      villageId: created.villageId,
    });

    const [sub, user, supervisor] = await Promise.all([
      created.subSurveyActivityId
        ? this.prisma.subSurveyActivity.findUnique({
            where: { id: created.subSurveyActivityId },
            select: { name: true },
          })
        : Promise.resolve(null),
      this.prisma.user.findUnique({
        where: { id: created.userId },
        select: { name: true },
      }),
      created.superVisorId
        ? this.prisma.user.findUnique({
            where: { id: created.superVisorId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

    await this.createInAppNotification({
      recipientId: created.userId,
      actorId: actorId ?? null,
      type: NotificationType.USER_PROGRESS_ASSIGNED,
      targetType: TargetType.USER_PROGRESS,
      targetId: created.id,
      title: 'Kamu ditugaskan ke kegiatan survei',
      body: sub?.name
        ? `Kamu ditugaskan pada kegiatan "${sub.name}".`
        : 'Kamu ditugaskan pada kegiatan survei baru.',
    });

    if (created.superVisorId) {
      await this.createInAppNotification({
        recipientId: created.superVisorId,
        actorId: actorId ?? null,
        type: NotificationType.SUPERVISOR_ASSIGNED,
        targetType: TargetType.USER_PROGRESS,
        targetId: created.id,
        title: 'Kamu ditetapkan sebagai pengawas',
        body: sub?.name
          ? `Kamu ditugaskan menjadi pengawas untuk ${user?.name ?? 'petugas'} di "${sub.name}".`
          : `Kamu ditugaskan menjadi pengawas untuk ${user?.name ?? 'petugas'}.`,
        metadata: {
          petugasId: created.userId,
          subSurveyActivityId: created.subSurveyActivityId,
        },
      });
    }

    if (created.samples?.length) {
      await this.createInAppNotification({
        recipientId: created.userId,
        actorId: actorId ?? null,
        type: NotificationType.USER_SAMPLES_ASSIGNED,
        targetType: TargetType.USER_PROGRESS,
        targetId: created.id,
        title: 'Sampel ditambahkan',
        body: `Ada ${created.samples.length} sampel baru untuk kamu kerjakan.`,
        metadata: {
          count: created.samples.length,
          subSurveyActivityId: created.subSurveyActivityId,
        },
      });
    }

    return created;
  }

  async getSamplesByUserProgressId(userProgressId: string) {
    return this.prisma.userSample.findMany({
      where: { userProgressId },
    });
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getSubSurveyProgress(subSurveyActivityId: string) {
    const subSurvey = await this.prisma.subSurveyActivity.findUnique({
      where: { id: subSurveyActivityId },
      include: {
        UserProgress: true,
      },
    });

    if (!subSurvey) {
      throw new NotFoundException('SubSurveyActivity tidak ditemukan');
    }

    const totalPetugas = subSurvey.UserProgress.length;
    const submitCount = subSurvey.UserProgress.reduce(
      (acc, p) => acc + p.submitCount,
      0,
    );
    const approvedCount = subSurvey.UserProgress.reduce(
      (acc, p) => acc + p.approvedCount,
      0,
    );
    const rejectedCount = subSurvey.UserProgress.reduce(
      (acc, p) => acc + p.rejectedCount,
      0,
    );

    return {
      startDate: subSurvey.startDate,
      endDate: subSurvey.endDate,
      targetSample: subSurvey.targetSample,
      sampleType: subSurvey.sampleType,
      activityType: subSurvey.activityType,
      totalPetugas,
      submitCount,
      approvedCount,
      rejectedCount,
    };
  }

  async getUserProgressBySubSurveyActivityId(subSurveyActivityId: string) {
    return this.prisma.userProgress.findMany({
      where: { subSurveyActivityId, superVisorId: { not: null } },
      include: {
        user: true,
        subSurveyActivity: true,
        district: true,
        village: true,
        supervisor: true,
        samples: true,
      },
    });
  }

  async getUserProgressSurveyByUserId(userId: string) {
    return this.prisma.userProgress.findMany({
      where: { userId, superVisorId: { not: null } },
      include: {
        user: true,
        subSurveyActivity: true,
        district: true,
        village: true,
        supervisor: true,
        samples: true,
      },
    });
  }

  async getAllUserSurveyProgress() {
    return this.prisma.userProgress.findMany({
      where: { superVisorId: { not: null } },
      include: {
        user: true,
        subSurveyActivity: true,
        district: true,
        village: true,
        supervisor: true,
      },
    });
  }

  async getAllUserSurveyProgressBySVID(superVisorId: string) {
    return this.prisma.userProgress.findMany({
      where: { superVisorId },
      include: {
        user: true,
        subSurveyActivity: true,
        district: true,
        village: true,
        supervisor: true,
      },
    });
  }

  async updateUserProgress(input: UpdateUserProgressDTO, actorId?: string) {
    const { id, samples, deleteSampleIds, ...rest } = input;

    return this.prisma.$transaction(async (tx) => {
      const upBefore = await tx.userProgress.findUnique({
        where: { id },
        select: { id: true, userId: true, subSurveyActivityId: true },
      });
      if (!upBefore)
        throw new NotFoundException('UserProgress tidak ditemukan');

      await tx.userProgress.update({
        where: { id },
        data: { ...rest },
      });

      const existing = await tx.userSample.findMany({
        where: { userProgressId: id },
        select: {
          id: true,
          nus: true,
          photoPath: true,
          cacahStatus: true,
          approvalStatus: true,
        },
      });

      const existingByNus = new Map(existing.map((s) => [s.nus, s]));
      let createdCount = 0;

      if (samples) {
        const nusSet = new Set<string>();
        for (const s of samples) {
          if (!s?.nus || String(s.nus).trim() === '') {
            throw new BadRequestException('NUS tidak boleh kosong.');
          }
          if (nusSet.has(s.nus)) {
            throw new BadRequestException(`Duplikat NUS di payload: ${s.nus}`);
          }
          nusSet.add(s.nus);
        }

        for (const s of samples) {
          const prev = existingByNus.get(s.nus);

          if (prev) {
            await tx.userSample.update({
              where: { id: prev.id },
              data: {
                identity: s.identity,
                cacahStatus: s.cacahStatus,
                approvalStatus: s.approvalStatus,
                geoLat: s.geoLat ?? null,
                geoLng: s.geoLng ?? null,
                geoCapturedAt: s.geoCapturedAt ?? null,
              },
            });
          } else {
            await tx.userSample.create({
              data: {
                userProgressId: id,
                nus: s.nus,
                identity: s.identity,
                cacahStatus: s.cacahStatus,
                approvalStatus: s.approvalStatus,
                geoLat: s.geoLat ?? null,
                geoLng: s.geoLng ?? null,
                geoCapturedAt: s.geoCapturedAt ?? null,
              },
            });
            createdCount++;
          }
        }

        const incomingNus = new Set(samples.map((s) => s.nus));
        const toDelete = existing.filter((e) => !incomingNus.has(e.nus));

        if (toDelete.length) {
          await tx.userSample.deleteMany({
            where: { id: { in: toDelete.map((x) => x.id) } },
          });
          await this.storage.removeSampleFiles(
            toDelete.map((x) => x.photoPath),
          );
        }
      }

      if (deleteSampleIds?.length) {
        const willDelete = await tx.userSample.findMany({
          where: { userProgressId: id, id: { in: deleteSampleIds } },
          select: { id: true, photoPath: true },
        });

        await tx.userSample.deleteMany({
          where: { userProgressId: id, id: { in: deleteSampleIds } },
        });

        await this.storage.removeSampleFiles(
          willDelete.map((x) => x.photoPath),
        );
      }

      const all = await tx.userSample.findMany({
        where: { userProgressId: id },
      });

      await tx.userProgress.update({
        where: { id },
        data: {
          totalAssigned: all.length,
          submitCount: all.filter((s) => s.cacahStatus === CacahStatus.Selesai)
            .length,
          approvedCount: all.filter(
            (s) => s.approvalStatus === AgreeState.Disetujui,
          ).length,
          rejectedCount: all.filter(
            (s) => s.approvalStatus === AgreeState.Ditolak,
          ).length,
        },
      });

      const result = await tx.userProgress.findUnique({
        where: { id },
        include: { samples: true },
      });
      if (createdCount > 0) {
        const sub = upBefore.subSurveyActivityId
          ? await tx.subSurveyActivity.findUnique({
              where: { id: upBefore.subSurveyActivityId },
              select: { name: true },
            })
          : null;

        await tx.notification.create({
          data: {
            recipientId: upBefore.userId,
            actorId: actorId ?? null,
            type: NotificationType.USER_SAMPLES_ASSIGNED,
            targetType: TargetType.USER_PROGRESS,
            targetId: upBefore.id,
            title: 'Sampel ditambahkan',
            body: sub?.name
              ? `Ada ${createdCount} sampel baru untuk kegiatan "${sub.name}".`
              : `Ada ${createdCount} sampel baru untuk kamu kerjakan.`,
            metadata: { count: createdCount },
            channel: Channel.IN_APP,
          },
        });
      }

      return result;
    });
  }

  async patchUserSamples(input: PatchUserSamplesDTO, actorId?: string) {
    const { userProgressId, updateSamples, createSamples, deleteSampleIds } =
      input;

    return this.prisma.$transaction(async (tx) => {
      if (updateSamples?.length) {
        for (const s of updateSamples) {
          let oldPhotoPath: string | null = null;
          if (s.photoPath !== undefined) {
            const prev = await tx.userSample.findUnique({
              where: { id: s.id },
              select: { photoPath: true },
            });
            oldPhotoPath = prev?.photoPath ?? null;
          }
          await tx.userSample.update({
            where: { id: s.id },
            data: {
              ...(s.cacahStatus && { cacahStatus: s.cacahStatus }),
              ...(s.approvalStatus && { approvalStatus: s.approvalStatus }),
              ...(s.geoLat !== undefined && { geoLat: s.geoLat }),
              ...(s.geoLng !== undefined && { geoLng: s.geoLng }),
              ...(s.geoCapturedAt && { geoCapturedAt: s.geoCapturedAt }),
              ...(s.identity !== undefined && { identity: s.identity }),
              ...(s.photoPath !== undefined && { photoPath: s.photoPath }),
              ...(s.photoCapturedAt !== undefined && {
                photoCapturedAt: s.photoCapturedAt,
              }),
            },
          });
          if (
            s.photoPath !== undefined &&
            oldPhotoPath &&
            s.photoPath &&
            oldPhotoPath !== s.photoPath
          ) {
            await this.storage.removeSampleFiles([oldPhotoPath]);
          }
        }
      }

      if (createSamples?.length) {
        await tx.userSample.createMany({
          data: createSamples.map((s) => ({
            userProgressId,
            nus: s.nus,
            identity: s.identity,
            cacahStatus: s.cacahStatus,
            approvalStatus: s.approvalStatus,
            geoLat: s.geoLat ?? null,
            geoLng: s.geoLng ?? null,
            geoCapturedAt: s.geoCapturedAt ?? null,
          })),
        });

        const up = await tx.userProgress.findUnique({
          where: { id: userProgressId },
          select: { id: true, userId: true, subSurveyActivityId: true },
        });
        if (up) {
          const sub = up.subSurveyActivityId
            ? await tx.subSurveyActivity.findUnique({
                where: { id: up.subSurveyActivityId },
                select: { name: true },
              })
            : null;
          await tx.notification.create({
            data: {
              recipientId: up.userId,
              actorId: actorId ?? null,
              type: NotificationType.USER_SAMPLES_ASSIGNED,
              targetType: TargetType.USER_PROGRESS,
              targetId: up.id,
              title: 'Sampel ditambahkan',
              body: sub?.name
                ? `Ada ${createSamples.length} sampel baru untuk kegiatan "${sub.name}".`
                : `Ada ${createSamples.length} sampel baru untuk kamu kerjakan.`,
              metadata: { count: createSamples.length },
              channel: Channel.IN_APP,
            },
          });
        }
      }

      if (deleteSampleIds?.length) {
        const willDelete = await tx.userSample.findMany({
          where: { userProgressId, id: { in: deleteSampleIds } },
          select: { photoPath: true },
        });

        await tx.userSample.deleteMany({
          where: { userProgressId, id: { in: deleteSampleIds } },
        });

        await this.storage.removeSampleFiles(
          willDelete.map((x) => x.photoPath),
        );
      }

      const all = await tx.userSample.findMany({
        where: { userProgressId },
      });

      await tx.userProgress.update({
        where: { id: userProgressId },
        data: {
          totalAssigned: all.length,
          submitCount: all.filter((s) => s.cacahStatus === 'Selesai').length,
          approvedCount: all.filter((s) => s.approvalStatus === 'Disetujui')
            .length,
          rejectedCount: all.filter((s) => s.approvalStatus === 'Ditolak')
            .length,
        },
      });

      return tx.userProgress.findUnique({
        where: { id: userProgressId },
        include: { samples: true },
      });
    });
  }

  async createDistrict(input: CreateDistrictDTO) {
    return this.prisma.district.create({
      data: input,
    });
  }

  async getAllDistricts() {
    return this.prisma.district.findMany();
  }

  async createVillage(input: CreateVillageDTO) {
    return this.prisma.village.create({ data: input });
  }

  async getVillagesByDistrict(districtId: string) {
    return this.prisma.village.findMany({
      where: { districtId },
      orderBy: { name: 'asc' },
    });
  }

  async getAllVillages() {
    return this.prisma.village.findMany();
  }

  async createSPJ(input: CreateSPJDTO, file?: FileUpload): Promise<SubmitSPJ> {
    let eviDocumentPath: string | null = null;
    let eviOriginalName: string | null = null;
    let eviMimeType: string | null = null;
    let eviSize: number | null = null;

    if (file) {
      const { filename, mimetype, createReadStream } = file;

      const ext = getExtLower(filename);
      const allowedExt = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
      const allowedMime = new Set([
        'application/pdf',
        'application/x-pdf',
        'application/acrobat',
        'application/vnd.adobe.pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/octet-stream',
      ]);

      const mimeOk = allowedMime.has((mimetype || '').toLowerCase());
      const extOk = allowedExt.has(ext);
      console.log('[UPLOAD]', {
        filename: file?.filename,
        mimetype: file?.mimetype,
      });

      if (!extOk && !mimeOk) {
        throw new BadRequestException(
          'Tipe file tidak diizinkan. Hanya PDF/JPG/PNG.',
        );
      }

      const contentType = pickContentType(ext, mimetype);
      const key = `spj/${input.subSurveyActivityId}/${input.userId}/${randomUUID()}${ext}`;

      const stream = createReadStream();
      const { error } = await supabase.storage
        .from('spj-docs')
        .upload(key, stream, { contentType, duplex: 'half' as any });
      if (error)
        throw new BadRequestException(
          'Gagal upload ke Storage: ' + error.message,
        );

      eviDocumentPath = key;
      eviOriginalName = filename || null;
      eviMimeType = contentType;
    }

    try {
      return await this.prisma.submitSPJ.create({
        data: {
          userId: input.userId,
          subSurveyActivityId: input.subSurveyActivityId,
          verifyNote: input.verifyNote ?? undefined,
          eviDocumentPath: eviDocumentPath ?? undefined,
          eviOriginalName: eviOriginalName ?? undefined,
          eviMimeType: eviMimeType ?? undefined,
          eviSize: eviSize ?? undefined,
        },
      });
    } catch (dbErr) {
      if (eviDocumentPath) {
        await supabase.storage.from('spj-docs').remove([eviDocumentPath]);
      }
      throw dbErr;
    }
  }

  async getSPJSignedUrl(pathOrNull: string | null) {
    if (!pathOrNull) return null;
    const { data, error } = await supabase.storage
      .from('spj-docs')
      .createSignedUrl(pathOrNull, 60 * 60 * 6);
    if (error) return null;
    return data.signedUrl;
  }

  async getAllSPJ() {
    return this.prisma.submitSPJ.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true, subSurveyActivity: true },
    });
  }

  async updateSPJStatus(
    input: UpdateSPJStatusDTO,
    actorId?: string,
  ): Promise<SubmitSPJ> {
    const before = await this.prisma.submitSPJ.findUnique({
      where: { id: input.id },
      select: { id: true, userId: true, subSurveyActivityId: true },
    });
    if (!before) throw new NotFoundException('SubmitSPJ tidak ditemukan');

    const updated = await this.prisma.submitSPJ.update({
      where: { id: input.id },
      data: {
        submitState: input.status,
        verifyNote: input.verifyNote ?? undefined,
        approveDate: input.status === 'Disetujui' ? new Date() : undefined,
      },
    });
    const sub = await this.prisma.subSurveyActivity.findUnique({
      where: { id: before.subSurveyActivityId },
      select: { name: true },
    });

    if (input.status === AgreeState.Disetujui) {
      await this.createInAppNotification({
        recipientId: before.userId,
        actorId: actorId ?? null,
        type: NotificationType.SUBMIT_SPJ_APPROVED,
        targetType: TargetType.SUBMIT_SPJ,
        targetId: before.id,
        title: 'SPJ disetujui',
        body: sub?.name
          ? `SPJ kamu untuk kegiatan "${sub.name}" sudah disetujui.`
          : 'SPJ kamu sudah disetujui.',
      });
    }

    if (input.status === AgreeState.Ditolak) {
      await this.createInAppNotification({
        recipientId: before.userId,
        actorId: actorId ?? null,
        type: NotificationType.SUBMIT_SPJ_REJECTED,
        targetType: TargetType.SUBMIT_SPJ,
        targetId: before.id,
        title: 'SPJ ditolak',
        body: sub?.name
          ? `SPJ kamu untuk kegiatan "${sub.name}" ditolak. Catatan: ${input.verifyNote ?? '-'}`
          : `SPJ kamu ditolak. Catatan: ${input.verifyNote ?? '-'}`,
        metadata: { verifyNote: input.verifyNote ?? null },
      });
    }

    return updated;
  }

  async getJobLetterSignedUrl(path: string | null) {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from('jobletter-docs')
      .createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  async getSamplePhotoSignedUrl(path: string | null) {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from('sample-photos')
      .createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  async uploadUserSamplePhoto(sampleId: string, file: FileUpload) {
    if (!file) throw new BadRequestException('File wajib diisi');

    const sample = await this.prisma.userSample.findUnique({
      where: { id: sampleId },
      include: {
        userProgress: {
          select: { userId: true, subSurveyActivityId: true },
        },
      },
    });
    if (!sample) throw new NotFoundException('Sample tidak ditemukan');

    const { filename, mimetype, createReadStream } = file;
    const ext = getExtLower(filename);
    if (!isAllowedImage(ext, mimetype)) {
      throw new BadRequestException(
        'Tipe foto tidak diizinkan. Hanya JPG/PNG.',
      );
    }

    const bucket = process.env.SUPABASE_SAMPLE_BUCKET || 'sample-photos';

    const { data: b } = await supabase.storage.getBucket(bucket);
    if (!b) {
      throw new BadRequestException('Bucket belum tersedia: ' + bucket);
    }

    const key = `samples/${sample.userProgress.subSurveyActivityId}/${sample.userProgress.userId}/${sampleId}/${randomUUID()}${ext || '.jpg'}`;
    const stream = createReadStream();

    const contentType = pickContentType(ext, mimetype);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(key, stream, { contentType, duplex: 'half' as any });
    if (error) {
      throw new BadRequestException('Gagal upload foto: ' + error.message);
    }

    return key;
  }

  async createJobLetter(
    input: CreateJobLetterDTO,
    file?: FileUpload,
  ): Promise<JobLetter> {
    let eviLetterPath: string | null = null;
    let eviLetterOriginalName: string | null = null;
    let eviLetterMimeType: string | null = null;
    let eviLetterSize: number | null = null;

    if (file) {
      const { filename, mimetype, createReadStream } = file;

      const { data: b } = await supabase.storage.getBucket('jobletter-docs');
      if (!b)
        throw new BadRequestException(
          'Bucket belum tersedia: ' + 'jobletter-docs',
        );
      const ext = getExtLower(filename);
      const allowedExt = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
      const allowedMime = new Set([
        'application/pdf',
        'application/x-pdf',
        'application/acrobat',
        'application/vnd.adobe.pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/octet-stream',
      ]);
      if (
        !allowedExt.has(ext) &&
        !allowedMime.has((mimetype || '').toLowerCase())
      ) {
        throw new BadRequestException(
          'Tipe file tidak diizinkan. Hanya PDF/JPG/PNG.',
        );
      }

      const contentType = pickContentType(ext, mimetype);
      const key = `jobletter/${input.subSurveyActivityId}/${input.userId}/${randomUUID()}${ext}`;

      const stream = createReadStream();
      const { error } = await supabase.storage
        .from('jobletter-docs')
        .upload(key, stream, { contentType, duplex: 'half' as any });
      if (error)
        throw new BadRequestException(
          'Gagal upload ke Storage: ' + error.message,
        );

      eviLetterPath = key;
      eviLetterOriginalName = filename || null;
      eviLetterMimeType = contentType;
    }

    return this.prisma.jobLetter.create({
      data: {
        userId: input.userId,
        subSurveyActivityId: input.subSurveyActivityId,
        region: input.region,
        submitDate: input.submitDate,

        eviFieldUrl: input.eviFieldUrl ?? undefined,
        eviSTUrl: input.eviSTUrl ?? undefined,

        eviLetterPath: eviLetterPath ?? undefined,
        eviLetterOriginalName: eviLetterOriginalName ?? undefined,
        eviLetterMimeType: eviLetterMimeType ?? undefined,
        eviLetterSize: eviLetterSize ?? undefined,
      },
    });
  }

  async getAllJobLetters() {
    return this.prisma.jobLetter.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true, subSurveyActivity: true },
    });
  }

  async updateJobLetterStatus(
    input: UpdateJobLetterStatusDTO,
    actorId?: string,
  ): Promise<JobLetter> {
    const before = await this.prisma.jobLetter.findUnique({
      where: { id: input.id },
      select: { id: true, userId: true, subSurveyActivityId: true },
    });
    if (!before) throw new NotFoundException('Surat tugas tidak ditemukan');

    const updated = await this.prisma.jobLetter.update({
      where: { id: input.id },
      data: {
        agreeState: input.status,
        rejectNote: input.rejectNote ?? undefined,
        approveDate: input.status === 'Disetujui' ? new Date() : undefined,
      },
    });
    const sub = await this.prisma.subSurveyActivity.findUnique({
      where: { id: before.subSurveyActivityId },
      select: { name: true },
    });

    if (input.status === AgreeState.Disetujui) {
      await this.createInAppNotification({
        recipientId: before.userId,
        actorId: actorId ?? null,
        type: NotificationType.JOB_LETTER_APPROVED,
        targetType: TargetType.JOB_LETTER,
        targetId: before.id,
        title: 'Surat tugas disetujui',
        body: sub?.name
          ? `Surat tugas kamu untuk "${sub.name}" sudah disetujui.`
          : 'Surat tugas kamu sudah disetujui.',
      });
    }

    if (input.status === AgreeState.Ditolak) {
      await this.createInAppNotification({
        recipientId: before.userId,
        actorId: actorId ?? null,
        type: NotificationType.JOB_LETTER_REJECTED,
        targetType: TargetType.JOB_LETTER,
        targetId: before.id,
        title: 'Surat tugas ditolak',
        body: sub?.name
          ? `Surat tugas kamu untuk "${sub.name}" ditolak. Catatan: ${input.rejectNote ?? '-'}`
          : `Surat tugas kamu ditolak. Catatan: ${input.rejectNote ?? '-'}`,
        metadata: { rejectNote: input.rejectNote ?? null },
      });
    }

    return updated;
  }

  async getAllSubSurveyProgress(actor: any): Promise<SubSurveyProgressType[]> {
    actor = await this.enrichActor(actor);
    const actorId = actor?.id;
    if (!actorId) return [];

    const where = this.canAccessAll(actor)
      ? {}
      : {
          OR: [
            { surveyActivity: { chiefId: actorId } },
            { UserProgress: { some: { userId: actorId } } },
          ],
        };

    const subSurveys = await this.prisma.subSurveyActivity.findMany({
      where,
      include: { UserProgress: true },
      orderBy: { startDate: 'asc' },
    });

    const now = new Date();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    for (const s of subSurveys) {
      const diffDays = Math.ceil(
        (s.endDate.getTime() - now.getTime()) / MS_PER_DAY,
      );
      if (diffDays === 3 || diffDays === 2 || diffDays === 1) {
        const endKey = s.endDate.toISOString().slice(0, 10);
        for (const p of s.UserProgress) {
          await this.createInAppNotification({
            recipientId: p.userId,
            actorId: null,
            type: NotificationType.SUBSURVEY_END_SOON,
            targetType: TargetType.SUBSURVEY_ACTIVITY,
            targetId: s.id,
            title: 'Tenggat kegiatan mendekat',
            body: `Kegiatan "${s.name}" akan berakhir dalam ${diffDays} hari (tenggat: ${endKey}).`,
            dedupKey: `endsoon:${s.id}:${endKey}:${diffDays}`,
            metadata: { endDate: endKey, diffDays },
          });
        }
      }
    }

    return subSurveys.map((s) => {
      const totalPetugas = s.UserProgress.length;
      const submitCount = s.UserProgress.reduce(
        (a, p) => a + (p.submitCount ?? 0),
        0,
      );
      const approvedCount = s.UserProgress.reduce(
        (a, p) => a + (p.approvedCount ?? 0),
        0,
      );
      const rejectedCount = s.UserProgress.reduce(
        (a, p) => a + (p.rejectedCount ?? 0),
        0,
      );

      return {
        name: s.name,
        subSurveyActivityId: s.id,
        startDate: s.startDate,
        endDate: s.endDate,
        targetSample: s.targetSample ?? 0,
        sampleType: s.sampleType,
        activityType: s.activityType,
        totalPetugas,
        submitCount,
        approvedCount,
        rejectedCount,
        district: undefined,
      };
    });
  }

  async getMonthlySurveyStats(subSurveyActivityId?: string) {
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    let rangeStart = startOfMonth;
    let rangeEnd = endOfMonth;

    let activeSubSurveyActivityIds: string[] = [];

    if (subSurveyActivityId) {
      const sub = await this.prisma.subSurveyActivity.findUnique({
        where: { id: subSurveyActivityId },
        select: { id: true, startDate: true, endDate: true },
      });

      if (!sub?.startDate || !sub?.endDate) {
        throw new Error('startDate/endDate belum di-set untuk kegiatan ini');
      }

      const activityStart = new Date(sub.startDate);
      const activityEnd = new Date(sub.endDate);
      activityEnd.setHours(23, 59, 59, 999);

      rangeStart = activityStart > startOfMonth ? activityStart : startOfMonth;
      rangeEnd = activityEnd < endOfMonth ? activityEnd : endOfMonth;

      if (rangeStart > rangeEnd) {
        return {
          totalJobLetters: 0,
          totalSPJ: 0,
          totalActiveUsers: 0,
          activeUserIds: [],
          activeSubSurveyActivityIds: [],
        };
      }

      activeSubSurveyActivityIds = [sub.id];
    } else {
      const actives = await this.prisma.subSurveyActivity.findMany({
        where: {
          startDate: { lte: endOfMonth },
          endDate: { gte: startOfMonth },
        },
        select: { id: true },
      });
      activeSubSurveyActivityIds = actives.map((x) => x.id);
    }

    if (!activeSubSurveyActivityIds.length) {
      return {
        totalJobLetters: 0,
        totalSPJ: 0,
        totalActiveUsers: 0,
        activeUserIds: [],
        activeSubSurveyActivityIds: [],
      };
    }

    const activeUserIds = await this.prisma.userProgress
      .findMany({
        where: {
          subSurveyActivityId: { in: activeSubSurveyActivityIds },
        },
        distinct: ['userId'],
        select: { userId: true },
      })
      .then((res) => res.map((r) => r.userId));

    const [totalJobLetters, totalSPJ] = await Promise.all([
      this.prisma.jobLetter.count({
        where: {
          subSurveyActivityId: { in: activeSubSurveyActivityIds },
          createdAt: { gte: rangeStart, lte: rangeEnd },
        },
      }),

      this.prisma.submitSPJ.count({
        where: {
          subSurveyActivityId: { in: activeSubSurveyActivityIds },
          createdAt: { gte: rangeStart, lte: rangeEnd },
        },
      }),
    ]);

    return {
      totalJobLetters,
      totalSPJ,
      totalActiveUsers: activeUserIds.length,
      activeUserIds,
      activeSubSurveyActivityIds,
    };
  }

  async getMonthlyActivityStaffUsage(year: number, actor: any) {
    actor = await this.enrichActor(actor);
    const actorId = actor?.id;
    if (!actorId) return [];

    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31);
    to.setHours(23, 59, 59, 999);

    const canAccessAll = this.canAccessAll(actor);

    const accessWhere = canAccessAll
      ? {}
      : {
          OR: [
            { surveyActivity: { chiefId: actorId } },
            { UserProgress: { some: { userId: actorId } } },
          ],
        };

    const subs = await this.prisma.subSurveyActivity.findMany({
      where: {
        startDate: { gte: from, lte: to },
        ...accessWhere,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        startDate: true,
        endDate: true,
        surveyActivity: {
          select: { slug: true, chiefId: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    const pad2 = (n: number) => String(n).padStart(2, '0');

    const rows = await Promise.all(
      subs.map(async (s) => {
        const ups = await this.prisma.userProgress.findMany({
          where: { subSurveyActivityId: s.id },
          distinct: ['userId'],
          select: {
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });

        const month = `${s.startDate.getFullYear()}-${pad2(s.startDate.getMonth() + 1)}`;

        const staffUsers = ups.map((x) => x.user).filter(Boolean);

        return {
          month,
          subSurveyActivityId: s.id,
          subSurveyName: s.name ?? '-',
          subSurveySlug: s.slug,
          surveyActivitySlug: s.surveyActivity?.slug ?? '',
          startDate: s.startDate,
          endDate: s.endDate,
          staffCount: staffUsers.length,
          staffUsers,
        };
      }),
    );

    return rows;
  }

  async getStaffYearlyExport(year: number) {
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59, 999);

    const pad2 = (n: number) => String(n).padStart(2, '0');

    const ups = await this.prisma.userProgress.findMany({
      where: {
        subSurveyActivity: {
          startDate: { gte: from, lte: to },
        },
      },
      select: {
        userId: true,
        subSurveyActivityId: true,

        totalAssigned: true,
        submitCount: true,
        approvedCount: true,
        rejectedCount: true,
        blockCount: true,
        travelBill: true,

        user: {
          select: {
            name: true,
            limit_bill: true,
          },
        },
        district: {
          select: { name: true },
        },
        subSurveyActivity: {
          select: {
            id: true,
            name: true,
            activityType: true,
            startDate: true,
          },
        },
      },
      orderBy: [{ subSurveyActivity: { startDate: 'asc' } }],
    });

    return ups.map((r) => {
      const sd = r.subSurveyActivity?.startDate ?? null;

      const month =
        sd != null
          ? `${sd.getFullYear()}-${pad2(sd.getMonth() + 1)}`
          : `${year}-01`;

      return {
        userId: r.userId,
        userName: r.user?.name ?? '-',
        userLimitBill: r.user?.limit_bill ?? null,

        subSurveyActivityId: r.subSurveyActivityId,
        subSurveyName: r.subSurveyActivity?.name ?? '-',
        activityType: r.subSurveyActivity?.activityType ?? null,

        startDate: sd,
        month,

        districtName: r.district?.name ?? null,

        blockCount: r.blockCount ?? 0,
        totalAssigned: r.totalAssigned ?? 0,
        submitCount: r.submitCount ?? 0,
        approvedCount: r.approvedCount ?? 0,
        rejectedCount: r.rejectedCount ?? 0,

        travelBill: r.travelBill ?? 0,
      };
    });
  }

  async allDistricts() {
    return this.prisma.district.findMany();
  }

  async createContentIssue(input: CreateContentIssueDto) {
    return this.prisma.contentIssue.create({
      data: {
        content: input.content,
        reporterId: input.reporterId,
        subSurveyActivityId: input.subSurveyActivityId,
        issueStatus: input.issueStatus ?? IssueStatus.Waiting,
      },
      include: {
        reporter: true,
        subSurveyActivity: true,
        IssueComment: true,
      },
    });
  }

  async getContentIssueById(id: string) {
    const issue = await this.prisma.contentIssue.findUnique({
      where: { id },
      include: {
        reporter: true,
        subSurveyActivity: true,
        IssueComment: {
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!issue) throw new NotFoundException('ContentIssue not found');
    return issue;
  }

  async listContentIssues(params?: {
    subSurveyActivityId?: string;
    status?: IssueStatus;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const { subSurveyActivityId, status, search, skip, take } = params ?? {};
    return this.prisma.contentIssue.findMany({
      where: {
        subSurveyActivityId: subSurveyActivityId ?? undefined,
        issueStatus: status ?? undefined,
        ...(search
          ? {
              OR: [
                { content: { contains: search, mode: 'insensitive' } },
                {
                  reporter: {
                    is: { name: { contains: search, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      include: {
        reporter: true,
        subSurveyActivity: true,
        IssueComment: {
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { IssueComment: true } },
      },
    });
  }

  async updateContentIssue(input: UpdateContentIssueDto) {
    const cleaned = Object.fromEntries(
      Object.entries(input).filter(([k, v]) => k !== 'id' && v != null),
    );

    return this.prisma.contentIssue.update({
      where: { id: input.id },
      data: cleaned,
      include: {
        reporter: true,
        subSurveyActivity: true,
        _count: { select: { IssueComment: true } },
      },
    });
  }

  async addIssueComment(input: createIssueCommentDto) {
    await this.ensureIssueExists(input.contentId);

    const comment = await this.prisma.issueComment.create({
      data: {
        message: input.message,
        contentId: input.contentId,
        userId: input.userId,
        subSurveyActivityId: input.subSurveyActivityId,
      },
      include: { user: true, content: true, subSurveyActivity: true },
    });

    await this.prisma.contentIssue.update({
      where: { id: input.contentId },
      data: { updatedAt: new Date() },
    });

    return comment;
  }

  async updateIssueComment(input: updateIssueCommentDto) {
    await this.ensureCommentExists(input.id);
    return this.prisma.issueComment.update({
      where: { id: input.id },
      data: { message: input.message },
      include: { user: true, content: true, subSurveyActivity: true },
    });
  }

  async listIssueCommentsByContent(contentId: string) {
    return this.prisma.issueComment.findMany({
      where: { contentId },
      orderBy: { createdAt: 'asc' },
      include: { user: true, subSurveyActivity: true },
    });
  }

  private async ensureIssueExists(id: string) {
    const exists = await this.prisma.contentIssue.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('ContentIssue not found');
  }

  private async ensureCommentExists(id: string) {
    const exists = await this.prisma.issueComment.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('IssueComment not found');
  }

  async deleteSurveyActivity({ id }: { id: string }) {
    const team = await this.prisma.surveyActivity.findUnique({ where: { id } });
    if (!team)
      throw new NotFoundException('SurveyActivity (tim) tidak ditemukan');

    const subs = await this.prisma.subSurveyActivity.findMany({
      where: { surveyActivityId: id },
      select: { id: true },
    });
    const subIds = subs.map((s) => s.id);
    if (subIds.length > 0) {
      const [spjs, jls, samplePhotos] = await Promise.all([
        this.prisma.submitSPJ.findMany({
          where: { subSurveyActivityId: { in: subIds } },
          select: { eviDocumentPath: true },
        }),
        this.prisma.jobLetter.findMany({
          where: { subSurveyActivityId: { in: subIds } },
          select: {
            eviFieldUrl: true,
            eviSTUrl: true,
          } as any,
        }),
        this.prisma.userSample.findMany({
          where: { userProgress: { subSurveyActivityId: { in: subIds } } },
          select: { photoPath: true },
        }),
      ]);

      await Promise.all([
        this.storage.removeSpjFiles(spjs.map((x) => x.eviDocumentPath)),
        this.storage.removeJobLetterFiles(
          jls.flatMap((x: any) => [x.eviFieldUrl, x.eviSTUrl, x.eviLetterPath]),
        ),
        this.storage.removeSampleFiles(samplePhotos.map((x) => x.photoPath)),
      ]);
    }

    await this.prisma.$transaction([
      this.prisma.issueComment.deleteMany({
        where: { subSurveyActivityId: { in: subIds } },
      }),
      this.prisma.contentIssue.deleteMany({
        where: { subSurveyActivityId: { in: subIds } },
      }),
      this.prisma.jobLetter.deleteMany({
        where: { subSurveyActivityId: { in: subIds } },
      }),
      this.prisma.submitSPJ.deleteMany({
        where: { subSurveyActivityId: { in: subIds } },
      }),
      this.prisma.userProgress.deleteMany({
        where: { subSurveyActivityId: { in: subIds } },
      }),
      this.prisma.subSurveyActivity.deleteMany({
        where: { id: { in: subIds } },
      }),
      this.prisma.surveyActivity.delete({ where: { id } }),
    ]);

    return {
      success: true,
      message: 'Tim dan semua yang terkait sudah terhapus.',
    };
  }

  async deleteSubSurveyActivity({ id }: { id: string }) {
    const exists = await this.prisma.subSurveyActivity.findUnique({
      where: { id },
    });
    if (!exists)
      throw new NotFoundException('SubSurveyActivity tidak ditemukan');

    const [spjs, jls] = await Promise.all([
      this.prisma.submitSPJ.findMany({
        where: { subSurveyActivityId: id },
        select: { eviDocumentPath: true },
      }),
      this.prisma.jobLetter.findMany({
        where: { subSurveyActivityId: id },
        select: {
          eviFieldUrl: true,
          eviSTUrl: true,
        } as any,
      }),
    ]);
    const samplePhotos = await this.prisma.userSample.findMany({
      where: { userProgress: { subSurveyActivityId: id } },
      select: { photoPath: true },
    });

    await this.storage.removeSampleFiles(samplePhotos.map((x) => x.photoPath));

    await Promise.all([
      this.storage.removeSpjFiles(spjs.map((x) => x.eviDocumentPath)),
      this.storage.removeJobLetterFiles(
        jls.flatMap((x: any) => [x.eviFieldUrl, x.eviSTUrl]),
      ),
    ]);

    await this.prisma.$transaction([
      this.prisma.issueComment.deleteMany({
        where: { subSurveyActivityId: id },
      }),
      this.prisma.contentIssue.deleteMany({
        where: { subSurveyActivityId: id },
      }),
      this.prisma.jobLetter.deleteMany({ where: { subSurveyActivityId: id } }),
      this.prisma.submitSPJ.deleteMany({ where: { subSurveyActivityId: id } }),
      this.prisma.userProgress.deleteMany({
        where: { subSurveyActivityId: id },
      }),
      this.prisma.subSurveyActivity.delete({ where: { id } }),
    ]);

    return {
      success: true,
      message: 'Kegiatan survei semua yang terkait sudah terhapus.',
    };
  }

  async deleteUserSurveyProgress({ id }: { id: string }) {
    const up = await this.prisma.userProgress.findUnique({ where: { id } });
    if (!up) throw new NotFoundException('UserProgress tidak ditemukan');
    const samplePhotos = await this.prisma.userSample.findMany({
      where: { userProgressId: id },
      select: { photoPath: true },
    });
    await this.storage.removeSampleFiles(samplePhotos.map((x) => x.photoPath));
    await this.prisma.userProgress.delete({ where: { id } });
    return { success: true, message: 'Petugas sudah dihapus.' };
  }

  async deleteJobLetter({ id }: { id: string }) {
    const jl = await this.prisma.jobLetter.findUnique({ where: { id } });
    if (!jl) throw new NotFoundException('JobLetter tidak ditemukan');

    await this.storage.removeJobLetterFiles([
      (jl as any).eviLetterPath,
      jl.eviFieldUrl,
      jl.eviSTUrl,
    ]);

    await this.prisma.jobLetter.delete({ where: { id } });
    return { success: true, message: 'Surat Tugas dan file sudah terhapus.' };
  }

  async deleteSubmitSPJ({ id }: { id: string }) {
    const spj = await this.prisma.submitSPJ.findUnique({ where: { id } });
    if (!spj) throw new NotFoundException('SubmitSPJ tidak ditemukan');

    await this.storage.removeSpjFiles([spj.eviDocumentPath]);

    await this.prisma.submitSPJ.delete({ where: { id } });
    return {
      success: true,
      message: 'Pengajuan Honor dan file sudah terhapus.',
    };
  }

  async bulkImportUserProgressFromFile(fileBuffer: Buffer): Promise<{
    insertedPetugas: number;
    updatedPetugas: number;
    insertedPengawas: number;
    updatedPengawas: number;
    errors: { rowIndex: number; message: string }[];
  }> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // ============ BACA SHEET PETUGAS ============
    const petugasSheetName =
      workbook.SheetNames.find((n) => n === 'UPLOAD_PETUGAS') ??
      workbook.SheetNames[0];

    const sheetPetugas = workbook.Sheets[petugasSheetName];
    const petugasRows: any[] = XLSX.utils.sheet_to_json(sheetPetugas, {
      defval: '',
    });

    // ============ BACA SHEET SAMPEL (JIKA ADA) ============
    const sampleSheetName = workbook.SheetNames.find(
      (n) => n === 'UPLOAD_SAMPEL',
    );

    let sampleRows: any[] = [];
    if (sampleSheetName) {
      const sheetSamples = workbook.Sheets[sampleSheetName];
      sampleRows = XLSX.utils.sheet_to_json(sheetSamples, { defval: '' });
    }

    // Kelompokkan sampel per "No Petugas"
    const samplesByNoPetugas = new Map<
      string,
      {
        nus: string;
        identity: string;
        cacahStatus?: string;
        approvalStatus?: string;
        geoLat?: number | null;
        geoLng?: number | null;
      }[]
    >();

    for (const r of sampleRows) {
      const noPetugas = String(r['Nomor Petugas'] || '').trim();
      if (!noPetugas) continue;

      const nus = String(r['NUS'] || '').trim();
      const identity = String(r['Identitas Sampel'] || '').trim();
      const cacahStatus = String(r['Status Cacah'] || '').trim();
      const approvalStatus = String(r['Status Approval'] || '').trim();
      const geoLatRaw = String(r['GeoLat'] ?? '').trim();
      const geoLngRaw = String(r['GeoLng'] ?? '').trim();

      const geoLat = geoLatRaw ? Number(geoLatRaw) : null;
      const geoLng = geoLngRaw ? Number(geoLngRaw) : null;

      if (!samplesByNoPetugas.has(noPetugas)) {
        samplesByNoPetugas.set(noPetugas, []);
      }

      samplesByNoPetugas.get(noPetugas)!.push({
        nus,
        identity,
        cacahStatus,
        approvalStatus,
        geoLat: isNaN(geoLat as any) ? null : geoLat,
        geoLng: isNaN(geoLng as any) ? null : geoLng,
      });
    }

    // ============ COUNTER DAN ERROR ============

    let insertedPetugas = 0;
    let updatedPetugas = 0;
    let insertedPengawas = 0;
    let updatedPengawas = 0;
    const errors: { rowIndex: number; message: string }[] = [];

    const looksLikeFormula = (v: any) =>
      typeof v === 'string' && v.trim().startsWith('=');

    // ============ LOOP PER BARIS PETUGAS ============

    for (let i = 0; i < petugasRows.length; i++) {
      const r = petugasRows[i];
      const rowIndex = i + 2; // baris di Excel (header di baris 1)

      try {
        const noPetugas = String(r['Nomor Petugas'] || '').trim();
        const subSurveyActivityId = String(r['Id Kegiatan'] || '').trim();
        const userId = String(r['Id Petugas'] || '').trim();
        const superVisorId = String(r['Id Pengawas'] || '').trim() || null;

        if (!noPetugas) throw new Error('Nomor Petugas wajib.');
        if (!subSurveyActivityId) throw new Error('subSurveyActivityId wajib.');
        if (!userId) throw new Error('userId (petugas) wajib.');

        const districtId = String(r['Id Kecamatan'] || '').trim() || null;
        const villageId = String(r['Id Desa'] || '').trim() || null;
        const blockCount = String(r['Nama Blok'] || '').trim() || null;

        const travelBillPetugas =
          String(r['Honor Petugas'] || r.travelBill || '').trim() || '0';
        const travelBillPengawas =
          String(r['Honor Pengawas'] || '').trim() || '0';

        if (
          looksLikeFormula(subSurveyActivityId) ||
          looksLikeFormula(userId) ||
          looksLikeFormula(superVisorId) ||
          looksLikeFormula(districtId) ||
          looksLikeFormula(villageId)
        ) {
          throw new Error(
            'Ada kolom berisi formula Excel (=VLOOKUP...). Ubah jadi values dulu (copy → paste values) sebelum upload.',
          );
        }

        // Ambil daftar sampel untuk No Petugas ini (boleh kosong)
        const samplesForThisPetugas = samplesByNoPetugas.get(noPetugas) ?? [];

        // ============ TRANSAKSI PER PETUGAS ============

        const rowResult = await this.prisma.$transaction(async (tx) => {
          // Validasi referensi
          const subs = await tx.subSurveyActivity.findUnique({
            where: { id: subSurveyActivityId },
            select: { id: true },
          });
          if (!subs) {
            throw new Error(
              `subSurveyActivityId tidak ditemukan: ${subSurveyActivityId}`,
            );
          }

          const petugas = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true },
          });
          if (!petugas) {
            throw new Error(`userId petugas tidak ditemukan: ${userId}`);
          }

          if (superVisorId) {
            const sup = await tx.user.findUnique({
              where: { id: superVisorId },
              select: { id: true },
            });
            if (!sup) {
              throw new Error(`superVisorId tidak ditemukan: ${superVisorId}`);
            }
          }

          if (districtId) {
            const d = await tx.district.findUnique({
              where: { id: districtId },
              select: { id: true },
            });
            if (!d) {
              throw new Error(`districtId tidak ditemukan: ${districtId}`);
            }
          }

          if (villageId) {
            const v = await tx.village.findUnique({
              where: { id: villageId },
              select: { id: true, districtId: true },
            });
            if (!v) {
              throw new Error(`villageId tidak ditemukan: ${villageId}`);
            }
            if (districtId && v.districtId !== districtId) {
              throw new Error(
                'villageId tidak sesuai districtId (desa bukan turunan kecamatan).',
              );
            }
          }

          let petugasInserted = 0;
          let petugasUpdated = 0;
          let pengawasInserted = 0;
          let pengawasUpdated = 0;

          // Cek apakah sudah ada userProgress untuk PETUGAS ini
          const existingPetugas = await tx.userProgress.findFirst({
            where: {
              userId,
              subSurveyActivityId,
              progressRole: 'PETUGAS',
              blockCount,
            },
            select: { id: true },
          });

          let userProgressId: string;

          if (!existingPetugas) {
            const created = await tx.userProgress.create({
              data: {
                userId,
                subSurveyActivityId,
                progressRole: 'PETUGAS',
                superVisorId,
                districtId,
                villageId,
                blockCount,
                travelBill: travelBillPetugas,
                totalAssigned: 0,
                submitCount: 0,
                approvedCount: 0,
                rejectedCount: 0,
                samples:
                  samplesForThisPetugas.length > 0
                    ? {
                        create: samplesForThisPetugas.map((s, idx) => ({
                          nus:
                            s.nus && s.nus.trim()
                              ? s.nus.trim()
                              : String(idx + 1).padStart(3, '0'),
                          identity: s.identity ?? '',
                          cacahStatus: (s.cacahStatus ||
                            'Belum_Cacah') as CacahStatus,
                          approvalStatus: (s.approvalStatus ||
                            'Menunggu') as AgreeState,
                          geoLat: s.geoLat ?? null,
                          geoLng: s.geoLng ?? null,
                        })),
                      }
                    : undefined,
              },
              select: { id: true },
            });

            userProgressId = created.id;
            petugasInserted++;
          } else {
            userProgressId = existingPetugas.id;

            await tx.userProgress.update({
              where: { id: userProgressId },
              data: {
                superVisorId,
                districtId,
                villageId,
                blockCount,
                travelBill: travelBillPetugas,
              },
            });

            await tx.userSample.deleteMany({
              where: { userProgressId },
            });

            if (samplesForThisPetugas.length > 0) {
              await tx.userSample.createMany({
                data: samplesForThisPetugas.map((s, idx) => ({
                  userProgressId,
                  nus:
                    s.nus && s.nus.trim()
                      ? s.nus.trim()
                      : String(idx + 1).padStart(3, '0'),
                  identity: s.identity ?? '',
                  cacahStatus: (s.cacahStatus || 'Belum_Cacah') as CacahStatus,
                  approvalStatus: (s.approvalStatus ||
                    'Menunggu') as AgreeState,
                  geoLat: s.geoLat ?? null,
                  geoLng: s.geoLng ?? null,
                })),
              });
            }

            petugasUpdated++;
          }

          // ====== PENGAWAS (tanpa sampel) ======
          if (superVisorId) {
            const existingSup = await tx.userProgress.findFirst({
              where: {
                userId: superVisorId,
                subSurveyActivityId,
                progressRole: 'PENGAWAS',
                blockCount,
              },
              select: { id: true },
            });

            if (!existingSup) {
              await tx.userProgress.create({
                data: {
                  userId: superVisorId,
                  subSurveyActivityId,
                  progressRole: 'PENGAWAS',
                  superVisorId: null,
                  districtId,
                  villageId,
                  blockCount,
                  travelBill: travelBillPengawas,
                  totalAssigned: 0,
                  submitCount: 0,
                  approvedCount: 0,
                  rejectedCount: 0,
                },
              });
              pengawasInserted++;
            } else {
              await tx.userProgress.update({
                where: { id: existingSup.id },
                data: { travelBill: travelBillPengawas },
              });
              pengawasUpdated++;
            }
          }

          return {
            petugasInserted,
            petugasUpdated,
            pengawasInserted,
            pengawasUpdated,
          };
        });

        insertedPetugas += rowResult.petugasInserted;
        updatedPetugas += rowResult.petugasUpdated;
        insertedPengawas += rowResult.pengawasInserted;
        updatedPengawas += rowResult.pengawasUpdated;
      } catch (e: any) {
        errors.push({ rowIndex, message: e?.message ?? 'Row error' });
      }
    }

    return {
      insertedPetugas,
      updatedPetugas,
      insertedPengawas,
      updatedPengawas,
      errors,
    };
  }

  async exportUserSamplePhotos(
    userProgressId: string,
    actorId?: string,
  ): Promise<{ zipUrl: string; totalPhotos: number }> {
    // 1. Cek userProgress dan pemiliknya
    const up = await this.prisma.userProgress.findUnique({
      where: { id: userProgressId },
      select: {
        id: true,
        userId: true,
        subSurveyActivityId: true,
      },
    });

    if (!up) {
      throw new NotFoundException('UserProgress tidak ditemukan');
    }

    if (actorId && actorId !== up.userId) {
      throw new BadRequestException('Anda tidak berhak mengekspor sampel ini');
    }

    const samples = await this.prisma.userSample.findMany({
      where: {
        userProgressId,
        photoPath: { not: null },
      },
      select: {
        id: true,
        nus: true,
        identity: true,
        photoPath: true,
      },
    });

    if (!samples.length) {
      throw new NotFoundException('Tidak ada foto sampel yang bisa diekspor');
    }

    const bucket = process.env.SUPABASE_SAMPLE_BUCKET || 'sample-photos';

    const { data: b, error: bucketErr } =
      await supabase.storage.getBucket(bucket);
    if (!b || bucketErr) {
      throw new BadRequestException('Bucket belum tersedia: ' + bucket);
    }

    const zip = new JSZip();

    for (const s of samples) {
      if (!s.photoPath) continue;

      const { data, error } = await supabase.storage
        .from(bucket)
        .download(s.photoPath);

      if (error || !data) {
        continue;
      }

      const arrayBuf = await data.arrayBuffer();
      const buf = Buffer.from(arrayBuf);

      const safeNus = (s.nus || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const safeName = (s.identity || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const base = safeNus || s.id;
      const ext = getExtLower(s.photoPath) || '.jpg';

      const fileName = (safeName ? `${base}_${safeName}` : base) + ext;

      zip.file(fileName, buf);
    }

    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

    const exportKey = `exports/${up.subSurveyActivityId}/${up.userId}/photos_${Date.now()}.zip`;

    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(exportKey, zipContent, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadErr) {
      throw new BadRequestException(
        'Gagal upload file export: ' + uploadErr.message,
      );
    }

    const { data: signed, error: signedErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(exportKey, 60 * 60); // 1 jam

    if (signedErr || !signed?.signedUrl) {
      throw new BadRequestException('Gagal membuat signed URL export');
    }

    return {
      zipUrl: signed.signedUrl,
      totalPhotos: samples.length,
    };
  }

  private monthRange(month: number, year: number) {
    if (month < 1 || month > 12) {
      throw new BadRequestException('month harus 1-12');
    }
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  private parseMoney(v?: string | null): number {
    if (!v) return 0;
    const s = String(v)
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  async getMonthlyStaffDocPreview(userId: string, month: number, year: number) {
    const { from, to } = this.monthRange(month, year);

    const progresses = await this.prisma.userProgress.findMany({
      where: {
        userId,
        subSurveyActivity: {
          startDate: { lte: to },
          endDate: { gte: from },
        },
      },
      select: {
        id: true,
        subSurveyActivityId: true,
        travelBill: true,
        budgetCode: true,
        subSurveyActivity: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
        _count: { select: { samples: true } },
      },
    });

    const upIds = progresses.map((p) => p.id);
    const clipStart = (d: Date) => (d < from ? from : d);
    const clipEnd = (d: Date) => (d > to ? to : d);

    const lastSamples = await this.prisma.userSample.groupBy({
      by: ['userProgressId'],
      where: { userProgressId: { in: upIds } },
      _max: { updatedAt: true },
    });

    const lastByUp = new Map(
      lastSamples.map((x) => [x.userProgressId, x._max.updatedAt]),
    );

    const map = new Map<
      string,
      {
        subSurveyActivityId: string;
        activityName: string;
        startDate: Date;
        endDate: Date;
        totalDocs: number;
        totalHonor: number;
        budgetCode?: string | null;
      }
    >();

    for (const p of progresses) {
      const ssa = p.subSurveyActivity;
      if (!ssa?.id) continue;

      const key = ssa.id;
      const docs = p._count?.samples ?? 0;
      const honor = this.parseMoney(p.travelBill);
      const last = lastByUp.get(p.id);
      const effectiveEnd = last && ssa.endDate < last ? last : ssa.endDate;

      const startInMonth = clipStart(new Date(ssa.startDate));
      const endInMonth = clipEnd(new Date(effectiveEnd));

      if (endInMonth < from || startInMonth > to) continue;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          subSurveyActivityId: ssa.id,
          activityName: ssa.name,
          // simpan yang sudah dipotong sesuai bulan yang dipilih
          startDate: startInMonth,
          endDate: endInMonth,
          totalDocs: docs,
          totalHonor: honor,
          budgetCode: p.budgetCode ?? null,
        });
      } else {
        existing.totalDocs += docs;
        existing.totalHonor += honor;
        if (startInMonth < existing.startDate)
          existing.startDate = startInMonth;

        if (endInMonth > existing.endDate) existing.endDate = endInMonth;

        if (!existing.budgetCode && p.budgetCode)
          existing.budgetCode = p.budgetCode;
      }
    }

    const today = new Date();
    const rows = Array.from(map.values()).map((x) => {
      const eligible = x.endDate.getTime() <= today.getTime();
      const unitCost =
        x.totalDocs > 0 ? Number((x.totalHonor / x.totalDocs).toFixed(2)) : 0;

      return {
        ...x,
        eligible,
        unitCost,
      };
    });

    // urutkan biar enak dibaca: nama kegiatan A-Z
    rows.sort((a, b) => a.activityName.localeCompare(b.activityName));

    return rows;
  }

  private resolveTemplatePath(rel: string) {
    // dev: process.cwd() biasanya di servers/
    const candidates = [
      path.join(process.cwd(), 'apps', 'surveyact', 'templates', rel),
      path.join(
        process.cwd(),
        'servers',
        'apps',
        'surveyact',
        'templates',
        rel,
      ),
      path.join(__dirname, '..', 'templates', rel),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    throw new NotFoundException(`Template tidak ditemukan: ${rel}`);
  }

  private renderDocxTemplate(
    templateRelPath: string,
    data: Record<string, any>,
  ) {
    const p = this.resolveTemplatePath(templateRelPath);
    const content = fs.readFileSync(p);
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    doc.render(data);
    return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer;
  }

  private async sheetToDocxBuffer(sheet: XLSX.WorkSheet, title?: string) {
    // Paksa range hanya A:H agar kolom tidak jadi 50+
    const startRow = 0;
    const endRow = XLSX.utils.decode_range(sheet['!ref'] || 'A1:H1').e.r;

    const startCol = 0; // A
    const endCol = 7; // H

    const rows: TableRow[] = [];

    for (let r = startRow; r <= endRow; r++) {
      const cells: TableCell[] = [];
      let hasAny = false;

      for (let c = startCol; c <= endCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        const text = cell ? String(cell.v ?? '') : '';
        if (text.trim() !== '') hasAny = true;

        cells.push(
          new TableCell({
            children: [new Paragraph(text)],
          }),
        );
      }

      if (!hasAny) continue;
      rows.push(new TableRow({ children: cells }));
    }

    const doc = new Document({
      sections: [
        {
          children: [
            ...(title ? [new Paragraph({ text: title })] : []),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows,
            }),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private fillLampiranWorkbook(
    templateRelPath: string,
    rows: Array<{
      no: number;
      activityName: string;
      startDate: Date;
      endDate: Date;
      totalDocs: number;
      unitCost: number;
      totalCost: number;
      budgetCode?: string | null;
    }>,
    docType: 'SPK' | 'BAST',
  ) {
    const p = this.resolveTemplatePath(templateRelPath);
    const wb = XLSX.readFile(p);

    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    const startRow = 10;

    for (let i = 0; i < rows.length; i++) {
      const r = startRow + i;
      const item = rows[i];

      // Default mapping:
      // A: No
      // B: Uraian
      // C: Jangka waktu / Tanggal selesai
      // D: Volume
      // E: Satuan
      // F: Harga satuan (SPK)
      // G: Nilai (SPK)
      // H: Beban anggaran
      XLSX.utils.sheet_add_aoa(
        ws,
        [
          [
            item.no,
            item.activityName,
            docType === 'BAST'
              ? item.endDate.toISOString().slice(0, 10)
              : `${item.startDate.toISOString().slice(0, 10)} s.d. ${item.endDate.toISOString().slice(0, 10)}`,
            item.totalDocs,
            'Dokumen',
            docType === 'SPK' ? item.unitCost : '',
            docType === 'SPK' ? item.totalCost : '',
            item.budgetCode ?? '',
          ],
        ],
        { origin: { r, c: 0 } },
      );
    }

    return { wb, ws };
  }

  private async mergeDocxBuffers(buffers: Buffer[]) {
    return new Promise<Buffer>((resolve, reject) => {
      const merger = new DocxMerger({}, buffers);
      merger.save('nodebuffer', (data: Buffer) => resolve(data));
      merger.on('error', (err: any) => reject(err));
    });
  }

  private async uploadAdminDoc(buffer: Buffer, filename: string) {
    const bucket = process.env.SUPABASE_ADMIN_DOC_BUCKET || 'admin-docs';
    const objectPath = `${new Date().getFullYear()}/${randomUUID()}-${filename}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        upsert: true,
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    if (error) throw new BadRequestException(error.message);

    const signed = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 60 * 60 * 24);
    if (!signed?.data?.signedUrl)
      throw new BadRequestException('Gagal membuat signed url');
    return signed.data.signedUrl;
  }

  private getMonthlyStaffDocTtlHours() {
    // default: 24 jam (mirip mekanisme kode registrasi yang expired)
    const raw = process.env.MONTHLY_STAFF_DOC_TTL_HOURS;
    const n = Number(raw);
    if (!raw) return 24;
    if (Number.isFinite(n) && n > 0) return n;
    return 24;
  }

  private async uploadMonthlyStaffDoc(buffer: Buffer, filename: string) {
    const bucket =
      process.env.SUPABASE_MONTHLY_STAFF_DOC_BUCKET || 'monthly-staff-docs';
    const objectPath = `${new Date().getFullYear()}/${randomUUID()}-${filename}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        upsert: true,
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    if (error) throw new BadRequestException(error.message);

    const ttlHours = this.getMonthlyStaffDocTtlHours();
    const signed = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, Math.floor(ttlHours * 60 * 60));
    if (!signed?.data?.signedUrl)
      throw new BadRequestException('Gagal membuat signed url');

    return {
      signedUrl: signed.data.signedUrl,
      bucket,
      objectPath,
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    };
  }

  async generateMonthlyStaffDocs(input: {
    userId: string;
    month: number;
    year: number;
    ppkName: string;
    ppkNip: string;
    nomorSPK: string;
    nomorBAST: string;
    docDate: Date;
    pekerjaanPetugas?: string;
    desaTinggalPetugas?: string;
    rows: Array<{
      subSurveyActivityId: string;
      totalDocs: number;
      unitCost: number;
      totalCost: number;
      budgetCode?: string;
    }>;
  }) {
    const built = await this.generateMonthlyStaffDocsBuffers(input);

    // Upload ke Supabase Storage, lalu simpan TTL (expiresAt) ke DB agar file bisa ikut terhapus.
    let spk: Awaited<ReturnType<typeof this.uploadMonthlyStaffDoc>> | null =
      null;
    let bast: Awaited<ReturnType<typeof this.uploadMonthlyStaffDoc>> | null =
      null;

    try {
      [spk, bast] = await Promise.all([
        this.uploadMonthlyStaffDoc(built.spkBuffer, built.spkFileName),
        this.uploadMonthlyStaffDoc(built.bastBuffer, built.bastFileName),
      ]);

      await this.prisma.tempDoc.createMany({
        data: [
          {
            bucket: spk.bucket,
            path: spk.objectPath,
            kind: 'SPK',
            userId: input.userId,
            expiresAt: spk.expiresAt,
          },
          {
            bucket: bast.bucket,
            path: bast.objectPath,
            kind: 'BAST',
            userId: input.userId,
            expiresAt: bast.expiresAt,
          },
        ],
      });
    } catch (e) {
      // kalau salah satu upload gagal, hapus yang sempat terupload
      const bucket =
        process.env.SUPABASE_MONTHLY_STAFF_DOC_BUCKET || 'monthly-staff-docs';
      await this.storage.removeMany(bucket, [
        spk?.objectPath,
        bast?.objectPath,
      ]);
      throw e;
    }

    return {
      spkUrl: spk.signedUrl,
      bastUrl: bast.signedUrl,
      nomorSPK: built.nomorSPK,
      nomorBAST: built.nomorBAST,
      expiresAt: spk.expiresAt,
    };
  }

  async generateMonthlyStaffDocsBuffers(input: {
    userId: string;
    month: number;
    year: number;
    ppkName: string;
    ppkNip: string;
    nomorSPK: string;
    nomorBAST: string;
    docDate: Date;
    pekerjaanPetugas?: string;
    desaTinggalPetugas?: string;
    rows: Array<{
      subSurveyActivityId: string;
      totalDocs: number;
      unitCost: number;
      totalCost: number;
      budgetCode?: string;
    }>;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    const petugasName = user?.name || 'Petugas';
    const pekerjaanPetugas =
  String(input.pekerjaanPetugas ?? (user as any)?.job_name ?? '').trim();

const desaTinggalPetugas =
  String(input.desaTinggalPetugas ?? (user as any)?.village_name ?? '').trim();

    // ambil preview server-side agar eligibility tetap aman
    const preview = await this.getMonthlyStaffDocPreview(
      input.userId,
      input.month,
      input.year,
    );
    const previewMap = new Map(
      preview.map((r: any) => [r.subSurveyActivityId, r]),
    );

    const eligibleRows = (input.rows || [])
      .map((r) => {
        const base = previewMap.get(r.subSurveyActivityId);
        if (!base) return null;
        if (!base.eligible) return null;
        const totalDocs = Number(r.totalDocs ?? base.totalDocs);
        const unitCost = Number(r.unitCost ?? base.unitCost);
        const totalCost = Number(r.totalCost ?? unitCost * totalDocs);
        return {
          subSurveyActivityId: base.subSurveyActivityId,
          activityName: base.activityName,
          startDate: new Date(base.startDate),
          endDate: new Date(base.endDate),
          totalDocs,
          unitCost,
          totalCost,
          budgetCode: (r.budgetCode ?? base.budgetCode ?? '') as string,
        };
      })
      .filter(Boolean) as any[];

    if (eligibleRows.length === 0) {
      throw new BadRequestException(
        'Tidak ada kegiatan selesai pada periode ini.',
      );
    }

    const minStart = new Date(
      Math.min(...eligibleRows.map((r) => r.startDate.getTime())),
    );
    const maxEnd = new Date(
      Math.max(...eligibleRows.map((r) => r.endDate.getTime())),
    );

    const nomorSPK = String(input.nomorSPK || '').trim();
    const nomorBAST = String(input.nomorBAST || '').trim();

    if (!nomorSPK) throw new BadRequestException('nomorSPK wajib diisi');
    if (!nomorBAST) throw new BadRequestException('nomorBAST wajib diisi');

    // validasi ringan agar mengurangi salah format
    if (!nomorSPK.includes('/BPS1603/PPK/SPK/')) {
      throw new BadRequestException(
        'Format nomorSPK tidak sesuai (wajib mengandung /BPS1603/PPK/SPK/)',
      );
    }
    if (!nomorBAST.includes('/BPS1603/PPK/BAST/')) {
      throw new BadRequestException(
        'Format nomorBAST tidak sesuai (wajib mengandung /BPS1603/PPK/BAST/)',
      );
    }

    const hari = this.dayNameId(input.docDate);
    const namaBulan = this.monthNameId(input.month);
    const bulanCaps = (namaBulan || '').toUpperCase();
    const tanggalFormat = this.formatDateId(input.docDate);
    const tanggal = input.docDate.getDate();
    const tanggalTerbilang = this.terbilang(tanggal);
    const tahunTerbilang = this.terbilang(input.year);

    const tanggalMulai = minStart.getDate();
    const tanggalSelesai = maxEnd.getDate();

    const grandTotal = eligibleRows.reduce(
      (acc, r) => acc + (Number(r.totalCost) || 0),
      0,
    );

    const honorTotalAll = this.formatNumberID(grandTotal);
    const honorTotalAllTerbilang = this.terbilang(Math.floor(grandTotal));
    const honorTerbilang = honorTotalAllTerbilang;

    // rows untuk template (SPK & BAST beda kolom)
    const rowsSpk = eligibleRows.map((r, i) => {
      const tglMulai = this.formatDateId(r.startDate);
      const tglSelesai = this.formatDateId(r.endDate);
      const tanggalMulaiRow = String(r.startDate.getDate());
      const tanggalSelesaiRow = String(r.endDate.getDate());
      const honorSatuan = this.formatNumberID(r.unitCost);
      const honorTotal = this.formatNumberID(r.totalCost);
      return {
        no: i + 1,
        kegiatan: r.activityName,
        Kegiatan: r.activityName,
        tanggalMulai: tanggalMulaiRow,
        tanggalSelesai: tanggalSelesaiRow,
        tglMulai,
        tglSelesai,
        volume: r.totalDocs,
        satuan: 'Dokumen',
        honorSatuan,
        honorTotal,
        bebanAnggaran: r.budgetCode || '',
      };
    });

    const rowsBast = eligibleRows.map((r, i) => ({
      no: i + 1,
      kegiatan: r.activityName,
      tglSelesai: this.formatDateId(r.endDate),
      volume: r.totalDocs,
      satuan: 'Dokumen',
      bebanAnggaran: r.budgetCode || '',
    }));

    const common = {
      namaPPK: input.ppkName,
      nipPPK: input.ppkNip,
      namaPetugas: petugasName,
      pekerjaanPetugas,
      desaTinggalPetugas,
      hariDokumen: hari,
      tanggal,
      tanggalTerbilang,
      bulan: namaBulan,
      bulanCaps,
      tahun: String(input.year),
      tahunTerbilang,
      tanggalDokumen: tanggalFormat,
      tanggalMulai,
      tanggalSelesai,
    };

    const spkTemplateRel = path.join('bast-spk', 'template-spk.docx');
    const bastTemplateRel = path.join('bast-spk', 'template-bast.docx');

    const spkBuffer = this.renderDocxTemplate(spkTemplateRel, {
      ...common,
      nomorLampiran: nomorSPK,
      nomorSPK,
      honorTotalAll,
      honorTotalAllTerbilang,
      honorTerbilang,
      rows: rowsSpk,
    });

    const bastBuffer = this.renderDocxTemplate(bastTemplateRel, {
      ...common,
      nomorSPK,
      nomorBAST,
      nomorDokBAST: nomorBAST,
      rows: rowsBast,
    });

    const safeName = (s: string) => String(s || '').replace(/[^\w.\-]+/g, '_');
    const spkFileName = safeName(
      `SPK-${petugasName}-${String(input.month).padStart(2, '0')}-${input.year}.docx`,
    );
    const bastFileName = safeName(
      `BAST-${petugasName}-${String(input.month).padStart(2, '0')}-${input.year}.docx`,
    );

    return {
      spkBuffer,
      bastBuffer,
      spkFileName,
      bastFileName,
      nomorSPK,
      nomorBAST,
    };
  }

  async generateMonthlyStaffDoc(input: {
    userId: string;
    month: number;
    year: number;
    docType: string;
    ppkName: string;
    ppkNip?: string;
    nomorSPK: string;
    nomorBAST: string;
    docDate: Date;
    pekerjaanPetugas?: string;
    desaTinggalPetugas?: string;
    rows: Array<{
      subSurveyActivityId: string;
      totalDocs: number;
      unitCost: number;
      totalCost: number;
      budgetCode?: string;
    }>;
  }) {
    const docType = String(input.docType || '').toUpperCase();

    const mm = String(input.month).padStart(2, '0');
    const normalizeSpk = (v: string) => {
      const s = String(v || '').trim();
      if (!s) return s;
      return s.includes('/BPS1603/PPK/SPK/')
        ? s
        : `${s}/BPS1603/PPK/SPK/${mm}/${input.year}`;
    };
    const normalizeBast = (v: string) => {
      const s = String(v || '').trim();
      if (!s) return s;
      return s.includes('/BPS1603/PPK/BAST/')
        ? s
        : `${s}/BPS1603/PPK/BAST/${mm}/${input.year}`;
    };

    const out = await this.generateMonthlyStaffDocs({
      userId: input.userId,
      month: input.month,
      year: input.year,
      ppkName: input.ppkName,
      ppkNip: input.ppkNip || '-',
      nomorSPK: normalizeSpk(input.nomorSPK),
      nomorBAST: normalizeBast(input.nomorBAST),
      docDate: input.docDate,
      pekerjaanPetugas: input.pekerjaanPetugas,
      desaTinggalPetugas: input.desaTinggalPetugas,
      rows: input.rows,
    });
    return docType === 'BAST' ? out.bastUrl : out.spkUrl;
  }
}
