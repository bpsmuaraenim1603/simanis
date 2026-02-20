import {
  InputType,
  Field,
  ID,
  registerEnumType,
  GraphQLISODateTime,
  ObjectType,
  Int,
  Float,
} from '@nestjs/graphql';
import {
  AgreeState,
  CacahStatus,
  IssueStatus,
  StatusST,
  SubSurveyStatus,
} from '@prisma/client';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

registerEnumType(AgreeState, {
  name: 'AgreeState',
});

registerEnumType(StatusST, {
  name: 'StatusST',
});

registerEnumType(SubSurveyStatus, {
  name: 'SubSurveyStatus',
});

@InputType()
export class PatchUserSampleInput {
  @Field()
  id: string;

  @Field(() => CacahStatus, { nullable: true })
  cacahStatus?: CacahStatus;

  @Field(() => AgreeState, { nullable: true })
  approvalStatus?: AgreeState;

  @Field({ nullable: true })
  identity?: string;

  @Field({ nullable: true })
  geoLat?: number;

  @Field({ nullable: true })
  geoLng?: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  geoCapturedAt?: Date;

  @Field({ nullable: true })
  photoPath?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  photoCapturedAt?: Date;
}

@InputType()
export class PatchUserSamplesDTO {
  @Field()
  userProgressId: string;

  @Field(() => [PatchUserSampleInput], { nullable: true })
  updateSamples?: PatchUserSampleInput[];

  @Field(() => [UserSampleInput], { nullable: true })
  createSamples?: UserSampleInput[];

  @Field(() => [String], { nullable: true })
  deleteSampleIds?: string[];
}

@InputType()
export class CreateSurveyActivityDTO {
  @Field()
  @IsNotEmpty({ message: 'Nama kategori survei wajib diisi' })
  @IsString()
  name: string;

  @Field()
  @IsNotEmpty({ message: 'Slug wajib diisi' })
  @IsString()
  slug: string;

  @Field()
  @IsNotEmpty({ message: 'Ketua Tim wajib diisi' })
  @IsString()
  chiefId: string;
}

@InputType()
export class UpdateSurveyActivityDTO {
  @Field()
  @IsNotEmpty({ message: 'Nama kategori survei wajib diisi' })
  @IsString()
  name: string;

  @Field()
  @IsNotEmpty({ message: 'Slug wajib diisi' })
  @IsString()
  slug: string;

  @Field()
  @IsNotEmpty({ message: 'Ketua Tim wajib diisi' })
  @IsString()
  chiefId: string;
}

@InputType()
export class CreateSubSurveyActivityDTO {
  @Field()
  name: string;

  @Field()
  slug: string;

  @Field()
  surveyActivityId: string;

  @Field()
  startDate: Date;

  @Field()
  endDate: Date;

  @Field()
  targetSample: number;

  @Field()
  sampleType: string;

  @Field()
  activityType: string;


  @Field({ nullable: true })
  budgetCode?: string;

  @Field({ nullable: true })
  unitWorkPrice?: number;
}

@InputType()
export class UpdateSubSurveyActivityDTO {
  @Field()
  name: string;

  @Field()
  slug: string;

  @Field()
  surveyActivityId: string;

  @Field()
  startDate: Date;

  @Field()
  endDate: Date;

  @Field()
  targetSample: number;

  @Field()
  sampleType: string;

  @Field()
  activityType: string;


  @Field({ nullable: true })
  budgetCode?: string;

  @Field({ nullable: true })
  unitWorkPrice?: number;

  @Field({ nullable: true })
  status?: 'BERJALAN' | 'SELESAI';
}

@InputType()
export class CreateUserProgressDTO {
  @Field()
  subSurveyActivityId: string;

  @Field()
  userId: string;

  @Field()
  superVisorId: string;

  @Field({ nullable: true })
  totalAssigned?: number;

  @Field({ nullable: true })
  submitCount?: number;

  @Field({ nullable: true })
  approvedCount?: number;

  @Field({ nullable: true })
  rejectedCount?: number;

  @Field({ nullable: true })
  blockCount?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastUpdated?: Date;

  @Field({ nullable: true })
  districtId?: string;

  @Field({ nullable: true })
  villageId?: string;

  @Field({ nullable: true })
  docsBill?: string;

  @Field({ nullable: true })
  docsBillPengawas?: string;

  @Field(() => [UserSampleInput], { nullable: true })
  samples?: UserSampleInput[];
}

@InputType()
export class UserSampleInput {
  @Field({ nullable: true })
  id?: string;

  @Field()
  nus: string;

  @Field()
  identity: string;

  @Field(() => CacahStatus, { defaultValue: CacahStatus.Belum_Cacah })
  cacahStatus: CacahStatus;

  @Field(() => AgreeState, { defaultValue: AgreeState.Menunggu })
  approvalStatus: AgreeState;

  @Field({ nullable: true })
  geoLat?: number;

  @Field({ nullable: true })
  geoLng?: number;

  @Field({ nullable: true })
  geoCapturedAt?: Date;
}

@InputType()
export class UpdateUserProgressDTO {
  @Field()
  id: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  superVisorId?: string;

  @Field({ nullable: true })
  blockCount?: string;

  @Field({ nullable: true })
  districtId?: string;

