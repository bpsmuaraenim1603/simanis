import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class BulkUserProgressRowError {
  @Field(() => Int) rowIndex!: number;
  @Field() message!: string;
}

@ObjectType()
export class BulkUserProgressResult {
  @Field(() => Int) insertedPetugas!: number;
  @Field(() => Int) updatedPetugas!: number;
  @Field(() => Int) insertedPengawas!: number;
  @Field(() => Int) updatedPengawas!: number;
  @Field(() => [BulkUserProgressRowError]) errors!: BulkUserProgressRowError[];
}
