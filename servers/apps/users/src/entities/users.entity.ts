import { ObjectType, Field, Directive, registerEnumType } from '@nestjs/graphql';
import { Role } from '@prisma/client';
import { SubSurveyActivity } from '../../../surveyact/entities/surveyact.entity';

registerEnumType(Role, {
  name: 'Role', // harus sama dengan yang akan dipakai di @Field(() => Role)
  description: 'User role enum',
});

@ObjectType()
@Directive('@key(fields: "id")')
export class Avatars {
  @Field()
  id: string;
  @Field()
  public_id: string;
  @Field()
  url: string;
  @Field()
  userId: string;
}

@ObjectType()
export class User {
  @Field()
  id: string;
  @Field()
  name: string;
  @Field()
  email: string;
  @Field()
  password: string;
  @Field(() => Avatars, { nullable: true })
  avatar?: Avatars | null;
  @Field(() => Role)
  role: Role;
  @Field()
  limit_bill: string;
  @Field(() => String, { nullable: true })
  address?: string | null;
  @Field({ nullable: true })
  phone_number: string;
  createdAt: Date;
  @Field()
  updatedAt: Date;
}

@ObjectType()
export class Issue {
  @Field()
  id: string;
  @Field()
  content: string;
  @Field()
  status: string;
  @Field()
  createdAt: Date;
  @Field()
  updatedAt: Date;
  @Field()
  userId: string;
  @Field(() => User)
  user: User;
  @Field()
  subSurveyActivityId: string;
  @Field(() => SubSurveyActivity)
  surveyActivity: SubSurveyActivity;
}

@ObjectType()
export class IssueComment {
  @Field()
  id: string;
  @Field()
  content: string;
  @Field()
  createdAt: Date;
  @Field()
  userId: string;
  @Field(() => User)
  user: User;
  @Field()
  issueId: string;
  @Field(() => Issue)
  issue: Issue;
}