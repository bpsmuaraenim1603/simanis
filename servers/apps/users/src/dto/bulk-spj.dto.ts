import { Field, InputType, ObjectType, Int } from '@nestjs/graphql';

@InputType()
export class BulkSpjDefaultsInput {
  @Field() subSurveyActivityId!: string;
  @Field({ nullable: true }) submitDate?: string;
  @Field({ nullable: true }) submitState?: string;
  @Field({ nullable: true }) noSurat?: string;
  @Field({ nullable: true }) keterangan?: string;
}

@ObjectType()
export class BulkSpjRowError {
  @Field(() => Int) rowIndex!: number;
  @Field() message!: string;
}

@ObjectType()
export class BulkSpjResult {
  @Field() batchCode!: string;
  @Field(() => Int) inserted!: number;
  @Field(() => Int) skippedDuplicates!: number;
  @Field(() => [BulkSpjRowError]) errors!: BulkSpjRowError[];
  @Field({ nullable: true }) evidenceUrl?: string;
}
