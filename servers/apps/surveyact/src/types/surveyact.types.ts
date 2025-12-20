import {
  ObjectType,
  Field,
  ID,
  Int,
  registerEnumType,
  GraphQLISODateTime,
  Float,
} from '@nestjs/graphql';
import {
  AgreeState,
  CacahStatus,
  IssueStatus,
  StatusST,
} from '@prisma/client';
import { UserType } from 'apps/users/src/types/users.types';

registerEnumType(AgreeState, {
  name: 'AgreeState', // ini akan muncul di GraphQL schema
});

registerEnumType(StatusST, {
  name: 'StatusST',
});

registerEnumType(IssueStatus, {
  name: 'IssueStatus', // akan muncul di GraphQL schema
});

registerEnumType(CacahStatus, { name: 'CacahStatus' });

@ObjectType()
export class SurveyActivityType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;
}

@ObjectType()
export class DistrictType {
  @Field(() => ID)
  id: string;

  @Field()
  city: string;

  @Field()
  name: string;
}

@ObjectType()
export class SubSurveyActivityType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field(() => ID)
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
}

@ObjectType()
export class UserProgressType {
  @Field(() => ID)
  id: string;

  @Field(() => UserType, { nullable: true })
  user?: UserType;

  @Field(() => ID)
  userId: string;

  @Field(() => ID)
  superVisorId: string;

  @Field(() => UserType, { nullable: true })
  superVisor?: UserType;

  @Field(() => ID)
  subSurveyActivityId: string;

  @Field(() => SubSurveyActivityType, { nullable: true })
  subSurveyActivity?: SubSurveyActivityType;

  @Field(() => ID)
  districtId: string;

  @Field(() => DistrictType, { nullable: true })
  district?: DistrictType;

  @Field()
  totalAssigned: number;

  @Field()
  submitCount: number;

  @Field()
  approvedCount: number;

  @Field()
  rejectedCount: number;

  @Field({ nullable: true })
  blockCount?: string;
  
  @Field({ nullable: true })
  villageName?: string;

  @Field({ nullable: true })
  travelBill?: string;

  @Field(() => [UserSampleType], { nullable: 'itemsAndList' })
  samples?: UserSampleType[];

  @Field()
  lastUpdated: Date;
}

@ObjectType()
export class UserSampleType {
  @Field(() => ID)
  id: string;

  @Field()
  nus: string;

  @Field()
  identity: string;

  @Field(() => CacahStatus)
  cacahStatus: CacahStatus;

  @Field(() => AgreeState)
  approvalStatus: AgreeState;

  @Field({ nullable: true })
  geoLat?: number;

  @Field({ nullable: true })
  geoLng?: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  geoCapturedAt?: Date;
}


@ObjectType()
export class SubSurveyProgressType {
  @Field(() => String)
  name: string;

  @Field(() => ID)
  subSurveyActivityId: string;

  @Field(() => Date, { nullable: true })
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  endDate?: Date;

  @Field(() => Int, { nullable: true })
  targetSample?: number;

  @Field(() => Int)
  totalPetugas: number;

  @Field(() => Int)
  submitCount: number;

  @Field(() => Int)
  approvedCount: number;

  @Field(() => Int)
  rejectedCount: number;

  @Field(() => String)
  sampleType: string;

  @Field(() => String)
  activityType: string;

  @Field(() => [String], { nullable: true })
  district?: string[];
}

@ObjectType()
export class SubmitSPJType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  userId!: string;

  @Field(() => UserType, { nullable: true })
  user?: UserType;

  @Field(() => String)
  subSurveyActivityId!: string;

  @Field(() => SubSurveyActivityType)
  subSurveyActivity?: SubSurveyActivityType;

  @Field(() => String, { nullable: true })
  verifyNote!: string | null;

  @Field(() => String)
  submitState!: string;

  @Field(() => GraphQLISODateTime)
  submitDate!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  approveDate!: Date | null;

  @Field(() => String, { nullable: true })
  eviDocumentPath!: string | null;

  @Field(() => String, { nullable: true })
  eviOriginalName!: string | null;

  @Field(() => String, { nullable: true })
  eviMimeType!: string | null;

  @Field(() => Number, { nullable: true })
  eviSize!: number | null;

  @Field(() => String, { nullable: true })
  eviDocumentSignedUrl?: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  updatedAt!: Date | null;
}

