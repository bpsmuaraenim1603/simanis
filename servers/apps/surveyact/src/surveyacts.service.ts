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
  IssueStatus,
  JobLetter,
  SubmitSPJ,
  User,
} from '@prisma/client';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import {
  SubSurveyActivityType,
  SubSurveyProgressType,
} from './types/surveyact.types';
import { FileUpload } from 'graphql-upload-ts';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { DeleteByIdInput } from './dto/delete.input';
import { StorageService } from './storage.service';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server only
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

@Injectable()
export class SurveyActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly storage: StorageService,
  ) {}

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

  // Update survei by id
  // async update(id: string, input: UpdateSurveyActivityInput) {
  //   return this.prisma.surveyActivity.update({
  //     where: { id },
  //     data: input,
  //   });
  // }

  async findBySlug(slug: string) {
    const survey = await this.prisma.surveyActivity.findUnique({
      where: { slug },
      // include: { issues: true, User: true } // aktifkan jika mau relasi
    });
    if (!survey) throw new NotFoundException('SurveyActivity not found');
    return survey;
  }

  async findAll() {
    return this.prisma.surveyActivity.findMany();
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

  async findSubSurveyActivityTypeBySurveyActivityId(surveyActivityId: string) {
    return this.prisma.subSurveyActivity.findMany({
      where: { surveyActivityId },
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

  async createUserSurveyProgress(input: CreateUserProgressDTO) {
    const { samples, ...rest } = input;

    // Hitung agregat dari samples kalau dikirim dari FE
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

    return this.prisma.userProgress.create({
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
      },
      include: {
        samples: true,
      },
    });
  }

  async getSamplesByUserProgressId(userProgressId: string) {
    return this.prisma.userSample.findMany({
      where: { userProgressId },
    });
  }

  async getUser(userId: string) {
    const response$ = this.httpService.get(
      `https://localhost:4001/users/${userId}`,
    );
    const response = await lastValueFrom(response$);
    return response.data;
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
      where: { subSurveyActivityId },
      include: {
        user: true,
        subSurveyActivity: true,
        district: true,
        supervisor: true,
      },
    });
  }

  async getUserProgressSurveyByUserId(userId: string) {
    return this.prisma.userProgress.findMany({
      where: { userId },
      include: {
        user: true,
        subSurveyActivity: true,
        district: true,
        supervisor: true,
      },
    });
  }

  async getAllUserSurveyProgress() {
    return this.prisma.userProgress.findMany({
      include: {
        user: true,
        subSurveyActivity: true,
        district: true,
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
        supervisor: true,
      },
    });
  }

  async updateUserProgress(input: UpdateUserProgressDTO) {
    const { id, samples, deleteSampleIds, ...rest } = input;

    // 1) update field progress dulu (tanpa samples)
    //    (jangan include samples dulu biar transaksi rapi)
    // NOTE: kita akan hitung agregat dari samples kalau samples dikirim.
    let totalAssigned = rest.totalAssigned;
    let submitCount = rest.submitCount;
    let approvedCount = rest.approvedCount;
    let rejectedCount = rest.rejectedCount;

    if (samples) {
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

    return this.prisma.$transaction(async (tx) => {
      // 2) update parent progress
      const updatedProgress = await tx.userProgress.update({
        where: { id },
        data: {
          ...rest,
          ...(samples
            ? {
                totalAssigned: totalAssigned ?? 0,
                submitCount: submitCount ?? 0,
                approvedCount: approvedCount ?? 0,
                rejectedCount: rejectedCount ?? 0,
              }
            : {}),
        },
      });

      // 3) kalau samples dikirim => replace semua child samples
      if (samples) {
        await tx.userSample.deleteMany({ where: { userProgressId: id } });

        // validasi kecil: buang baris kosong (NUS kosong)
        const cleaned = samples.filter(
          (s) => String(s.nus ?? '').trim().length > 0,
        );

        if (cleaned.length > 0) {
          await tx.userSample.createMany({
            data: cleaned.map((s) => ({
              userProgressId: id,
              nus: s.nus,
              cacahStatus: s.cacahStatus,
              approvalStatus: s.approvalStatus,
              geoLat: s.geoLat ?? null,
              geoLng: s.geoLng ?? null,
              geoCapturedAt: s.geoCapturedAt ?? null,
            })),
          });
        }
      }

      // 4) (opsional) patch delete spesifik kalau kamu mau pakai deleteSampleIds
      if (deleteSampleIds && deleteSampleIds.length > 0) {
        await tx.userSample.deleteMany({
          where: {
            userProgressId: id,
            id: { in: deleteSampleIds },
          },
        });

        // Kalau deleteSampleIds dipakai tanpa `samples`,
        // agregat harus dihitung ulang berdasarkan DB:
        if (!samples) {
          const remain = await tx.userSample.findMany({
            where: { userProgressId: id },
          });

          const ta = remain.length;
          const sc = remain.filter(
            (s) => s.cacahStatus === CacahStatus.Selesai,
          ).length;
          const ac = remain.filter(
            (s) => s.approvalStatus === AgreeState.Disetujui,
          ).length;
          const rc = remain.filter(
            (s) => s.approvalStatus === AgreeState.Ditolak,
          ).length;

          await tx.userProgress.update({
            where: { id },
            data: {
              totalAssigned: ta,
              submitCount: sc,
              approvedCount: ac,
              rejectedCount: rc,
            },
          });
        }
      }

      // 5) return lengkap
      return tx.userProgress.findUnique({
        where: { id },
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

  async createSPJ(input: CreateSPJDTO, file?: FileUpload): Promise<SubmitSPJ> {
    let eviDocumentPath: string | null = null;
    let eviOriginalName: string | null = null;
    let eviMimeType: string | null = null;
    let eviSize: number | null = null;

    // === Hanya proses upload jika argumen "file" memang dikirim dan bukan null ===
    if (file) {
      const { filename, mimetype, createReadStream } = file;

      // ---- Validasi ext ∨ mime (tanpa modul 'path') ----
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
        'application/octet-stream', // beberapa browser, termasuk Edge/Windows
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

      // (opsional) kalau mau hitung size, bisa pipe ke counter; kalau tidak, langsung upload:
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
      .createSignedUrl(pathOrNull, 60 * 60 * 6); // 6 jam
    if (error) return null;
    return data.signedUrl;
  }

  async getAllSPJ() {
    return this.prisma.submitSPJ.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true, subSurveyActivity: true },
    });
  }

  async updateSPJStatus(input: UpdateSPJStatusDTO): Promise<SubmitSPJ> {
    return this.prisma.submitSPJ.update({
      where: { id: input.id },
      data: {
        submitState: input.status,
        verifyNote: input.verifyNote ?? undefined,
        approveDate: input.status === 'Disetujui' ? new Date() : undefined,
      },
    });
  }

  async getJobLetterSignedUrl(path: string | null) {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from('jobletter-docs')
      .createSignedUrl(path, 60 * 60); // 1 jam
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  async createJobLetter(
    input: CreateJobLetterDTO,
    file?: FileUpload,
  ): Promise<JobLetter> {
    let eviLetterPath: string | null = null;
    let eviLetterOriginalName: string | null = null;
    let eviLetterMimeType: string | null = null;
    let eviLetterSize: number | null = null; // optional

    if (file) {
      const { filename, mimetype, createReadStream } = file;

      // pastikan bucket ada
      const { data: b } = await supabase.storage.getBucket('jobletter-docs');
      if (!b)
        throw new BadRequestException(
          'Bucket belum tersedia: ' + 'jobletter-docs',
        );

      // validasi tipe (longgar: ext ∨ mime)
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
      // eviLetterSize: kalau mau hitung, pipe dulu ke counter; kalau tidak, biarkan null
    }

    return this.prisma.jobLetter.create({
      data: {
        userId: input.userId,
        subSurveyActivityId: input.subSurveyActivityId,
        region: input.region,
        submitDate: input.submitDate,

        // legacy terserah diisi atau tidak:
        eviFieldUrl: input.eviFieldUrl ?? undefined,
        eviSTUrl: input.eviSTUrl ?? undefined,

        // NEW
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
  ): Promise<JobLetter> {
    return this.prisma.jobLetter.update({
      where: { id: input.id },
      data: {
        agreeState: input.status,
        rejectNote: input.rejectNote ?? undefined,
        approveDate: input.status === 'Disetujui' ? new Date() : undefined,
      },
    });
  }

  async getAllSubSurveyProgress(): Promise<SubSurveyProgressType[]> {
    const subSurveys = await this.prisma.subSurveyActivity.findMany({
      include: { UserProgress: true },
      orderBy: { startDate: 'asc' },
    });

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
        district: undefined, // isi nanti kalau ada
      };
    });
  }

  async getMonthlySurveyStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [jobLetters, spj, userProgress] = await Promise.all([
      this.prisma.jobLetter.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      this.prisma.submitSPJ.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      this.prisma.userProgress.count({
        where: {
          lastUpdated: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
    ]);

    return {
      totalJobLetters: jobLetters,
      totalSPJ: spj,
      totalActiveUsers: userProgress,
    };
  }

  async allDistricts() {
    return this.prisma.district.findMany();
  }

  async createContentIssue(input: CreateContentIssueDto) {
    // catatan: sebaiknya reporterId diambil dari auth (req.user.id) di resolver/guard
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
                // ✅ untuk relasi 1–1 gunakan 'is'
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
        // ✅ kirim array komentar + user
        IssueComment: {
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { IssueComment: true } }, // opsional, kalau mau tetap punya count cepat
      },
    });
  }

  async updateContentIssue(input: UpdateContentIssueDto) {
    // hanya field yang diisi yang dipakai
    const cleaned = Object.fromEntries(
      Object.entries(input).filter(([k, v]) => k !== 'id' && v != null),
    );

    // NOTE: pembatasan "issueStatus hanya admin" sebaiknya di guard/resolver
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
    // catatan: userId juga sebaiknya dari auth di resolver
    // validasi: pastikan contentIssue ada
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

    // sekadar menyentuh updatedAt di ContentIssue biar naik ke atas daftar
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
      const [spjs, jls] = await Promise.all([
        this.prisma.submitSPJ.findMany({
          where: { subSurveyActivityId: { in: subIds } },
          select: { eviDocumentPath: true },
        }),
        this.prisma.jobLetter.findMany({
          where: { subSurveyActivityId: { in: subIds } },
          select: {
            eviFieldUrl: true,
            eviSTUrl: true /* eviLetterPath: true */,
          } as any,
        }),
      ]);

      await Promise.all([
        this.storage.removeSpjFiles(spjs.map((x) => x.eviDocumentPath)),
        this.storage.removeJobLetterFiles(
          jls.flatMap((x: any) => [x.eviFieldUrl, x.eviSTUrl, x.eviLetterPath]),
        ),
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

    // ambil semua SPJ & JL untuk SSA ini (kumpulkan path/URL berkas)
    const [spjs, jls] = await Promise.all([
      this.prisma.submitSPJ.findMany({
        where: { subSurveyActivityId: id },
        select: { eviDocumentPath: true },
      }),
      this.prisma.jobLetter.findMany({
        where: { subSurveyActivityId: id },
        select: {
          eviFieldUrl: true,
          eviSTUrl: true /* kalau ada: */ /* eviLetterPath: true */,
        } as any,
      }),
    ]);

    // hapus file-file terkait
    await Promise.all([
      this.storage.removeSpjFiles(spjs.map((x) => x.eviDocumentPath)),
      this.storage.removeJobLetterFiles(
        jls.flatMap((x: any) => [x.eviFieldUrl, x.eviSTUrl, x.eviLetterPath]),
      ),
    ]);

    // lalu hapus DB child → parent (seperti versi sebelumnya)
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
    await this.prisma.userProgress.delete({ where: { id } });
    return { success: true, message: 'Petugas sudah dihapus.' };
  }

  async deleteJobLetter({ id }: { id: string }) {
    const jl = await this.prisma.jobLetter.findUnique({ where: { id } });
    if (!jl) throw new NotFoundException('JobLetter tidak ditemukan');

    // Kamu punya beberapa field bukti: eviLetterPath (path), eviFieldUrl (URL), eviSTUrl (URL)
    await this.storage.removeJobLetterFiles([
      (jl as any).eviLetterPath, // jika ada path file utama
      jl.eviFieldUrl, // URL bukti lapangan
      jl.eviSTUrl, // URL bukti surat tugas
    ]);

    await this.prisma.jobLetter.delete({ where: { id } });
    return { success: true, message: 'Surat Tugas dan file sudah terhapus.' };
  }

  async deleteSubmitSPJ({ id }: { id: string }) {
    const spj = await this.prisma.submitSPJ.findUnique({ where: { id } });
    if (!spj) throw new NotFoundException('SubmitSPJ tidak ditemukan');

    // 1) hapus file di storage (eviDocumentPath bisa path relatif atau URL)
    await this.storage.removeSpjFiles([spj.eviDocumentPath]);

    // 2) hapus row
    await this.prisma.submitSPJ.delete({ where: { id } });
    return {
      success: true,
      message: 'Pengajuan Honor dan file sudah terhapus.',
    };
  }
}
