import { InputType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { AgreeState, IssueStatus, StatusST } from '@prisma/client';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

registerEnumType(AgreeState, {
  name: 'AgreeState', // ini akan muncul di GraphQL schema
});

registerEnumType(StatusST, {
  name: 'StatusST',
})

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
}

@InputType()
export class CreateUserProgressDTO {
  @Field()
  subSurveyActivityId: string;

  @Field()
  userId: string;

  @Field()
  totalAssigned: number;

  @Field()
  submitCount: number;

  @Field()
  approvedCount: number;

  @Field()
  rejectedCount: number;

  @Field()
  lastUpdated: Date;

  @Field()
  districtId: string;
}

@InputType()
export class UpdateUserProgressDTO {
  @Field()
  totalAssigned: number;

  @Field()
  submitCount: number;

  @Field()
  approvedCount: number;

  @Field()
  rejectedCount: number;

  @Field()
  lastUpdated: Date;

  @Field()
  districtId: string;
}

@InputType()
export class CreateDistrictDTO {
  @Field()
  city: string;

  @Field()
  name: string;
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
  @IsOptional()
  @IsString()
  eviDocumentUrl?: string;
}

@InputType()
export class UpdateSPJStatusDTO {
  @Field(() => ID)
  id: string;

  @Field(() => AgreeState)
  status: AgreeState;

  @Field({ nullable: true })
  verifyNote?: string;

  @Field({ nullable: true})
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

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  submitDate?: string;

  @Field({ nullable: true })
  @IsString()
  eviFieldUrl: string;

  @Field({ nullable: true })
  @IsString()
  eviSTUrl: string;
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

  @Field(()=> ID)
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