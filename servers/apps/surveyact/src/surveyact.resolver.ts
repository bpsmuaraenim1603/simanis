import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { SurveyActivityService } from './surveyacts.service';
import {
  ContentIssueType,
  DistrictType,
  IssueCommentType,
  JobLetterType,
  MonthlyStatsType,
  SubmitSPJType,
  SubSurveyActivityType,
  SubSurveyProgressType,
  SurveyActivityType,
  UserProgressType,
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
  UpdateContentIssueDto,
  updateIssueCommentDto,
  UpdateJobLetterStatusDTO,
  UpdateSPJStatusDTO,
  UpdateSubSurveyActivityDTO,
  UpdateSurveyActivityDTO,
  UpdateUserProgressDTO,
} from './dto/surveyact.dto';
import { User } from 'apps/users/src/entities/users.entity';
import {
  IssueStatus,
  JobLetter,
  SubmitSPJ,
  UserProgress,
} from '@prisma/client';
import { UserType } from 'apps/users/src/types/users.types';
import { NotFoundException } from '@nestjs/common';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';

@Resolver(() => SurveyActivityType)
export class SurveyActivityResolver {
  constructor(private readonly service: SurveyActivityService) {}

  @Query(() => SurveyActivityType, { name: 'surveyActivityBySlug' })
  async surveyActivityBySlug(@Args('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Query(() => [SurveyActivityType], { name: 'allSurveyActivities' })
  async allSurveyActivities() {
    return this.service.findAll();
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
  ) {
    return this.service.findSubSurveyActivityTypeBySurveyActivityId(
      surveyActivityId,
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
  async createUserSurveyProgress(@Args('input') input: CreateUserProgressDTO) {
    return this.service.createUserSurveyProgress(input);
  }

  @ResolveField(() => UserType, { nullable: true })
  async user(@Parent() progress: UserProgress): Promise<UserType | null> {
    const userId = progress.userId;
    try {
      // Ambil data user dari microservice lain (misalnya HTTP)
      return await this.service.getUser(userId);
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
  async userProgressSurveyBySupervisorId(@Args('superVisorId') superVisorId: string) {
    return this.service.getAllUserSurveyProgressBySVID(superVisorId);
  }

  @Query(() => [UserProgressType])
  async allUserSurveyProgress() {
    return this.service.getAllUserSurveyProgress();
  }

  @Mutation(() => UserProgressType)
  async updateUserSurveyProgress(
    @Args('userProgressId') userProgressId: string,
    @Args('input') input: UpdateUserProgressDTO,
  ) {
    return this.service.updateUserProgress(userProgressId, input);
  }

  @Mutation(() => DistrictType)
  async createDistrict(@Args('input') input: CreateDistrictDTO) {
    return this.service.createDistrict(input);
  }

  @Query(() => [DistrictType], { name: 'allDistricts' })
  async allDistricts() {
    return this.service.getAllDistricts();
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
  ): Promise<SubmitSPJ> {
    return this.service.updateSPJStatus(input);
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
  ): Promise<JobLetter> {
    return this.service.updateJobLetterStatus(input);
  }

  @Query(() => [SubSurveyProgressType], { name: 'getAllSubSurveyProgress' })
  async getAllSubSurveyProgress(): Promise<SubSurveyProgressType[]> {
    return this.service.getAllSubSurveyProgress();
  }

  @Query(() => MonthlyStatsType)
  getMonthlySurveyStats() {
    return this.service.getMonthlySurveyStats();
  }

  @Query(() => [DistrictType])
  async getAllSurveyDistrict() {
    return this.service.allDistricts();
  }

  @Mutation(() => ContentIssueType)
  async createContentIssue(@Args('input') input: CreateContentIssueDto) {
    // idealnya reporterId diambil dari context auth
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
    // idealnya userId dari context auth
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
}
