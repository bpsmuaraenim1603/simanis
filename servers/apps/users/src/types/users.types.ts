import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { User } from '../entities/users.entity';

@ObjectType()
export class ErrorType {
  @Field()
  message!: string;

  @Field({ nullable: true })
  code?: string;
}

@ObjectType()
export class UserResponse {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String)
  phone_number!: string;

  @Field(() => String)
  address!: string | null;
}

@ObjectType()
export class RegisterResponse {
  @Field()
  activation_token!: string;

  @Field(() => ErrorType, { nullable: true })
  error?: ErrorType;
}

@ObjectType()
export class ActivationResponse {
  @Field(() => User)
  user: User | any;

  @Field(() => ErrorType, { nullable: true })
  error?: ErrorType;
}

@ObjectType()
export class LoginResponse {
  @Field(() => User, { nullable: true })
  user?: User | null;

  @Field(() => String, { nullable: true })
  accessToken?: string | null;

  @Field(() => String, { nullable: true })
  refreshToken?: string | null;

  @Field(() => ErrorType, { nullable: true })
  error?: ErrorType;
}

@ObjectType()
export class LogoutResponse {
  @Field()
  message?: string;
}

@ObjectType()
export class ForgotPasswordResponse {
  @Field()
  message!: string;

  @Field(() => ErrorType, { nullable: true })
  error?: ErrorType;
}

@ObjectType()
export class ResetPasswordResponse {
  @Field(() => User)
  user: User | any;

  @Field(() => ErrorType, { nullable: true })
  error?: ErrorType;
}

@ObjectType()
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone_number?: string;

  @Field(() => String)
  primaryRole!: string;

  @Field(() => [String])
  roles!: string[];

  @Field(() => String, { nullable: true })
  limit_bill?: string;

  @Field(() => Date, { nullable: true })
  createdAt?: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date;
}

@ObjectType()
export class NotificationItem {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  type!: string;

  @Field(() => String)
  targetType!: string;

  @Field(() => String)
  targetId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  body?: string | null;

  @Field(() => String, { nullable: true })
  actorName?: string | null;

  @Field(() => String)
  channel!: string;

  @Field(() => Boolean)
  isRead!: boolean;

  @Field(() => Date, { nullable: true })
  readAt?: Date | null;

  @Field(() => String, { nullable: true })
  metadata?: string | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
export class NotificationListResponse {
  @Field(() => [NotificationItem])
  items!: NotificationItem[];

  @Field(() => String, { nullable: true })
  nextCursor?: string;
}

@ObjectType()
export class UnreadCountResponse {
  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class DailySignupCodeResponse {
  @Field()
  dateKey!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class PpkOptionResponse {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  nip?: string;

  @Field(() => String)
  primaryRole!: string;

  @Field(() => Boolean, { nullable: true })
  isDefault?: boolean;
}

@ObjectType()
export class DocNumberConfigResponse {
  @Field(() => Int)
  spkStartNumber!: number;

  @Field(() => Int)
  bastStartNumber!: number;

  @Field(() => Int)
  currentSpkNumber!: number;

  @Field(() => Int)
  currentBastNumber!: number;

  @Field(() => Int)
  nextSpkNumber!: number;

  @Field(() => Int)
  nextBastNumber!: number;
}

@ObjectType()
export class UsersPageResponse {
  @Field(() => [User])
  items!: User[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;
}