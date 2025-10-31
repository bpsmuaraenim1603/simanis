import { Field, InputType, ObjectType, Int } from '@nestjs/graphql';

@InputType()
export class BulkSpjDefaultsInput {
  @Field() subSurveyActivityId!: string;  // wajib (satu kegiatan untuk semua baris)
  @Field({ nullable: true }) submitDate?: string; // "D MMMM YYYY" (id), default: now
  @Field({ nullable: true }) submitState?: string; // default "Menunggu"
  @Field({ nullable: true }) noSurat?: string;     // disimpan di verifyNote
  @Field({ nullable: true }) keterangan?: string;  // disimpan di verifyNote
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
  @Field({ nullable: true }) evidenceUrl?: string; // eviDocumentSignedUrl/eviDocumentPath tampilan
}
