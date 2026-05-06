import {
  BadRequestException,
  ForbiddenException,
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
  GenerateMonthlyStaffDocsInput,
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
  SubSurveyStatus,
  ProgressRole,
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
import JSZip from 'jszip';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
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

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type PpkSnapshotInput = {
  ppkUserId?: string | null;
  ppkName?: string | null;
  ppkNip?: string | null;
};

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

function normalizeBlockCount(
  raw?: string | null,
  fallback?: string,
): string | null {
  const v = String(raw ?? '').trim();
  if (!v) return fallback ?? null;
  if (v.toUpperCase() === 'DRAFT') return fallback ?? 'DRAFT';
  return v;
}

function toNumberLoose(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  // buang semua non-digit kecuali minus
  const digits = s.replace(/[^\d-]/g, '');
  if (!digits || digits === '-') return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class SurveyActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly storage: StorageService,
  ) {}

  private readonly MONTHLY_DOC_SPK_START_KEY = 'MONTHLY_DOC_SPK_START_NUMBER';
  private readonly MONTHLY_DOC_BAST_START_KEY = 'MONTHLY_DOC_BAST_START_NUMBER';
  private readonly MONTHLY_DOC_SPK_CURRENT_KEY =
    'MONTHLY_DOC_SPK_CURRENT_NUMBER';
  private readonly MONTHLY_DOC_BAST_CURRENT_KEY =
    'MONTHLY_DOC_BAST_CURRENT_NUMBER';
  private readonly MONTHLY_DOC_SPK_FORMAT_KEY = 'MONTHLY_DOC_SPK_FORMAT';
  private readonly MONTHLY_DOC_BAST_FORMAT_KEY = 'MONTHLY_DOC_BAST_FORMAT';
  private readonly DEFAULT_SPK_FORMAT = '{KODE}/16030/HK.600/{MM}/SPK/{YYYY}';
  private readonly DEFAULT_BAST_FORMAT = '{KODE}/16030/HK.600/{MM}/BAST/{YYYY}';

  private parsePositiveInt(value: any, fallback: number) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const out = Math.floor(n);
    return out >= 1 ? out : fallback;
  }

  private buildAutoDocNumber(
    seq: number,
    docType: 'SPK' | 'BAST',
    month: number,
    year: number,
  ) {
    const mm = String(month).padStart(2, '0');
    const no = String(seq).padStart(3, '0');
    return `B-${no}/16030/HK.600/${mm}/${docType}/${year}`;
  }

  private buildMonthlyDocNumberFromCode(
    code: string,
    docType: 'SPK' | 'BAST',
    month: number,
    year: number,
    format?: string,
  ) {
    const mm = String(month).padStart(2, '0');
    const yyyy = String(year);
    const safeCode = String(code || '').trim();
    const no = safeCode.replace(/^B-/i, '');
    const template = String(
      format ||
        (docType === 'SPK'
          ? this.DEFAULT_SPK_FORMAT
          : this.DEFAULT_BAST_FORMAT),
    );
    return template
      .replaceAll('{KODE}', safeCode)
      .replaceAll('{NO}', no)
      .replaceAll('{MM}', mm)
      .replaceAll('{M}', String(month))
      .replaceAll('{YYYY}', yyyy)
      .replaceAll('{YY}', yyyy.slice(-2))
      .replaceAll('{DOC}', docType);
  }

  private async getSettingString(key: string, fallback: string) {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    const value = String(row?.value ?? '').trim();
    return value || fallback;
  }

  private async getMonthlyStaffDocCode(input: {
    userId: string;
    month: number;
    year: number;
  }) {
    const month = Number(input.month);
    const year = Number(input.year);

    if (!input.userId) throw new BadRequestException('userId wajib diisi');
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month harus 1-12');
    }
    if (!Number.isInteger(year) || year < 1900) {
      throw new BadRequestException('year tidak valid');
    }

    const anchorYear = month === 12 ? year : year - 1;
    const from = new Date(anchorYear, 11, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    const rows = await this.prisma.userProgress.findMany({
      where: {
        progressRole: 'PETUGAS',
        user: {
          primaryRole: { not: 'Supervisor' },
        },
        subSurveyActivity: {
          startDate: { lte: to },
          endDate: { gte: from },
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            name: true,
            roles: true,
            primaryRole: true,
          },
        },
        subSurveyActivity: {
          select: {
            startDate: true,
          },
        },
      },
    });

    const byUserMonth = new Map<
      string,
      { userId: string; name: string; year: number; month: number }
    >();

    for (const r of rows) {
      const isPetugas =
        String(r.user?.primaryRole ?? '') === 'User' ||
        (Array.isArray(r.user?.roles) && r.user.roles.includes('User'));
      if (!isPetugas) continue;
      const d = r.subSurveyActivity?.startDate;
      if (!d) continue;

      const rowYear = d.getFullYear();
      const rowMonth = d.getMonth() + 1;
      if (d < from || d > to) continue;

      const key = `${rowYear}||${rowMonth}||${r.userId}`;
      if (!byUserMonth.has(key)) {
        byUserMonth.set(key, {
          userId: r.userId,
          name: String(r.user?.name ?? ''),
          year: rowYear,
          month: rowMonth,
        });
      }
    }

    const ordered = Array.from(byUserMonth.values()).sort((a, b) => {
      const aTime = a.year * 100 + a.month;
      const bTime = b.year * 100 + b.month;
      if (aTime !== bTime) return aTime - bTime;
      const nameCompare = a.name.localeCompare(b.name, 'id', {
        sensitivity: 'base',
      });
      if (nameCompare !== 0) return nameCompare;
      return a.userId.localeCompare(b.userId);
    });

    const targetKey = `${year}||${month}||${input.userId}`;
    const idx = ordered.findIndex(
      (x) => `${x.year}||${x.month}||${x.userId}` === targetKey,
    );

    if (idx < 0) {
      throw new BadRequestException(
        'Kode SPK/BAST tidak ditemukan untuk petugas dan bulan tersebut.',
      );
    }

    return `B-${String(idx + 1).padStart(3, '0')}`;
  }

  private async reserveNextMonthlyDocSequence(
    tx: PrismaService | any,
    kind: 'SPK' | 'BAST',
  ) {
    const startKey =
      kind === 'SPK'
        ? this.MONTHLY_DOC_SPK_START_KEY
        : this.MONTHLY_DOC_BAST_START_KEY;
    const currentKey =
      kind === 'SPK'
        ? this.MONTHLY_DOC_SPK_CURRENT_KEY
        : this.MONTHLY_DOC_BAST_CURRENT_KEY;

    const [startRow, currentRow] = await Promise.all([
      tx.systemSetting.findUnique({
        where: { key: startKey },
        select: { value: true },
      }),
      tx.systemSetting.findUnique({
        where: { key: currentKey },
        select: { value: true },
      }),
    ]);

    const startNumber = this.parsePositiveInt(startRow?.value, 1);
    const currentNumber = this.parsePositiveInt(
      currentRow?.value,
      startNumber - 1,
    );
    const nextNumber = Math.max(currentNumber + 1, startNumber);

    await tx.systemSetting.upsert({
      where: { key: currentKey },
      create: {
        key: currentKey,
        value: String(nextNumber),
      },
      update: {
        value: String(nextNumber),
      },
    });

    return nextNumber;
  }

  private async resolveMonthlyDocNumbers(input: {
    userId: string;
    year: number;
    month: number;
    nomorSPK?: string | null;
    nomorBAST?: string | null;
  }) {
    const manualSPK = String(input.nomorSPK ?? '').trim();
    const manualBAST = String(input.nomorBAST ?? '').trim();
    if (manualSPK && manualBAST) {
      return { nomorSPK: manualSPK, nomorBAST: manualBAST };
    }
    const code = await this.getMonthlyStaffDocCode({
      userId: input.userId,
      year: input.year,
      month: input.month,
    });

    const [spkFormat, bastFormat] = await Promise.all([
      this.getSettingString(
        this.MONTHLY_DOC_SPK_FORMAT_KEY,
        this.DEFAULT_SPK_FORMAT,
      ),
      this.getSettingString(
        this.MONTHLY_DOC_BAST_FORMAT_KEY,
        this.DEFAULT_BAST_FORMAT,
      ),
    ]);

    return {
      nomorSPK:
        manualSPK ||
        this.buildMonthlyDocNumberFromCode(
          code,
          'SPK',
          input.month,
          input.year,
          spkFormat,
        ),
      nomorBAST:
        manualBAST ||
        this.buildMonthlyDocNumberFromCode(
          code,
          'BAST',
          input.month,
          input.year,
          bastFormat,
        ),
    };
  }

  async getMonthlyDocNumberSuggestion(
    userId: string,
    month: number,
    year: number,
  ) {
    const code = await this.getMonthlyStaffDocCode({ userId, month, year });
    const [spkFormat, bastFormat] = await Promise.all([
      this.getSettingString(this.MONTHLY_DOC_SPK_FORMAT_KEY, this.DEFAULT_SPK_FORMAT),
      this.getSettingString(this.MONTHLY_DOC_BAST_FORMAT_KEY, this.DEFAULT_BAST_FORMAT),
    ]);

    return {
      nomorSPK: this.buildMonthlyDocNumberFromCode(code, 'SPK', month, year, spkFormat),
      nomorBAST: this.buildMonthlyDocNumberFromCode(code, 'BAST', month, year, bastFormat),
    };
  }

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

    const angka = Math.floor(Math.abs(Number(n ?? 0)));
    if (Number.isNaN(angka)) return '';
    if (angka === 0) return 'Nol';
    if (angka < 12) return satuan[angka];
    if (angka < 20) return `${this.terbilang(angka - 10)} Belas`.trim();
    if (angka < 100) {
      return `${this.terbilang(Math.floor(angka / 10))} Puluh${
        angka % 10 ? ' ' + this.terbilang(angka % 10) : ''
      }`.trim();
    }
    if (angka < 200) {
      return `Seratus${angka - 100 ? ' ' + this.terbilang(angka - 100) : ''}`.trim();
    }
    if (angka < 1000) {
      return `${this.terbilang(Math.floor(angka / 100))} Ratus${
        angka % 100 ? ' ' + this.terbilang(angka % 100) : ''
      }`.trim();
    }
    if (angka < 2000) {
      return `Seribu${angka - 1000 ? ' ' + this.terbilang(angka - 1000) : ''}`.trim();
    }
    if (angka < 1000000) {
      return `${this.terbilang(Math.floor(angka / 1000))} Ribu${
        angka % 1000 ? ' ' + this.terbilang(angka % 1000) : ''
      }`.trim();
    }
    if (angka < 1000000000) {
      return `${this.terbilang(Math.floor(angka / 1000000))} Juta${
        angka % 1000000 ? ' ' + this.terbilang(angka % 1000000) : ''
      }`.trim();
    }
    if (angka < 1000000000000) {
      return `${this.terbilang(Math.floor(angka / 1000000000))} Miliar${
        angka % 1000000000 ? ' ' + this.terbilang(angka % 1000000000) : ''
      }`.trim();
    }
    if (angka < 1000000000000000) {
      return `${this.terbilang(Math.floor(angka / 1000000000000))} Triliun${
        angka % 1000000000000 ? ' ' + this.terbilang(angka % 1000000000000) : ''
      }`.trim();
    }

    throw new BadRequestException(
      `Nilai honor terlalu besar untuk dikonversi ke terbilang: ${angka}`,
    );
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
    const existing = await this.prisma.subSurveyActivity.findUnique({
      where: { id: subSurveyActivityId },
      select: { startDate: true, endDate: true },
    });
    if (!existing)
      throw new NotFoundException('SubSurveyActivity tidak ditemukan');

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

  async getAllSampleTypes() {
    return this.prisma.sampleType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createSampleType(name: string) {
    const cleaned = String(name ?? '').trim();
    if (!cleaned)
      throw new BadRequestException('Nama jenis sampel wajib diisi');

    try {
      return await this.prisma.sampleType.create({
        data: { name: cleaned },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Jenis sampel sudah ada');
      }
      throw e;
    }
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
    docsBillPengawas?: string | null;
  }) {
    const subSurveyActivityId = params.subSurveyActivityId ?? null;
    const superVisorId = params.superVisorId ?? null;
    const districtId = params.districtId ?? null;
    const blockCount = normalizeBlockCount(params.blockCount ?? null);
    const villageId = params.villageId ?? null;
    const docsBillPengawas = params.docsBillPengawas ?? null;
    if (!subSurveyActivityId || !superVisorId) return;

    const supUser = await this.prisma.user.findUnique({
      where: { id: superVisorId },
      select: { districtId: true, villageId: true, primaryRole: true },
    });

    const supDistrictId = supUser?.districtId ?? districtId ?? null;
    const supVillageId = supUser?.villageId ?? villageId ?? null;

    const exists = await this.prisma.userProgress.findFirst({
      where: {
        userId: superVisorId,
        subSurveyActivityId,
        progressRole: 'PENGAWAS',
        blockCount: blockCount,
      },
      select: { id: true },
    });
    if (exists) {
      await this.prisma.userProgress.update({
        where: { id: exists.id },
        data: { districtId: supDistrictId, villageId: supVillageId },
      });
      return;
    }

    const supBill = this.parseMoney(
      docsBillPengawas && String(docsBillPengawas).trim()
        ? String(docsBillPengawas).trim()
        : '0',
    );

    await this.assertMonthlyBillLimit({
      userId: superVisorId,
      subSurveyActivityId,
      addAmount: supBill,
    });
    await this.prisma.userProgress.create({
      data: {
        userId: superVisorId,
        subSurveyActivityId,
        progressRole: 'PENGAWAS',
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        blockCount: blockCount,
        districtId: supDistrictId,
        villageId: supVillageId,
        docsBill:
          docsBillPengawas && String(docsBillPengawas).trim()
            ? String(docsBillPengawas).trim()
            : '0',
        superVisorId: null,
      },
    });
  }

  async createUserSurveyProgress(
    input: CreateUserProgressDTO,
    actorId?: string,
  ) {
    const { samples, docsBillPengawas, ...rest } = input;

    const draftBlock = `DRAFT-${randomUUID().slice(0, 8)}`;
    (rest as any).blockCount = normalizeBlockCount(
      (rest as any).blockCount,
      draftBlock,
    );
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

    const subfilter = await this.prisma.subSurveyActivity.findUnique({
      where: { id: input.subSurveyActivityId },
      select: { endDate: true, status: true },
    });
    if (!subfilter)
      throw new NotFoundException('SubSurveyActivity tidak ditemukan');

    const actor = actorId
      ? await this.prisma.user.findUnique({
          where: { id: actorId },
          select: { roles: true, primaryRole: true },
        })
      : null;

    const isKeuangan =
      !!actor &&
      (actor.primaryRole === 'Keuangan' ||
        (actor.roles ?? []).includes('Keuangan'));

    const now = new Date();
    // const finishedByDate =
    //   now.getTime() > new Date(subfilter.endDate).getTime();
    const finishedByStatus = subfilter.status === 'SELESAI';

    if (finishedByStatus && !isKeuangan) {
      throw new ForbiddenException(
        'Kegiatan sudah selesai. Tidak bisa menambah petugas/pengawas.',
      );
    }

    const petugasUser = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { primaryRole: true },
    });
    const petugasIsSupervisor = petugasUser?.primaryRole === 'Supervisor';
    if (petugasIsSupervisor) {
      (rest as any).docsBill = '0';
    }

    let forcedDocsBillPengawas: string | null | undefined = docsBillPengawas;
    if (rest.superVisorId) {
      const pengawasUser = await this.prisma.user.findUnique({
        where: { id: rest.superVisorId },
        select: { primaryRole: true },
      });
      const pengawasIsSupervisor = pengawasUser?.primaryRole === 'Supervisor';
      if (pengawasIsSupervisor) {
        forcedDocsBillPengawas = '0';
      }
    }

    const addPetugas = this.parseMoney((rest as any)?.docsBill ?? null);
    await this.assertMonthlyBillLimit({
      userId: input.userId,
      subSurveyActivityId: input.subSurveyActivityId,
      addAmount: addPetugas,
    });

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
      docsBillPengawas: forcedDocsBillPengawas ?? null,
    });

    if (
      created.superVisorId &&
      forcedDocsBillPengawas &&
      String(forcedDocsBillPengawas).trim()
    ) {
      const existingSup = await this.prisma.userProgress.findFirst({
        where: {
          userId: created.superVisorId,
          subSurveyActivityId: created.subSurveyActivityId,
          progressRole: 'PENGAWAS',
          blockCount: created.blockCount ?? null,
        },
        select: { id: true, docsBill: true },
      });
      const nextSup = this.parseMoney(String(forcedDocsBillPengawas).trim());
      const prevSup = this.parseMoney(existingSup?.docsBill ?? null);
      const deltaSup = Math.max(0, nextSup - prevSup);
      const superVisorId = created.superVisorId;
      const subSurveyActivityId = created.subSurveyActivityId;

      if (superVisorId && subSurveyActivityId) {
        await this.assertMonthlyBillLimit({
          userId: superVisorId,
          subSurveyActivityId: subSurveyActivityId,
          addAmount: deltaSup,
        });
      }

      await this.prisma.userProgress.updateMany({
        where: {
          userId: created.superVisorId,
          subSurveyActivityId: created.subSurveyActivityId,
          progressRole: 'PENGAWAS',
          blockCount: created.blockCount ?? null,
        },
        data: { docsBill: String(docsBillPengawas).trim() },
      });
    }

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
      where: { subSurveyActivityId },
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

  async getUserProgressById(userProgressId: string) {
    return this.prisma.userProgress.findUnique({
      where: { id: userProgressId },
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

  async getUserProgressPageBySubSurveyActivityId(params: {
    subSurveyActivityId: string;
    page?: number;
    pageSize?: number;
    progressRole?: ProgressRole;
    search?: string;
    superVisorId?: string;
  }) {
    const {
      subSurveyActivityId,
      page = 1,
      pageSize = 200,
      progressRole,
      search,
      superVisorId,
    } = params;

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(1000, Math.max(1, Number(pageSize) || 200));
    const skip = (safePage - 1) * safePageSize;

    const where: any = { subSurveyActivityId };
    if (progressRole) where.progressRole = progressRole;
    if (superVisorId) where.superVisorId = superVisorId;
    if (search && String(search).trim().length > 0) {
      const keyword = String(search).trim();
      where.OR = [
        {
          user: {
            name: { contains: keyword, mode: 'insensitive' },
          },
        },
        {
          user: {
            email: { contains: keyword, mode: 'insensitive' },
          },
        },
        {
          district: {
            name: { contains: keyword, mode: 'insensitive' },
          },
        },
        {
          district: {
            city: { contains: keyword, mode: 'insensitive' },
          },
        },
        {
          village: {
            name: { contains: keyword, mode: 'insensitive' },
          },
        },
        {
          blockCount: { contains: keyword, mode: 'insensitive' },
        },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.userProgress.count({ where }),
      this.prisma.userProgress.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: [{ district: { city: 'asc' } }, { user: { name: 'asc' } }],
        include: {
          user: true,
          subSurveyActivity: true,
          district: true,
          village: true,
          supervisor: true,
        },
      }),
    ]);

    return { items, total, page: safePage, pageSize: safePageSize };
  }

  async getUserProgressSurveyByUserId(userId: string) {
    return this.prisma.userProgress.findMany({
      where: { userId },
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
    const { id, samples, deleteSampleIds, docsBillPengawas, ...rest } =
      input as any;

    if (Object.prototype.hasOwnProperty.call(rest as any, 'blockCount')) {
      const draftBlock = `DRAFT-${String(id).slice(0, 8)}`;
      (rest as any).blockCount = normalizeBlockCount(
        (rest as any).blockCount,
        draftBlock,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const upBefore = await tx.userProgress.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          subSurveyActivityId: true,
          progressRole: true,
          superVisorId: true,
          blockCount: true,
          docsBill: true,
          districtId: true,
          villageId: true,
        },
      });
      if (!upBefore)
        throw new NotFoundException('UserProgress tidak ditemukan');

      const nextUserIdRaw = Object.prototype.hasOwnProperty.call(
        rest as any,
        'userId',
      )
        ? (rest as any).userId
        : upBefore.userId;

      const nextUserId = nextUserIdRaw
        ? String(nextUserIdRaw)
        : upBefore.userId;

      const petugasUser = await tx.user.findUnique({
        where: { id: nextUserId },
        select: { primaryRole: true },
      });
      const petugasIsSupervisor = petugasUser?.primaryRole === 'Supervisor';
      if (petugasIsSupervisor) {
        (rest as any).docsBill = '0';
      }

      const nextSupIdRaw = Object.prototype.hasOwnProperty.call(
        rest as any,
        'superVisorId',
      )
        ? (rest as any).superVisorId
        : upBefore.superVisorId;

      const nextSupId =
        nextSupIdRaw === null ||
        nextSupIdRaw === undefined ||
        nextSupIdRaw === ''
          ? null
          : String(nextSupIdRaw);

      const pengawasUser = nextSupId
        ? await tx.user.findUnique({
            where: { id: nextSupId },
            select: { primaryRole: true },
          })
        : null;

      const pengawasIsSupervisor = pengawasUser?.primaryRole === 'Supervisor';

      // Jika pengawas "Supervisor", paksa honor pengawas 0 (walaupun payload isi angka).
      const forcedDocsBillPengawas =
        nextSupId && pengawasIsSupervisor ? '0' : docsBillPengawas;

      if (
        Object.prototype.hasOwnProperty.call(rest as any, 'docsBill') &&
        upBefore.subSurveyActivityId
      ) {
        const nextBill = this.parseMoney((rest as any)?.docsBill ?? null);

        await this.assertMonthlyBillLimit({
          userId: upBefore.userId,
          subSurveyActivityId: upBefore.subSurveyActivityId,
          addAmount: nextBill,
          excludeProgressIds: [id],
        });
      }

      await tx.userProgress.update({
        where: { id },
        data: { ...rest },
      });

      const upAfter = await tx.userProgress.findUnique({
        where: { id },
        select: {
          id: true,
          progressRole: true,
          subSurveyActivityId: true,
          superVisorId: true,
          districtId: true,
          villageId: true,
          blockCount: true,
        },
      });

      if (
        upAfter &&
        upAfter.progressRole === 'PETUGAS' &&
        upAfter.subSurveyActivityId &&
        upAfter.superVisorId
      ) {
        const oldBlock = upBefore.blockCount ?? null;
        const newBlock = upAfter.blockCount ?? null;

        const oldSup = upBefore.superVisorId ?? null;
        const newSup = upAfter.superVisorId ?? null;

        const isPetugas = upAfter.progressRole === 'PETUGAS';
        const hasSub = !!upAfter.subSurveyActivityId;

        const isRenameBlock = oldBlock !== newBlock;
        const isChangeSupervisor = oldSup !== newSup;

        const supUser = newSup
          ? await tx.user.findUnique({
              where: { id: newSup },
              select: { districtId: true, villageId: true },
            })
          : null;
        const supDistrictId = supUser?.districtId ?? null;
        const supVillageId = supUser?.villageId ?? null;

        if (
          isPetugas &&
          hasSub &&
          newSup &&
          (isRenameBlock || isChangeSupervisor)
        ) {
          const existsNew = await tx.userProgress.findFirst({
            where: {
              userId: newSup,
              subSurveyActivityId: upAfter.subSurveyActivityId,
              progressRole: 'PENGAWAS',
              blockCount: newBlock,
            },
            select: { id: true },
          });
          const oldSupProgress = await tx.userProgress.findFirst({
            where: {
              userId: oldSup ?? newSup,
              subSurveyActivityId: upAfter.subSurveyActivityId,
              progressRole: 'PENGAWAS',
              blockCount: oldBlock,
            },
            select: { id: true, docsBill: true },
          });

          if (!existsNew && oldSupProgress) {
            await tx.userProgress.update({
              where: { id: oldSupProgress.id },
              data: {
                userId: newSup,
                blockCount: newBlock,
                districtId: supDistrictId,
                villageId: supVillageId,
              },
            });
          } else if (
            existsNew &&
            oldSupProgress &&
            oldSupProgress.id !== existsNew.id
          ) {
            if (String(oldSupProgress.docsBill ?? '0') === '0') {
              await tx.userProgress.delete({
                where: { id: oldSupProgress.id },
              });
            }
          }
        }
        const existsSup = await tx.userProgress.findFirst({
          where: {
            userId: upAfter.superVisorId,
            subSurveyActivityId: upAfter.subSurveyActivityId,
            progressRole: 'PENGAWAS',
            blockCount: upAfter.blockCount ?? null,
          },
          select: { id: true },
        });

        if (!existsSup) {
          await tx.userProgress.create({
            data: {
              userId: upAfter.superVisorId,
              subSurveyActivityId: upAfter.subSurveyActivityId,
              progressRole: 'PENGAWAS',
              totalAssigned: 0,
              submitCount: 0,
              approvedCount: 0,
              rejectedCount: 0,
              blockCount: upAfter.blockCount ?? null,
              districtId: supDistrictId,
              villageId: supVillageId,
              docsBill: '0',
              superVisorId: null,
            },
          });
        }

        if (
          forcedDocsBillPengawas !== undefined &&
          upAfter.subSurveyActivityId &&
          upAfter.superVisorId
        ) {
          const targetSup = await tx.userProgress.findFirst({
            where: {
              userId: upAfter.superVisorId,
              subSurveyActivityId: upAfter.subSurveyActivityId,
              progressRole: 'PENGAWAS',
              blockCount: upAfter.blockCount ?? null,
            },
            select: { id: true, docsBill: true },
          });

          if (!targetSup) {
            throw new NotFoundException(
              'UserProgress pengawas tidak ditemukan',
            );
          }

          const nextSup = this.parseMoney(forcedDocsBillPengawas ?? null);
          const prevSup = this.parseMoney(targetSup.docsBill ?? null);

          const delta = Math.max(0, nextSup - prevSup);
          if (delta > 0) {
            await this.assertMonthlyBillLimit({
              userId: upAfter.superVisorId,
              subSurveyActivityId: upAfter.subSurveyActivityId,
              addAmount: delta,
              excludeProgressIds: [targetSup.id],
            });
          }

          await tx.userProgress.update({
            where: { id: targetSup.id },
            data: {
              docsBill:
                forcedDocsBillPengawas !== null &&
                forcedDocsBillPengawas !== undefined
                  ? String(forcedDocsBillPengawas).trim()
                  : '0',
              districtId: supDistrictId,
              villageId: supVillageId,
              blockCount: upAfter.blockCount ?? null,
            },
          });
        }
      }

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
    const enableEndSoonNotif = process.env.PROGRESS_NOTIFY_ON_QUERY === 'true';

    if (enableEndSoonNotif) {
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

  private async assertMonthlyBillLimit(params: {
    userId: string;
    subSurveyActivityId: string;
    addAmount: number;
    now?: Date;
    excludeProgressIds?: string[];
  }) {
    const { userId, subSurveyActivityId } = params;
    const addAmount = Number(params.addAmount ?? 0);
    if (!Number.isFinite(addAmount) || addAmount <= 0) return;

    const now = params.now ?? new Date();
    const { from, to } = this.monthRange(now.getMonth() + 1, now.getFullYear());

    const [u, sub] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { limit_bill: true, name: true },
      }),
      this.prisma.subSurveyActivity.findUnique({
        where: { id: subSurveyActivityId },
        select: { startDate: true, endDate: true, name: true },
      }),
    ]);

    if (!u) throw new NotFoundException('User tidak ditemukan');
    if (!sub) throw new NotFoundException('SubSurveyActivity tidak ditemukan');

    const limit = this.parseMoney(u.limit_bill);
    if (!Number.isFinite(limit) || limit <= 0) return;

    const overlap =
      new Date(sub.startDate).getTime() <= to.getTime() &&
      new Date(sub.endDate).getTime() >= from.getTime();
    if (!overlap) return;

    const excludeIds = (params.excludeProgressIds ?? []).filter(Boolean);

    const progresses = await this.prisma.userProgress.findMany({
      where: {
        userId,
        ...(excludeIds.length ? { NOT: excludeIds.map((id) => ({ id })) } : {}),
        subSurveyActivity: {
          startDate: { lte: to },
          endDate: { gte: from },
        },
      },
      select: { docsBill: true },
    });

    const currentTotal = progresses.reduce(
      (acc, p) => acc + this.parseMoney(p.docsBill),
      0,
    );
    const nextTotal = currentTotal + addAmount;

    if (nextTotal > limit) {
      throw new BadRequestException(
        `Batas honor bulan ini terlampaui untuk ${u.name || 'user'}: ` +
          `batas ${this.formatNumberID(limit)}, ` +
          `total saat ini ${this.formatNumberID(currentTotal)}, ` +
          `penambahan ${this.formatNumberID(addAmount)}. ` +
          `Kegiatan: ${sub.name || '-'} (${this.formatDateId(from)} s.d. ${this.formatDateId(to)}).`,
      );
    }
  }

  async getMonthlyActivityStaffUsage(year: number, actor: any, month?: number) {
    actor = await this.enrichActor(actor);
    const actorId = actor?.id;
    if (!actorId) return [];

    const monthFrom = typeof month === 'number' && month >= 1 && month <= 12;
    const from = monthFrom
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);
    const to = monthFrom ? new Date(year, month, 0) : new Date(year, 11, 31);
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
        startDate: { lte: to },
        endDate: { gte: from },
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

    if (!subs.length) return [];

    const subIds = subs.map((s) => s.id);
    const userProgresses = await this.prisma.userProgress.findMany({
      where: {
        subSurveyActivityId: { in: subIds },
        progressRole: 'PETUGAS',
      },
      distinct: ['subSurveyActivityId', 'userId'],
      select: {
        subSurveyActivityId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            primaryRole: true,
          },
        },
      },
    });

    const usersBySubId = new Map<
      string,
      Array<{ id: string; name?: string; email?: string }>
    >();
    for (const item of userProgresses) {
      const subSurveyActivityId = item.subSurveyActivityId;
      const user = item.user;
      if (!subSurveyActivityId) continue;
      if (!user?.id) continue;
      if (String(user.primaryRole) !== 'User') continue;
      if (!usersBySubId.has(subSurveyActivityId)) {
        usersBySubId.set(subSurveyActivityId, []);
      }
      usersBySubId.get(subSurveyActivityId)!.push({
        id: user.id,
        name: user.name ?? '',
        email: user.email ?? '',
      });
    }

    const pad2 = (n: number) => String(n).padStart(2, '0');

    return subs.map((s) => {
      const monthKey = `${s.startDate.getFullYear()}-${pad2(s.startDate.getMonth() + 1)}`;
      const staffUsers = (usersBySubId.get(s.id) ?? []).sort((a, b) =>
        String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'id'),
      );

      return {
        month: monthKey,
        subSurveyActivityId: s.id,
        subSurveyName: s.name ?? '-',
        subSurveySlug: s.slug,
        surveyActivitySlug: s.surveyActivity?.slug ?? '',
        startDate: s.startDate,
        endDate: s.endDate,
        staffCount: staffUsers.length,
        staffUsers,
      };
    });
  }

  async getStaffYearlyExport(year: number) {
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59, 999);

    const pad2 = (n: number) => String(n).padStart(2, '0');

    const ups = await this.prisma.userProgress.findMany({
      where: {
        subSurveyActivity: {
          // include activities that overlap the given year (not only those starting within the year)
          startDate: { lte: to },
          endDate: { gte: from },
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
        docsBill: true,

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

        docsBill: r.docsBill ?? 0,
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

    type ImportedSample = {
      nus: string;
      identity: string;
      cacahStatus?: string;
      approvalStatus?: string;
      geoLat?: number | null;
      geoLng?: number | null;
    };

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

      const nus = String(r['NUS'] ?? r['nus'] ?? '').trim();
      const identity = String(
        r['Identitas Sampel'] ?? r['identity'] ?? '',
      ).trim();
      const cacahStatus = String(
        r['Status Cacah'] ?? r['cacahStatus'] ?? '',
      ).trim();
      const approvalStatus = String(
        r['Status Approval'] ?? r['approvalStatus'] ?? '',
      ).trim();
      const geoLatRaw = String(r['GeoLat'] ?? r['geoLat'] ?? '').trim();
      const geoLngRaw = String(r['GeoLng'] ?? r['geoLng'] ?? '').trim();

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

    const parseOptionalSampleCount = (raw: any): number | null => {
      if (raw === null || raw === undefined) return null;
      const s = String(raw).trim();
      if (!s) return null;

      const n = Number(s);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error('Jumlah Sampel harus berupa angka >= 0.');
      }

      return Math.floor(n);
    };

    const buildGeneratedSamples = (count: number): ImportedSample[] =>
      Array.from({ length: count }).map((_, idx) => ({
        nus: String(idx + 1).padStart(3, '0'),
        identity: '',
        cacahStatus: 'Belum_Cacah',
        approvalStatus: 'Menunggu',
        geoLat: null,
        geoLng: null,
      }));

    const mapSamplesForCreate = (items: ImportedSample[]) =>
      items.map((s, idx) => ({
        nus:
          s.nus && s.nus.trim()
            ? s.nus.trim()
            : String(idx + 1).padStart(3, '0'),
        identity: s.identity ?? '',
        cacahStatus: (s.cacahStatus || 'Belum_Cacah') as CacahStatus,
        approvalStatus: (s.approvalStatus || 'Menunggu') as AgreeState,
        geoLat: s.geoLat ?? null,
        geoLng: s.geoLng ?? null,
      }));

    // ============ LOOP PER BARIS PETUGAS ============

    for (let i = 0; i < petugasRows.length; i++) {
      const r = petugasRows[i];
      const rowIndex = i + 2;

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
        const sampleCount = parseOptionalSampleCount(r['Jumlah Sampel']);

        const docsBillPetugas =
          String(r['Honor Petugas'] || r.docsBill || '').trim() || '0';
        const docsBillPengawas =
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

        const samplesFromSheet = samplesByNoPetugas.get(noPetugas) ?? [];
        const samplesForThisPetugas: ImportedSample[] =
          samplesFromSheet.length > 0
            ? samplesFromSheet
            : sampleCount !== null
              ? buildGeneratedSamples(sampleCount)
              : [];

        // ============ TRANSAKSI PER PETUGAS ============

        const rowResult = await this.prisma.$transaction(async (tx) => {
          const subs = await tx.subSurveyActivity.findUnique({
            where: { id: subSurveyActivityId },
            select: { id: true, status: true, endDate: true },
          });
          if (!subs) {
            throw new Error(
              `subSurveyActivityId tidak ditemukan: ${subSurveyActivityId}`,
            );
          }

          // const now = new Date();
          // const endDate = new Date(subs.endDate);
          // if (subs.status === 'SELESAI' || endDate.getTime() < now.getTime()) {
          if (subs.status === 'SELESAI') {
            throw new Error(
              'Kegiatan sudah selesai. Tidak bisa menambah petugas/pengawas.',
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

          const existingPetugas = await tx.userProgress.findFirst({
            where: {
              userId,
              subSurveyActivityId,
              progressRole: 'PETUGAS',
              blockCount,
            },
            select: { id: true, docsBill: true },
          });

          if (existingPetugas) {
            throw new Error(
              'Data petugas untuk kombinasi petugas + kegiatan + blok sudah ada. Upload hanya untuk penambahan data baru.',
            );
          }

          let userProgressId: string | null = null;
          {
            const nextPetugasBill = this.parseMoney(docsBillPetugas);
            await this.assertMonthlyBillLimit({
              userId,
              subSurveyActivityId,
              addAmount: nextPetugasBill,
            });
            const created = await tx.userProgress.create({
              data: {
                userId,
                subSurveyActivityId,
                progressRole: 'PETUGAS',
                superVisorId,
                districtId,
                villageId,
                blockCount,
                docsBill: docsBillPetugas,
                totalAssigned: 0,
                submitCount: 0,
                approvedCount: 0,
                rejectedCount: 0,
                samples:
                  samplesForThisPetugas.length > 0
                    ? {
                        create: mapSamplesForCreate(samplesForThisPetugas),
                      }
                    : undefined,
              },
              select: { id: true },
            });

            userProgressId = created.id;
            petugasInserted++;
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
              select: { id: true, docsBill: true },
            });

            if (!existingSup) {
              const nextSupBill = this.parseMoney(docsBillPengawas);
              await this.assertMonthlyBillLimit({
                userId: superVisorId,
                subSurveyActivityId,
                addAmount: nextSupBill,
              });
              await tx.userProgress.create({
                data: {
                  userId: superVisorId,
                  subSurveyActivityId,
                  progressRole: 'PENGAWAS',
                  superVisorId: null,
                  districtId,
                  villageId,
                  blockCount,
                  docsBill: docsBillPengawas,
                  totalAssigned: 0,
                  submitCount: 0,
                  approvedCount: 0,
                  rejectedCount: 0,
                },
              });
              pengawasInserted++;
            } else {
              pengawasUpdated += 0;
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

  async getMitraBulananExport(year: number, month?: number) {
    const hasMonth = typeof month === 'number' && month >= 1 && month <= 12;
    const visibleFrom = hasMonth
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);
    const visibleTo = hasMonth
      ? new Date(year, month, 0, 23, 59, 59, 999)
      : new Date(year, 11, 31, 23, 59, 59, 999);

    const anchorYear = hasMonth && month === 12 ? year : year - 1;
    const from = new Date(anchorYear, 11, 1);
    const to = visibleTo;

    const rows = await this.prisma.userProgress.findMany({
      where: {
        progressRole: 'PETUGAS',
        user: {
          primaryRole: { not: 'Supervisor' },
        },
        subSurveyActivity: {
          startDate: { lte: to },
          endDate: { gte: from },
        },
      },
      select: {
        userId: true,
        subSurveyActivityId: true,
        totalAssigned: true,
        docsBill: true,
        blockCount: true,
        user: {
          select: {
            id: true,
            name: true,
            job_name: true,
            limit_bill: true,
            district: { select: { name: true, city: true } },
            roles: true,
            primaryRole: true,
          },
        },
        subSurveyActivity: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
            sampleType: true,
            priceCompareUnit: true,
            unitWorkPrice: true,
            budgetCode: true,
            surveyActivity: {
              select: {
                chief: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { subSurveyActivity: { startDate: 'asc' } },
        { user: { name: 'asc' } },
      ],
    });

    const dipa = 'DIPA BPS Kabupaten Muara Enim';
    const toNumber = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      if (typeof v !== 'string') return null;
      let s = v.trim();
      if (!s) return null;
      s = s.replace(/[^0-9.,-]/g, '');
      if (!s) return null;

      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      if (lastDot !== -1 && lastComma !== -1) {
        if (lastDot > lastComma) {
          s = s.replace(/,/g, '');
        } else {
          s = s.replace(/\./g, '').replace(/,/g, '.');
        }
      } else if (lastComma !== -1) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else {
        const parts = s.split('.');
        if (parts.length > 2) {
          const dec = parts.pop();
          s = parts.join('') + '.' + dec;
        }
      }

      const n = Number.parseFloat(s);
      return Number.isFinite(n) ? n : null;
    };

    const out: any[] = [];
    const map = new Map<string, any>();

    const normBlock = (v: any): string => {
      const s = String(v ?? '').trim();
      return s;
    };

    for (const r of rows) {
      const primaryRole = String(r.user?.primaryRole ?? '');
      if (primaryRole === 'Supervisor') continue;
      const isPetugas =
        primaryRole === 'User' ||
        (Array.isArray(r.user?.roles) && r.user.roles.includes('User'));
      if (!isPetugas) continue;
      const ssa = r.subSurveyActivity;
      if (!ssa?.startDate) continue;

      const rowYear = ssa.startDate.getFullYear();
      const month = ssa.startDate.getMonth() + 1;
      const key = `${rowYear}||${month}||${r.userId}||${r.subSurveyActivityId}`;

      const compare = String(ssa?.priceCompareUnit ?? 'SAMPEL');
      const bill = toNumberLoose(r.docsBill);

      const existing = map.get(key);
      if (!existing) {
        const row = {
          year: rowYear,
          month,
          userId: r.userId,
          subSurveyActivityId: r.subSurveyActivityId,

          name: r.user?.name ?? '-',
          job_name: r.user?.job_name ?? null,
          district: r.user?.district?.name ?? null,
          city: r.user?.district?.city ?? null,

          subsurveyactivity: ssa?.name ?? '-',
          startDate: ssa.startDate,
          endDate: ssa.endDate ?? ssa.startDate,

          totalAssigned: 0,
          docsBill: bill,

          sampleType: ssa?.sampleType ?? '',
          priceCompareUnit: ssa?.priceCompareUnit ?? 'SAMPEL',
          unitWorkPrice: ssa?.unitWorkPrice ?? null,
          budgetCode: ssa?.budgetCode ?? null,
          limit_bill: toNumberLoose(r.user?.limit_bill),
          chiefName: ssa?.surveyActivity?.chief?.name ?? null,
          dipa,

          __blocks: new Set<string>(),
        };

        if (compare === 'BLOK') {
          const b = normBlock(r.blockCount);
          if (b) row.__blocks.add(b);
          row.totalAssigned = row.__blocks.size;
        } else {
          row.totalAssigned = Number(r.totalAssigned ?? 0) || 0;
        }

        map.set(key, row);
        out.push(row);
        continue;
      }

      if (compare === 'BLOK') {
        const b = normBlock(r.blockCount);
        if (b) existing.__blocks.add(b);
        existing.totalAssigned = existing.__blocks.size;
      } else {
        existing.totalAssigned += Number(r.totalAssigned ?? 0) || 0;
      }
      existing.docsBill = toNumberLoose(existing.docsBill) + bill;

      const end = (ssa.endDate ?? ssa.startDate).getTime();
      const curEnd = new Date(existing.endDate ?? existing.startDate).getTime();
      if (end > curEnd) existing.endDate = ssa.endDate ?? ssa.startDate;
    }

    const byUserMonth = new Map<string, any[]>();
    for (const r of out) {
      if (r?.__blocks) delete r.__blocks;
      const k = `${r.year}||${r.month}||${r.userId}`;
      if (!byUserMonth.has(k)) byUserMonth.set(k, []);
      byUserMonth.get(k)!.push(r);
    }

    const orderedUserMonths = Array.from(byUserMonth.entries())
      .map(([key, list]) => {
        const first = list[0] ?? {};
        return {
          key,
          year: Number(first.year ?? 0),
          month: Number(first.month ?? 0),
          userId: String(first.userId ?? ''),
          name: String(first.name ?? ''),
        };
      })
      .sort((a, b) => {
        const aTime = a.year * 100 + a.month;
        const bTime = b.year * 100 + b.month;
        if (aTime !== bTime) return aTime - bTime;
        const nameCompare = a.name.localeCompare(b.name, 'id', {
          sensitivity: 'base',
        });
        if (nameCompare !== 0) return nameCompare;
        return a.userId.localeCompare(b.userId);
      });

    orderedUserMonths.forEach((item, idx) => {
      const code = `B-${String(idx + 1).padStart(3, '0')}`;
      const list = byUserMonth.get(item.key) ?? [];
      for (const r of list) {
        r.spkCode = code;
        r.bastCode = code;
        r.spkNumber = this.buildMonthlyDocNumberFromCode(
          code,
          'SPK',
          Number(r.month),
          Number(r.year),
        );
        r.bastNumber = this.buildMonthlyDocNumberFromCode(
          code,
          'BAST',
          Number(r.month),
          Number(r.year),
        );
      }
    });

    const visibleOut = out.filter((r) => {
      const d = new Date(r.startDate);
      return d >= visibleFrom && d <= visibleTo;
    });

    visibleOut.sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      const an = String(a.name ?? '');
      const bn = String(b.name ?? '');
      const nameCompare = an.localeCompare(bn, 'id', { sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      return String(a.subsurveyactivity ?? '').localeCompare(
        String(b.subsurveyactivity ?? ''),
        'id',
      );
    });

    return visibleOut;
  }

  async exportUserSamplePhotos(
    userProgressId: string,
    actorId?: string,
  ): Promise<{ zipUrl: string; totalPhotos: number }> {
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
      .createSignedUrl(exportKey, 60 * 60);

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

  private parseMoney(input?: string | number | null): number {
    if (input === null || input === undefined) return 0;

    if (typeof input === 'number') return Number.isFinite(input) ? input : 0;

    let s = String(input).trim();
    if (!s) return 0;

    let negative = false;
    if (s.startsWith('(') && s.endsWith(')')) {
      negative = true;
      s = s.slice(1, -1).trim();
    }

    s = s.replace(/\s+/g, '');
    s = s.replace(/[^0-9.,-]/g, '');

    if (s.startsWith('-')) {
      negative = true;
      s = s.slice(1);
    }
    s = s.replace(/-/g, '');

    if (!s) return 0;

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');

    let decSep: '.' | ',' | null = null;
    if (lastDot === -1 && lastComma === -1) {
      decSep = null;
    } else if (lastDot > lastComma) {
      decSep = '.';
    } else {
      decSep = ',';
    }

    let intPart = s;
    let fracPart = '';

    if (decSep) {
      const idx = decSep === '.' ? lastDot : lastComma;
      intPart = s.slice(0, idx);
      fracPart = s.slice(idx + 1);
    }

    intPart = intPart.replace(/[.,]/g, '');
    fracPart = fracPart.replace(/[.,]/g, '');

    if (!/\d/.test(intPart) && !/\d/.test(fracPart)) return 0;

    const normalized = fracPart
      ? `${intPart || '0'}.${fracPart}`
      : intPart || '0';
    const n = Number(normalized);

    if (!Number.isFinite(n)) return 0;
    return negative ? -n : n;
  }

  async getMonthlyStaffDocPreview(userId: string, month: number, year: number) {
    const { from, to } = this.monthRange(month, year);

    const recap = await this.prisma.monthlyAdminDocRecap.findUnique({
      where: { userId_year_month: { userId, year, month } },
      include: {
        items: { select: { subSurveyActivityId: true } },
      },
    });
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
        progressRole: true,
        docsBill: true,
        subSurveyActivity: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            budgetCode: true,
            unitWorkPrice: true,
          },
        },
        _count: { select: { samples: true } },
      },
    });

    const supervisedPetugas = await this.prisma.userProgress.findMany({
      where: {
        superVisorId: userId,
        progressRole: 'PETUGAS',
        subSurveyActivity: {
          startDate: { lte: to },
          endDate: { gte: from },
        },
      },
      select: {
        subSurveyActivityId: true,
        _count: { select: { samples: true } },
      },
    });

    const supervisedDocsBySSA = new Map<string, number>();
    for (const x of supervisedPetugas) {
      const ssaId = x.subSurveyActivityId;
      if (!ssaId) continue;
      supervisedDocsBySSA.set(
        ssaId,
        (supervisedDocsBySSA.get(ssaId) ?? 0) + (x._count?.samples ?? 0),
      );
    }
    const upIds = progresses.map((p) => p.id);
    const clipStart = (d: Date) => (d < from ? from : d);
    const clipEnd = (d: Date) => (d > to ? to : d);

    const map = new Map<
      string,
      {
        subSurveyActivityId: string;
        activityName: string;
        startDate: Date;
        endDate: Date;
        totalDocs: number;
        totalHonor: number;
        unitCost: number;
        budgetCode?: string | null;
      }
    >();

    for (const p of progresses) {
      const ssa = p.subSurveyActivity;
      if (!ssa?.id) continue;

      const key = ssa.id;
      const docs =
        p.progressRole === 'PENGAWAS'
          ? (supervisedDocsBySSA.get(ssa.id) ?? 0)
          : (p._count?.samples ?? 0);
      const unitCost = Number((ssa as any).unitWorkPrice ?? 0);
      const honor = unitCost * docs;

      const startInMonth = clipStart(new Date(ssa.startDate));
      const endInMonth = clipEnd(new Date(ssa.endDate));

      if (endInMonth < from || startInMonth > to) continue;

      const ssaBudget = ssa.budgetCode ?? null;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          subSurveyActivityId: ssa.id,
          activityName: ssa.name,
          startDate: startInMonth,
          endDate: endInMonth,
          totalDocs: docs,
          totalHonor: honor,
          unitCost,
          budgetCode: ssaBudget ?? (ssa as any).budgetCode ?? null,
        });
      } else {
        existing.totalDocs += docs;
        existing.totalHonor += honor;
        if (startInMonth < existing.startDate)
          existing.startDate = startInMonth;

        if (endInMonth > existing.endDate) existing.endDate = endInMonth;

        if (!existing.budgetCode) {
          existing.budgetCode = ssaBudget ?? (ssa as any).budgetCode ?? null;
        }
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

    rows.sort((a, b) => a.activityName.localeCompare(b.activityName));

    return rows;
  }

  private resolveTemplatePath(rel: string) {
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
    const startRow = 0;
    const endRow = XLSX.utils.decode_range(sheet['!ref'] || 'A1:H1').e.r;

    const startCol = 0;
    const endCol = 7;

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
    const raw = process.env.MONTHLY_STAFF_DOC_TTL_HOURS;
    const n = Number(raw);
    if (!raw) return 24;
    if (Number.isFinite(n) && n > 0) return n;
    return 24;
  }

  private async uploadMonthlyStaffDoc(buffer: Buffer, filename: string) {
    try {
      const bucket = 'monthly-staff-docs';
      const objectPath = `${new Date().getFullYear()}/${randomUUID()}-${filename}`;

      const res = await supabase.storage
        .from(bucket)
        .upload(objectPath, buffer, {
          upsert: true,
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

      if (res.error) {
        console.error('SUPABASE UPLOAD ERROR:', res.error);
        throw new BadRequestException(res.error.message);
      }

      const ttlHours = this.getMonthlyStaffDocTtlHours();
      const signed = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, Math.floor(ttlHours * 60 * 60));

      if (signed.error) {
        console.error('SUPABASE SIGN ERROR:', signed.error);
        throw new BadRequestException(signed.error.message);
      }

      if (!signed?.data?.signedUrl)
        throw new BadRequestException('Gagal membuat signed url');

      return {
        signedUrl: signed.data.signedUrl,
        bucket,
        objectPath,
        expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      };
    } catch (e) {
      console.error('UPLOAD MONTHLY STAFF DOC FAILED:', e);
      throw e instanceof BadRequestException
        ? e
        : new BadRequestException(String((e as any)?.message ?? e));
    }
  }

  async generateMonthlyStaffDocs(input: {
    userId: string;
    month: number;
    year: number;
    ppkId: string;
    ppkName: string;
    ppkNip: string;
    nomorSPK?: string;
    nomorBAST?: string;
    spkDocDate: Date;
    bastDocDate: Date;
    pekerjaanPetugas?: string;
    desaTinggalPetugas?: string;
    rows: Array<{
      subSurveyActivityId: string;
      totalDocs: number;
      unitName?: string;
      included?: boolean;
    }>;
  }) {
    const built = await this.generateMonthlyStaffDocsBuffers(input);

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

      await this.upsertMonthlyAdminDocRecap({
        userId: input.userId,
        year: input.year,
        month: input.month,
        ppkUserId: input.ppkId,
        ppkName: input.ppkName,
        ppkNip: input.ppkNip,
        nomorSPK: built.nomorSPK,
        nomorBAST: built.nomorBAST,
        rows: input.rows.map((r) => ({
          subSurveyActivityId: r.subSurveyActivityId,
        })),
      });
    } catch (e) {
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
    ppkId: string;
    ppkName: string;
    ppkNip: string;
    nomorSPK?: string;
    nomorBAST?: string;
    spkDocDate: Date;
    bastDocDate: Date;
    pekerjaanPetugas?: string;
    desaTinggalPetugas?: string;
    rows: Array<{
      subSurveyActivityId: string;
      totalDocs: number;
      unitName?: string;
      included?: boolean;
    }>;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    const petugasName = user?.name || 'Petugas';
    const pekerjaanPetugas = String(
      input.pekerjaanPetugas ?? (user as any)?.job_name ?? '',
    ).trim();

    const desaTinggalPetugas = String(
      input.desaTinggalPetugas ?? (user as any)?.village?.name ?? '',
    ).trim();

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
        const included = (r as any).included;
        if (!base) return null;
        if (!base.eligible) return null;
        if (included === false) return null;
        const unitName =
          String((r as any).unitName ?? 'Dokumen').trim() || 'Dokumen';
        const totalDocs = Number(r.totalDocs ?? base.totalDocs);
        if (!Number.isFinite(totalDocs) || totalDocs <= 0) {
          throw new BadRequestException(
            `Jumlah satuan tidak valid untuk kegiatan "${base.activityName ?? '-'}".`,
          );
        }
        const unitCost = Number(base.unitCost ?? 0);
        if (!Number.isFinite(unitCost) || unitCost <= 0) {
          throw new BadRequestException(
            `Honor satuan belum diatur atau bernilai 0 untuk kegiatan "${base.activityName ?? '-'}".`,
          );
        }
        const totalCost = Number(unitCost * totalDocs);
        return {
          subSurveyActivityId: base.subSurveyActivityId,
          activityName: base.activityName,
          startDate: new Date(base.startDate),
          endDate: new Date(base.endDate),
          totalDocs,
          unitCost,
          totalCost,
          budgetCode: (base.budgetCode ?? '') as string,
          unitName,
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

    const resolvedNumbers = await this.resolveMonthlyDocNumbers({
      userId: input.userId,
      year: input.year,
      month: input.month,
      nomorSPK: input.nomorSPK,
      nomorBAST: input.nomorBAST,
    });

    const nomorSPK = String(resolvedNumbers.nomorSPK || '').trim();
    const nomorBAST = String(resolvedNumbers.nomorBAST || '').trim();

    const hariSpk = this.dayNameId(input.spkDocDate);
    const hariBast = this.dayNameId(input.bastDocDate);
    const namaBulanSpk = this.monthNameId(input.spkDocDate.getMonth() + 1);
    const namaBulanBast = this.monthNameId(input.bastDocDate.getMonth() + 1);
    const tanggalFormatSpk = this.formatDateId(input.spkDocDate);
    const tanggalSpk = input.spkDocDate.getDate();
    const tanggalTerbilangSpk = this.terbilang(tanggalSpk);

    const tanggalFormatBast = this.formatDateId(input.bastDocDate);
    const tanggalBast = input.bastDocDate.getDate();
    const tanggalTerbilangBast = this.terbilang(tanggalBast);
    const tahunTerbilang = this.terbilang(input.year);

    const tanggalMulai = minStart.getDate();
    const tanggalSelesai = maxEnd.getDate();

    const grandTotal = eligibleRows.reduce(
      (acc, r) => acc + (Number(r.totalCost) || 0),
      0,
    );

    if (!Number.isFinite(grandTotal) || grandTotal <= 0) {
      throw new BadRequestException(
        'Total honor tidak valid. Pastikan jumlah satuan dan honor satuan sudah benar.',
      );
    }

    const honorTotalAll = this.formatNumberID(grandTotal);
    const honorTotalAllTerbilang = this.terbilang(Math.floor(grandTotal));
    const honorTerbilang = `${honorTotalAllTerbilang} Rupiah`.trim();

    if (!honorTerbilang || honorTerbilang === 'Rupiah') {
      throw new BadRequestException(
        'honorTerbilang kosong. Periksa grandTotal dan template SPK.',
      );
    }

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
        satuan: r.unitName,
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
      satuan: r.unitName,
      bebanAnggaran: r.budgetCode || '',
    }));

    const commonBase = {
      namaPPK: input.ppkName,
      nipPPK: input.ppkNip,
      namaPetugas: petugasName,
      pekerjaanPetugas,
      desaTinggalPetugas,
      tahun: String(input.year),
      tahunTerbilang,
      tanggalMulai,
      tanggalSelesai,
    };

    const commonSpk = {
      ...commonBase,
      hariDokumen: hariSpk,
      tanggal: tanggalSpk,
      tanggalTerbilang: tanggalTerbilangSpk,
      bulan: namaBulanSpk,
      bulanCaps: String(namaBulanSpk || '').toUpperCase(),
      tanggalDokumen: tanggalFormatSpk,
    };

    const commonBast = {
      ...commonBase,
      hariDokumen: hariBast,
      tanggal: tanggalBast,
      tanggalTerbilang: tanggalTerbilangBast,
      bulan: namaBulanBast,
      bulanCaps: String(namaBulanBast || '').toUpperCase(),
      tanggalDokumen: tanggalFormatBast,
    };

    const spkTemplateRel = path.join('bast-spk', 'template-spk.docx');
    const bastTemplateRel = path.join('bast-spk', 'template-bast.docx');

    const spkBuffer = this.renderDocxTemplate(spkTemplateRel, {
      ...commonSpk,
      nomorLampiran: nomorSPK,
      nomorSPK,
      honorTotalAll,
      honorTotalAllTerbilang,
      honorTerbilang,
      rows: rowsSpk,
    });

    const bastBuffer = this.renderDocxTemplate(bastTemplateRel, {
      ...commonBast,
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
    ppkId: string;
    ppkName: string;
    ppkNip?: string;
    nomorSPK?: string;
    nomorBAST?: string;
    spkDocDate: Date;
    bastDocDate: Date;
    pekerjaanPetugas?: string;
    desaTinggalPetugas?: string;
    rows: Array<{
      subSurveyActivityId: string;
      totalDocs: number;
      unitName?: string;
      included?: boolean;
    }>;
  }) {
    const docType = String(input.docType || '').toUpperCase();

    const out = await this.generateMonthlyStaffDocs({
      userId: input.userId,
      month: input.month,
      year: input.year,
      ppkId: input.ppkId,
      ppkName: input.ppkName,
      ppkNip: input.ppkNip || '-',
      nomorSPK: input.nomorSPK,
      nomorBAST: input.nomorBAST,
      spkDocDate: input.spkDocDate,
      bastDocDate: input.bastDocDate,
      pekerjaanPetugas: input.pekerjaanPetugas,
      desaTinggalPetugas: input.desaTinggalPetugas,
      rows: input.rows,
    });
    return docType === 'BAST' ? out.bastUrl : out.spkUrl;
  }

  private async resolvePpkSnapshot(input: PpkSnapshotInput) {
    let ppkName = input.ppkName ?? '-';
    let ppkNip = input.ppkNip ?? '-';

    if (input.ppkUserId) {
      const ppk = await this.prisma.user.findUnique({
        where: { id: input.ppkUserId },
        select: { name: true, nip: true },
      });
      if (ppk) {
        ppkName = ppk.name ?? ppkName;
        ppkNip = (ppk as any).nip ?? ppkNip;
      }
    }

    return { ppkName, ppkNip };
  }

  private async upsertMonthlyAdminDocRecap(input: {
    userId: string;
    year: number;
    month: number;
    ppkUserId?: string | null;
    ppkName: string;
    ppkNip: string;
    nomorSPK: string;
    nomorBAST: string;
    rows: Array<{
      subSurveyActivityId: string;
      budgetCode?: string;
    }>;
  }) {
    const { ppkName, ppkNip } = await this.resolvePpkSnapshot({
      ppkUserId: input.ppkUserId ?? null,
      ppkName: input.ppkName ?? null,
      ppkNip: input.ppkNip ?? null,
    });
    const recap = await this.prisma.monthlyAdminDocRecap.upsert({
      where: {
        userId_year_month: {
          userId: input.userId,
          year: input.year,
          month: input.month,
        },
      },
      create: {
        userId: input.userId,
        year: input.year,
        month: input.month,
        ppkUserId: input.ppkUserId ?? null,
        ppkName,
        ppkNip,
        spkNumber: input.nomorSPK ?? null,
        bastNumber: input.nomorBAST ?? null,
      },
      update: {
        ppkUserId: input.ppkUserId ?? null,
        ppkName,
        ppkNip,
        spkNumber: input.nomorSPK ?? null,
        bastNumber: input.nomorBAST ?? null,
      },
    });

    for (const r of input.rows) {
      await this.prisma.monthlyAdminDocRecapItem.upsert({
        where: {
          recapId_subSurveyActivityId: {
            recapId: recap.id,
            subSurveyActivityId: r.subSurveyActivityId,
          },
        },
        create: {
          recapId: recap.id,
          subSurveyActivityId: r.subSurveyActivityId,
        },
        update: {},
      });
    }

    return recap;
  }

  async getMonthlyAdminDocRecapByUserMonth(
    userId: string,
    year: number,
    month: number,
  ) {
    return this.prisma.monthlyAdminDocRecap.findUnique({
      where: { userId_year_month: { userId, year, month } },
      include: {
        ppkUser: { select: { id: true, name: true, nip: true } },
      },
    });
  }

  async updateSubSurveyActivityStatus(
    subSurveyActivityId: string,
    status: any,
  ) {
    return this.prisma.subSurveyActivity.update({
      where: { id: subSurveyActivityId },
      data: { status },
    });
  }
}
