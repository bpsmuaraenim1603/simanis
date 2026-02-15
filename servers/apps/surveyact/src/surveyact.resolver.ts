import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SurveyActivityService } from './surveyacts.service';
import {
  ContentIssueType,
  DistrictType,
  IssueCommentType,
  JobLetterType,
  MonthlyActivityStaffUsageRowType,
  MonthlyStaffDocPreviewRowType,
  MonthlyStaffDocsOutputType,
  MonthlyStatsType,
  StaffYearlyExportRowType,
  SubmitSPJType,
  SubSurveyActivityType,
  SubSurveyProgressType,
  SurveyActivityType,
  UserProgressType,
  UserSampleType,
  ExportUserSamplePhotosResult,
  VillageType,
} from './types/surveyact.types';
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
  GenerateMonthlyStaffDocInput,
  GenerateMonthlyStaffDocsInput,
  UpdateSubSurveyActivityStatusDTO,
} from './dto/surveyact.dto';

import {
  IssueStatus,
  JobLetter,
  SubmitSPJ,
  UserProgress,
  Role,
  SubSurveyStatus
} from '@prisma/client';
import { UserType } from 'apps/users/src/types/users.types';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { DeleteByIdInput, DeleteResult } from './dto/delete.input';
import { BulkUserProgressResult } from './dto/bulk-userprogress.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@Resolver(() => SurveyActivityType)
export class SurveyActivityResolver {
  constructor(private readonly service: SurveyActivityService) {}

