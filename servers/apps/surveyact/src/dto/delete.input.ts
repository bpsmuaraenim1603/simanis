import { Field, InputType, ID, ObjectType } from '@nestjs/graphql';

@InputType()
export class DeleteByIdInput {
  @Field(() => ID)
  id!: string;
}

@ObjectType()
export class DeleteResult {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;
}
