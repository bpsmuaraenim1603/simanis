import { Injectable, NotFoundException } from '@nestjs/common';
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
import { IssueStatus, JobLetter, SubmitSPJ, User } from '@prisma/client';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import {
  SubSurveyActivityType,
  SubSurveyProgressType,
} from './types/surveyact.types';

@Injectable()
export class SurveyActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
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
    return this.prisma.userProgress.create({
      data: input,
    });
  }

  async getUser(userId: string) {
    const response$ = this.httpService.get(
      `http://localhost:4001/users/${userId}`,
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
        user: true, // Include user data if needed
        subSurveyActivity: true,
        district: true,
      },
    });
  }

  async getUserProgressSurveyByUserId(userId: string) {
    return this.prisma.userProgress.findMany({
      where: { userId },
      include: {
        user: true, // Include user data if needed
        subSurveyActivity: true,
        district: true,
      },
    });
  }

  async getAllUserSurveyProgress() {
    return this.prisma.userProgress.findMany({
      include: {
        user: true, // Include user data if needed
        subSurveyActivity: true,
      },
    });
  }

  async updateUserProgress(
    userProgressId: string,
    updateData: UpdateUserProgressDTO,
  ) {
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value != null),
    );

    return this.prisma.userProgress.update({
      where: { id: userProgressId },
      data: cleanedData,
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

  async createSPJ(input: CreateSPJDTO): Promise<SubmitSPJ> {
    return this.prisma.submitSPJ.create({
      data: {
        userId: input.userId,
        subSurveyActivityId: input.subSurveyActivityId,
        eviDocumentUrl: input.eviDocumentUrl || null,
      },
    });
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

  async createJobLetter(input: CreateJobLetterDTO): Promise<JobLetter> {
    return this.prisma.jobLetter.create({
      data: {
        userId: input.userId,
        subSurveyActivityId: input.subSurveyActivityId,
        region: input.region,
        eviFieldUrl: input.eviFieldUrl,
        eviSTUrl: input.eviSTUrl,
        submitDate: input.submitDate,
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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const subSurveys = await this.prisma.subSurveyActivity.findMany({
      where: {
        startDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        UserProgress: true,
      },
    });

    const result = subSurveys.map((subSurvey) => {
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
      const Name = subSurvey.name;
      const SubSurveyId = subSurvey.id;

      return {
        startDate: subSurvey.startDate,
        endDate: subSurvey.endDate,
        targetSample: subSurvey.targetSample,
        sampleType: subSurvey.sampleType,
        totalPetugas,
        submitCount,
        approvedCount,
        rejectedCount,
        Name,
        subSurveyActivityId: SubSurveyId,
      };
    });

    return result;
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
                { reporter: { name: { contains: search, mode: 'insensitive' } } },
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
        _count: { select: { IssueComment: true } },
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
}