@ObjectType()
export class JobLetterType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  userId!: string;

  @Field(() => String)
  subSurveyActivityId!: string;

  @Field(() => String)
  region!: string;

  @Field(() => GraphQLISODateTime)
  submitDate!: Date | null;

  @Field(() => String)
  agreeState!: string;

  @Field(() => String, { nullable: true })
  rejectNote!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  approveDate!: Date | null;

  @Field(() => String, { nullable: true })
  eviLetterPath!: string | null;

  @Field(() => String, { nullable: true })
  eviLetterSignedUrl?: string | null;

  @Field(() => String, { nullable: true })
  eviFieldUrl!: string | null;

  @Field(() => String, { nullable: true })
  eviSTUrl!: string | null;

  @Field(() => UserType, { nullable: true })
  user?: UserType;

  @Field(() => SubSurveyActivityType, { nullable: true })
  subSurveyActivity?: SubSurveyActivityType;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  updatedAt!: Date | null;
}

@ObjectType()
export class MonthlyStatsType {
  @Field(() => Int)
  totalJobLetters: number;

  @Field(() => Int)
  totalSPJ: number;

  @Field(() => Int)
  totalActiveUsers: number;
}

@ObjectType()
export class MonthlyActivityStaffUsageRowType {
  @Field(() => String, {
    description: 'Bulan kegiatan berdasarkan startDate, format "YYYY-MM"',
  })
  month!: string;

  @Field(() => ID)
  subSurveyActivityId!: string;

  @Field(() => String)
  subSurveyName!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => Number, { description: "Jumlah petugas (distinct userId) dipakai pada kegiatan" })
  staffCount!: number;

  @Field(() => [UserType], { description: "Daftar petugas (distinct userId) dipakai pada kegiatan" })
  staffUsers!: UserType[];
}

@ObjectType()
export class IssueCommentType {
  @Field(() => ID)
  id: string;

  @Field()
  message: string;

  @Field(() => ID)
  contentId: string;

  @Field(() => UserType, { nullable: true })
  user?: UserType;

  @Field(() => ID)
  userId: string;

  @Field(() => SubSurveyActivityType, { nullable: true })
  subSurveyActivity?: SubSurveyActivityType;

  @Field(() => ID)
  subSurveyActivityId: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class ContentIssueType {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field(() => IssueStatus)
  issueStatus: IssueStatus;

  @Field(() => UserType, { nullable: true })
  reporter?: UserType;

  @Field(() => ID)
  reporterId: string;

  @Field(() => SubSurveyActivityType, { nullable: true })
  subSurveyActivity?: SubSurveyActivityType;

  @Field(() => ID)
  subSurveyActivityId: string;

  @Field(() => [IssueCommentType], { nullable: true })
  IssueComment?: IssueCommentType[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class StaffYearlyExportRowType {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  userName!: string;

  @Field(() => Float, { nullable: true })
  userLimitBill?: number | null;

  @Field(() => String)
  subSurveyActivityId!: string;

  @Field(() => String)
  subSurveyName!: string;

  @Field(() => String, { nullable: true })
  activityType?: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  startDate?: Date | null;

  @Field(() => String, {
    description: 'Bulan berdasarkan startDate, format "YYYY-MM"',
  })
  month!: string;

  @Field(() => String, { nullable: true })
  districtName?: string | null;

  @Field(() => Int, { nullable: true })
  blockCount?: number | null;

  @Field(() => Int, { nullable: true })
  totalAssigned?: number | null;

  @Field(() => Int, { nullable: true })
  submitCount?: number | null;

  @Field(() => Int, { nullable: true })
  approvedCount?: number | null;

  @Field(() => Int, { nullable: true })
  rejectedCount?: number | null;

  @Field(() => Float, { nullable: true })
  travelBill?: number | null;
}