  @Field({ nullable: true })
  villageId?: string;

  @Field({ nullable: true })
  docsBill?: string;

  @Field({ nullable: true })
  totalAssigned?: number;

  @Field({ nullable: true })
  submitCount?: number;

  @Field({ nullable: true })
  approvedCount?: number;

  @Field({ nullable: true })
  rejectedCount?: number;

  @Field(() => [UserSampleInput], { nullable: true })
  samples?: UserSampleInput[];

  @Field(() => [String], { nullable: true })
  deleteSampleIds?: string[];
}

@InputType()
export class CreateDistrictDTO {
  @Field()
  city: string;

  @Field()
  name: string;

  @Field()
  coderegion: string;
}

@InputType()
export class CreateVillageDTO {
  @Field()
  name: string;

  @Field()
  coderegion: string;

  @Field(() => ID)
  districtId: string;
}

@InputType()
export class CreateSPJDTO {
  @Field(() => ID)
  @IsUUID()
  userId: string;

  @Field(() => ID)
  @IsUUID()
  subSurveyActivityId: string;

  @Field({ nullable: true })
  verifyNote?: string;
}

@InputType()
export class UpdateSPJStatusDTO {
  @Field(() => ID)
  id: string;

  @Field(() => AgreeState)
  status: AgreeState;

  @Field({ nullable: true })
  verifyNote?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  approveDate?: string;
}

@InputType()
export class CreateJobLetterDTO {
  @Field(() => ID)
  @IsUUID()
  userId: string;

  @Field(() => ID)
  @IsUUID()
  subSurveyActivityId: string;

  @Field()
  @IsString()
  region: string;

  @Field(() => GraphQLISODateTime)
  submitDate: string;

  @Field({ nullable: true })
  @IsString()
  eviFieldUrl?: string;

  @Field({ nullable: true })
  @IsString()
  eviSTUrl?: string;
}

@InputType()
export class UpdateJobLetterStatusDTO {
  @Field(() => ID)
  id: string;

  @Field(() => AgreeState)
  status: AgreeState;

  @Field({ nullable: true })
  rejectNote?: string;
}

@InputType()
export class CreateContentIssueDto {
  @Field()
  @IsString()
  content: string;

  @Field(() => ID)
  @IsUUID()
  reporterId: string;

  @Field(() => ID)
  @IsUUID()
  subSurveyActivityId: string;

  @Field(() => IssueStatus)
  issueStatus: IssueStatus;
}

@InputType()
export class UpdateContentIssueDto {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field()
  @IsString()
  content: string;

  @Field(() => IssueStatus)
  issueStatus: IssueStatus;
}

@InputType()
export class createIssueCommentDto {
  @Field()
  @IsString()
  message: string;

  @Field(() => ID)
  @IsUUID()
  contentId: string;

  @Field(() => ID)
  @IsUUID()
  userId: string;

  @Field(() => ID)
  @IsUUID()
  subSurveyActivityId: string;
}

@InputType()
export class updateIssueCommentDto {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field()
  @IsString()
  message: string;
}

@InputType()
export class MonthlyStaffDocRowInput {
  @Field(() => ID)
  subSurveyActivityId: string;

  @Field(() => Int)
  totalDocs: number;

  @Field({ nullable: true })
  unitName?: string;

  @Field({ nullable: true })
  included?: boolean;
}

@InputType()
export class GenerateMonthlyStaffDocInput {
  @Field(() => ID)
  userId: string;

  @Field(() => Int)
  month: number;

  @Field(() => Int)
  year: number;

  @Field()
  docType: string;

  @Field(() => ID, { nullable: true })
  ppkUserId?: string;

  @Field({ nullable: true })
  ppkName?: string;

  @Field({ nullable: true })
  ppkNip?: string;

  @Field({ nullable: true })
  nomorBAST?: string;

  @Field({ nullable: true })
  nomorSPK?: string;

  @Field(() => GraphQLISODateTime)
  spkDocDate: Date;

  @Field(() => GraphQLISODateTime)
  bastDocDate: Date;

  @Field(() => [MonthlyStaffDocRowInput])
  rows: MonthlyStaffDocRowInput[];
}

@InputType()
export class GenerateMonthlyStaffDocsInput {
  @Field(() => ID)
  userId: string;

  @Field(() => Int)
  month: number;

  @Field(() => Int)
  year: number;

  @Field(() => ID, { nullable: true })
  ppkUserId?: string;

  @Field({ nullable: true })
  ppkName?: string;

  @Field({ nullable: true })
  ppkNip?: string;

  @Field({ nullable: true })
  nomorSPK?: string;

  @Field({ nullable: true })
  nomorBAST?: string;

  @Field(() => GraphQLISODateTime)
  spkDocDate: Date;

  @Field(() => GraphQLISODateTime)
  bastDocDate: Date;

  @Field({ nullable: true })
  pekerjaanPetugas?: string;

  @Field({ nullable: true })
  desaTinggalPetugas?: string;

  @Field(() => [MonthlyStaffDocRowInput])
  rows: MonthlyStaffDocRowInput[];
}

@InputType()
export class UpdateSubSurveyActivityStatusDTO {
  @Field(() => String)
  subSurveyActivityId: string;

  @Field(() => SubSurveyStatus)
  status: SubSurveyStatus;
}