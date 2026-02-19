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
  ProgressRole,
} from '@prisma/client';
import { User } from 'apps/users/src/entities/users.entity';
import { UserType } from 'apps/users/src/types/users.types';

registerEnumType(AgreeState, {
  name: 'AgreeState',
});

registerEnumType(StatusST, {
  name: 'StatusST',
});

registerEnumType(IssueStatus, {
  name: 'IssueStatus',
});

registerEnumType(CacahStatus, { name: 'CacahStatus' });
registerEnumType(ProgressRole, { name: 'ProgressRole' });

@ObjectType()
export class SurveyActivityType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field(() => ID)
  chiefId: string;

  @Field(() => UserType, { nullable: true })
  chief?: UserType;
}

@ObjectType()
export class DistrictType {
  @Field(() => ID)
  id: string;

  @Field()
  city: string;

  @Field()
  name: string;

  @Field()
  coderegion: string;
}

@ObjectType()
export class VillageType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  coderegion: string;

  @Field(() => ID)
  districtId: string;
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

  @Field()
  status: string;

  @Field(() => String, { nullable: true })
  budgetCode?: string | null;

  @Field(() => Number, { nullable: true })
  unitWorkPrice?: number | null;
}

@ObjectType()
export class UserProgressType {
  @Field(() => ID)
  id: string;

  @Field(() => UserType, { nullable: true })
  user?: UserType;

  @Field(() => ID)
  userId: string;

  @Field(() => ID, { nullable: true })
  superVisorId?: string;

  @Field(() => UserType, { nullable: true, name: 'superVisor' })
  supervisor?: UserType;

  @Field(() => ID)
  subSurveyActivityId: string;

  @Field(() => SubSurveyActivityType, { nullable: true })
  subSurveyActivity?: SubSurveyActivityType;

  @Field(() => ID, { nullable: true })
  districtId?: string;

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

  @Field(() => String, { nullable: true })
  villageId?: string;

  @Field(() => VillageType, { nullable: true })
  village?: VillageType;

  @Field({ nullable: true })
  docsBill?: string;

  @Field({ nullable: true })
  budgetCode?: string;

  @Field(() => ProgressRole)
  progressRole: ProgressRole;

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

  @Field({ nullable: true })
  photoPath?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  photoCapturedAt?: Date;

  @Field({ nullable: true })
  photoSignedUrl?: string;
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

  @Field(() => [ID])
  activeUserIds: string[];

  @Field(() => [ID])
  activeSubSurveyActivityIds: string[];
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

  @Field(() => String, { nullable: true })
  subSurveySlug?: string;

  @Field(() => String, { nullable: true })
  surveyActivitySlug?: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => Number, {
    description: 'Jumlah petugas (distinct userId) dipakai pada kegiatan',
  })
  staffCount!: number;

  @Field(() => [UserType], {
    description: 'Daftar petugas (distinct userId) dipakai pada kegiatan',
  })
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
  docsBill?: number | null;
}


@ObjectType()
export class MitraBulananExportRowType {
  @Field(() => Int)
  month!: number; // 1-12

  @Field(() => Int)
  year!: number;

  @Field(() => String)
  userId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  job_name?: string | null;

  @Field(() => String, { nullable: true })
  district?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String)
  subsurveyactivity!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => Int)
  totalAssigned!: number;

  @Field(() => String)
  sampleType!: string;

  @Field(() => Int, { nullable: true })
  unitWorkPrice?: number | null;

  @Field(() => Float, { nullable: true })
  docsBill?: number | null;

  @Field(() => String, { nullable: true })
  budgetCode?: string | null;

  @Field(() => Float, { nullable: true })
  limit_bill?: number | null;

  @Field(() => String, { nullable: true })
  chiefName?: string | null;

  @Field(() => String)
  dipa!: string;
}

@ObjectType()
export class ExportUserSamplePhotosResult {
  @Field()
  zipUrl: string;

  @Field(() => Int)
  totalPhotos: number;
}



export enum AdminDocType {
  SPK = 'SPK',
  BAST = 'BAST',
}
registerEnumType(AdminDocType, { name: 'AdminDocType' });

@ObjectType()
export class MonthlyStaffDocPreviewRowType {
  @Field(() => ID)
  subSurveyActivityId: string;

  @Field()
  activityName: string;

  @Field(() => GraphQLISODateTime)
  startDate: Date;

  @Field(() => GraphQLISODateTime)
  endDate: Date;

  @Field()
  eligible: boolean;

  @Field(() => Int)
  totalDocs: number;

  @Field(() => Float)
  totalHonor: number;

  @Field(() => Float)
  unitCost: number;

  @Field(() => String, { nullable: true })
  budgetCode?: string | null;

  @Field(() => String, { nullable: true })
  unitName?: string | null;

  @Field(() => String, { nullable: true })
  included?: boolean | null;
}

@ObjectType()
export class MonthlyStaffDocsOutputType {
  @Field()
  spkUrl: string;

  @Field()
  bastUrl: string;

  @Field()
  nomorSPK: string;

  @Field()
  nomorBAST: string;

  // Waktu kedaluwarsa file di storage (setelah ini file akan dihapus otomatis)
  @Field(() => GraphQLISODateTime, { nullable: true })
  expiresAt?: Date;
}

@ObjectType()
export class MonthlyAdminDocRecapType {
  @Field(() => ID)
  userId: string;

  @Field()
  year: number;

  @Field()
  month: number;

  @Field({ nullable: true })
  spkNumber?: string;

  @Field({ nullable: true })
  bastNumber?: string;

  @Field(() => ID, { nullable: true })
  ppkUserId?: string;
  
  @Field(() => User, { nullable: true })
  ppkUser?: User;

}