  @Query(() => SurveyActivityType, { name: 'surveyActivityBySlug' })
  async surveyActivityBySlug(@Args('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Query(() => [SurveyActivityType], { name: 'allSurveyActivities' })
  async allSurveyActivities(@Context() ctx: any) {
    const actor = ctx?.req?.user;
    return this.service.findAll(actor);
  }

  @Mutation(() => SurveyActivityType)
  async createSurveyActivity(@Args('input') input: CreateSurveyActivityDTO) {
    return this.service.create(input);
  }

  @Mutation(() => SurveyActivityType)
  async updateSurveyActivity(
    @Args('surveyActivityId') surveyActivityId: string,
    @Args('input') input: UpdateSurveyActivityDTO,
  ) {
    return this.service.update(surveyActivityId, input);
  }

  @Mutation(() => SubSurveyActivityType)
  async createSubSurveyActivity(
    @Args('input') input: CreateSubSurveyActivityDTO,
  ) {
    return this.service.createSubSurveyActivity(input);
  }

  @Mutation(() => SubSurveyActivityType)
  async updateSubSurveyActivity(
    @Args('subSurveyActivityId') subSurveyActivityId: string,
    @Args('input') input: UpdateSubSurveyActivityDTO,
  ) {
    return this.service.updateSubSurveyActivity(subSurveyActivityId, input);
  }

  @Query(() => [SubSurveyActivityType])
  async subSurveyActivityById(
    @Args('surveyActivityId') surveyActivityId: string,
    @Context() ctx: any,
  ) {
    const actor = ctx?.req?.user;
    return this.service.findSubSurveyActivityTypeBySurveyActivityId(
      surveyActivityId,
      actor,
    );
  }

  @Query(() => [SubSurveyActivityType], { name: 'allSubSurveyActivities' })
  async allSubSurveyActivities() {
    return this.service.findAllSubSurveyActivity();
  }

  @Query(() => SubSurveyActivityType, { name: 'subSurveyActivityBySlug' })
  async subSurveyActivityBySlug(@Args('slug') slug: string) {
    return this.service.findSubSurveyActivityBySlug(slug);
  }

  @Mutation(() => UserProgressType)
  async createUserSurveyProgress(
    @Args('input') input: CreateUserProgressDTO,
    @Context() ctx: any,
  ) {
    const actorId = ctx?.req?.user?.id;
    return this.service.createUserSurveyProgress(input, actorId);
  }

  @ResolveField(() => [UserSampleType], { name: 'samples' })
  async getSamples(@Parent() progress: UserProgress) {
    return this.service.getSamplesByUserProgressId(progress.id);
  }

  @ResolveField(() => UserType, { nullable: true })
  async user(@Parent() progress: UserProgress): Promise<UserType | null> {
    const userId = progress.userId;
    try {
      return await this.service.getUser(userId);
    } catch (e) {
      return null;
    }
  }

  @ResolveField(() => UserType, { nullable: true })
  async superVisor(@Parent() progress: UserProgress): Promise<UserType | null> {
    const superVisorId = progress.superVisorId;
    if (!superVisorId) return null;
    try {
      return await this.service.getUser(superVisorId);
    } catch (e) {
      return null;
    }
  }

  @ResolveField(() => UserType, { nullable: true })
  async userAdministrator(@Parent() spj: SubmitSPJ): Promise<UserType> {
    return this.service.getUser(spj.userId);
  }

  @ResolveField(() => UserType, { nullable: true })
  async userJobLetter(@Parent() jobLetter: JobLetter): Promise<UserType> {
    return this.service.getUser(jobLetter.userId);
  }

  @Query(() => SubSurveyProgressType)
  async subSurveyProgress(
    @Args('subSurveyActivityId') subSurveyActivityId: string,
  ) {
    return this.service.getSubSurveyProgress(subSurveyActivityId);
  }

  @Query(() => [UserProgressType])
  async userProgressBySubSurveyActivityId(
    @Args('subSurveyActivityId') subSurveyActivityId: string,
  ) {
    return this.service.getUserProgressBySubSurveyActivityId(
      subSurveyActivityId,
    );
  }

  @Query(() => [UserProgressType])
  async userProgressSurveyByUserId(@Args('userId') userId: string) {
    return this.service.getUserProgressSurveyByUserId(userId);
  }

  @Query(() => [UserProgressType])
  async userProgressSurveyBySupervisorId(
    @Args('superVisorId') superVisorId: string,
  ) {
    return this.service.getAllUserSurveyProgressBySVID(superVisorId);
  }

  @Query(() => [UserProgressType])
  async allUserSurveyProgress() {
    return this.service.getAllUserSurveyProgress();
  }

  @Mutation(() => UserProgressType)
  async updateUserSurveyProgress(
    @Args('input') input: UpdateUserProgressDTO,
    @Context() ctx: any,
  ) {
    const actorId = ctx?.req?.user?.id;
    return this.service.updateUserProgress(input, actorId);
  }

  @Mutation(() => UserProgressType)
  patchUserSamples(
    @Args('input') input: PatchUserSamplesDTO,
    @Context() ctx: any,
  ) {
    const actorId = ctx?.req?.user?.id;
    return this.service.patchUserSamples(input, actorId);
  }

  @Mutation(() => ExportUserSamplePhotosResult)
  async exportUserSamplePhotos(
    @Args('userProgressId') userProgressId: string,
    @Context() ctx: any,
  ) {
    const actorId = ctx?.req?.user?.id as string | undefined;
    return this.service.exportUserSamplePhotos(userProgressId, actorId);
  }

  @Mutation(() => String)
  async uploadSurveySamplePhoto(
    @Args('sampleId') sampleId: string,
    @Args({ name: 'file', type: () => GraphQLUpload })
    file: Promise<FileUpload>,
  ) {
    const upload = await file;
    return this.service.uploadUserSamplePhoto(sampleId, upload);
  }

  @Mutation(() => DistrictType)
  async createDistrict(@Args('input') input: CreateDistrictDTO) {
    return this.service.createDistrict(input);
  }

  @Public()
  @Query(() => [DistrictType], { name: 'allDistricts' })
  async allDistricts() {
    return this.service.getAllDistricts();
  }

  @Mutation(() => VillageType)
  async createVillage(@Args('input') input: CreateVillageDTO) {
    return this.service.createVillage(input);
  }

  @Public()
  @Query(() => [VillageType])
  async villagesByDistrict(
    @Args('districtId', { type: () => ID }) districtId: string,
  ) {
    return this.service.getVillagesByDistrict(districtId);
  }

  @Public()
  @Query(() => [VillageType], { name: 'allVillages' })
  async allVillages() {
    return this.service.getAllVillages();
  }

  @Mutation(() => SubmitSPJType)
  async createSPJ(
    @Args('input') input: CreateSPJDTO,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file?: Promise<FileUpload>,
  ) {
    const upload = file ? await file : undefined;
    return this.service.createSPJ(input, upload);
  }

  @Query(() => [SubmitSPJType])
  async getAllSPJ() {
    return this.service.getAllSPJ();
  }

  @Mutation(() => SubmitSPJType)
  async updateSPJStatus(
    @Args('input') input: UpdateSPJStatusDTO,
    @Context() ctx: any,
  ): Promise<SubmitSPJ> {
    const actorId = ctx?.req?.user?.id;
    return this.service.updateSPJStatus(input, actorId);
  }

  @Mutation(() => JobLetterType)
  async createJobLetter(
    @Args('input') input: CreateJobLetterDTO,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file?: Promise<FileUpload>,
  ): Promise<JobLetterType> {
    const upload = file ? await file : undefined;
    return this.service.createJobLetter(input, upload);
  }

  @Query(() => [JobLetterType])
  async getAllJobLetters() {
    return this.service.getAllJobLetters();
  }

  @Mutation(() => JobLetterType)
  async updateJobLetterStatus(
    @Args('input') input: UpdateJobLetterStatusDTO,
    @Context() ctx: any,
  ): Promise<JobLetter> {
    const actorId = ctx?.req?.user?.id;
    return this.service.updateJobLetterStatus(input, actorId);
  }

  @Query(() => [SubSurveyProgressType], { name: 'getAllSubSurveyProgress' })
  async getAllSubSurveyProgress(
    @Context() ctx: any,
  ): Promise<SubSurveyProgressType[]> {
    const actor = ctx?.req?.user;
    return this.service.getAllSubSurveyProgress(actor);
  }

  @Query(() => MonthlyStatsType)
  getMonthlySurveyStats(
    @Args('subSurveyActivityId', { type: () => ID, nullable: true })
    subSurveyActivityId?: string,
  ) {
    return this.service.getMonthlySurveyStats(subSurveyActivityId);
  }

  @Query(() => [MonthlyActivityStaffUsageRowType])
  getMonthlyActivityStaffUsage(
    @Args('year', { type: () => Int }) year: number,
    @Context() ctx: any,
  ) {
    const actor = ctx?.req?.user;
    return this.service.getMonthlyActivityStaffUsage(year, actor);
  }
  @Query(() => [MonthlyStaffDocPreviewRowType])
  getMonthlyStaffDocPreview(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('month', { type: () => Int }) month: number,
    @Args('year', { type: () => Int }) year: number,
  ) {
    return this.service.getMonthlyStaffDocPreview(userId, month, year);
  }

  @Mutation(() => String)
  generateMonthlyStaffDoc(@Args('input') input: GenerateMonthlyStaffDocInput) {
    return this.service.generateMonthlyStaffDoc(input);
  }

  @Mutation(() => MonthlyStaffDocsOutputType)
  generateMonthlyStaffDocs(
    @Args('input') input: GenerateMonthlyStaffDocsInput,
  ) {
    return this.service.generateMonthlyStaffDocs(input);
  }

  @Query(() => [StaffYearlyExportRowType])
  getStaffYearlyExport(@Args('year', { type: () => Int }) year: number) {
    return this.service.getStaffYearlyExport(year);
  }

  @Mutation(() => ContentIssueType)
  async createContentIssue(@Args('input') input: CreateContentIssueDto) {
    return this.service.createContentIssue(input);
  }

  @Query(() => ContentIssueType)
  async contentIssueById(@Args('id', { type: () => ID }) id: string) {
    return this.service.getContentIssueById(id);
  }

  @Query(() => [ContentIssueType])
  async contentIssues(
    @Args('subSurveyActivityId', { type: () => ID, nullable: true })
    subSurveyActivityId?: string,
    @Args('status', { type: () => IssueStatus, nullable: true })
    status?: IssueStatus,
    @Args('search', { nullable: true }) search?: string,
    @Args('skip', { nullable: true }) skip?: number,
    @Args('take', { nullable: true }) take?: number,
  ) {
    return this.service.listContentIssues({
      subSurveyActivityId,
      status,
      search,
      skip,
      take,
    });
  }

  @Mutation(() => ContentIssueType)
  async updateContentIssue(@Args('input') input: UpdateContentIssueDto) {
    return this.service.updateContentIssue(input);
  }

  @Mutation(() => IssueCommentType)
  async addIssueComment(@Args('input') input: createIssueCommentDto) {
    return this.service.addIssueComment(input);
  }

  @Mutation(() => IssueCommentType)
  async updateIssueComment(@Args('input') input: updateIssueCommentDto) {
    return this.service.updateIssueComment(input);
  }

  @Query(() => [IssueCommentType])
  async issueCommentsByContent(
    @Args('contentId', { type: () => ID }) contentId: string,
  ) {
    return this.service.listIssueCommentsByContent(contentId);
  }

  @Mutation(() => DeleteResult)
  async deleteSurveyActivity(
    @Args('input') input: DeleteByIdInput,
  ): Promise<DeleteResult> {
    return this.service.deleteSurveyActivity(input);
  }

  @Mutation(() => DeleteResult)
  async deleteSubSurveyActivity(
    @Args('input') input: DeleteByIdInput,
  ): Promise<DeleteResult> {
    return this.service.deleteSubSurveyActivity(input);
  }

  @Mutation(() => DeleteResult)
  async deleteUserSurveyProgress(
    @Args('input') input: DeleteByIdInput,
  ): Promise<DeleteResult> {
    return this.service.deleteUserSurveyProgress(input);
  }

  @Mutation(() => DeleteResult)
  async deleteJobLetter(
    @Args('input') input: DeleteByIdInput,
  ): Promise<DeleteResult> {
    return this.service.deleteJobLetter(input);
  }

  @Mutation(() => DeleteResult)
  async deleteSubmitSPJ(
    @Args('input') input: DeleteByIdInput,
  ): Promise<DeleteResult> {
    return this.service.deleteSubmitSPJ(input);
  }

  @Mutation(() => BulkUserProgressResult)
  async bulkImportUserProgressExcel(
    @Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload,
  ): Promise<BulkUserProgressResult> {
    const chunks: Buffer[] = [];
    const stream = file.createReadStream();

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (d) =>
        chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)),
      );
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);

    const res = await this.service.bulkImportUserProgressFromFile(buffer);

    return {
      insertedPetugas: res.insertedPetugas,
      updatedPetugas: res.updatedPetugas,
      insertedPengawas: res.insertedPengawas,
      updatedPengawas: res.updatedPengawas,
      errors: res.errors,
    };
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Keuangan)
  @Mutation(() => SubSurveyActivityType)
  async updateSubSurveyActivityStatus(
    @Args('input') input: UpdateSubSurveyActivityStatusDTO,
  ) {
    return this.service.updateSubSurveyActivityStatus(
      input.subSurveyActivityId,
      input.status,
    );
  }
}

@Resolver(() => UserSampleType)
export class UserSampleResolver {
  constructor(private readonly service: SurveyActivityService) {}

  @ResolveField(() => String, { name: 'photoSignedUrl', nullable: true })
  async photoSignedUrl(@Parent() sample: any) {
    return this.service.getSamplePhotoSignedUrl(sample.photoPath ?? null);
  }
}
