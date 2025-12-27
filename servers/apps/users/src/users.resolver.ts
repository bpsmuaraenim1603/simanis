import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UsersService } from './users.service';
import {
  ActivationResponse,
  DailySignupCodeResponse,
  ForgotPasswordResponse,
  LoginResponse,
  LogoutResponse,
  RegisterResponse,
  ResetPasswordResponse,
  // UserResponse,
  UserType,
} from './types/users.types';
import {
  ActivationDto,
  // createUserDto,
  ForgotPasswordDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateBillLimitDto,
  UpdateRoleDto,
  UpdateUserDto,
} from './dto/users.dto';
import { User } from './entities/users.entity';
import { Response } from 'express';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { BulkSpjDefaultsInput, BulkSpjResult } from './dto/bulk-spj.dto';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { Throttle } from '@nestjs/throttler';

@Resolver('User')
// @UseFilters()
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @Mutation(() => BulkSpjResult)
  async bulkSubmitSpjHonor(
    @Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload,
    @Args('defaults', { type: () => BulkSpjDefaultsInput })
    defaults: BulkSpjDefaultsInput,
  ): Promise<BulkSpjResult> {
    const chunks: Buffer[] = [];
    const stream = file.createReadStream();
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (d) =>
        chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)),
      );
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    const buffer = Buffer.concat(chunks);

    return this.usersService.bulkSubmitSpjHonorFromFile(
      buffer,
      file.filename,
      (file as any).mimetype,
      defaults,
    );
  }

  // @Mutation(() => UserResponse)
  // async createUser(
  //   @Args('createUser') createUserDto: createUserDto,
  // ): Promise<UserResponse> {
  //   return await this.usersService.createUser(createUserDto);
  // }

  @Mutation(() => RegisterResponse)
  async register(
    @Args('registerDto') registerDto: RegisterDto,
    @Context() context: { res: Response },
  ): Promise<RegisterResponse> {
    if (!registerDto.name || !registerDto.email || !registerDto.password) {
      throw new BadRequestException('Tolong isi semua kolom yang tersedia!');
    }

    const { activation_token } = await this.usersService.register(
      registerDto,
      context.res,
    );

    return { activation_token };
  }

  @Mutation(() => ActivationResponse)
  async activateUser(
    @Args('activationDto') activationDto: ActivationDto,
    @Context() context: { res: Response },
  ): Promise<ActivationResponse> {
    return await this.usersService.activateUser(activationDto, context.res);
  }

  @Mutation(() => LoginResponse)
  @Throttle({
    default: {
      ttl: 300,
      limit: 10,
    },
  })
  async Login(
    @Args('email') email: string,
    @Args('password') password: string,
    @Context() context: { res: Response; req: Request },
  ): Promise<LoginResponse> {
    return await this.usersService.Login(
      { email, password },
      context.res,
      context.req,
    );
  }

  @Query(() => LoginResponse)
  @UseGuards(AuthGuard)
  async getLoggedInUser(@Context() context: { req: Request }) {
    return await this.usersService.getLoggedInUser(context.req);
  }

  @Query(() => DailySignupCodeResponse)
  @UseGuards(AuthGuard)
  async getDailySignupCode(@Context() context: { req: any }) {
    const role = context.req.user?.role ?? '';
    if (role !== 'Superadmin' && role !== 'Keuangan') {
      throw new BadRequestException('Akses ditolak');
    }
    return this.usersService.getOrCreateDailySignupCode();
  }

  // Regenerate kode hari ini (hanya Superadmin)
  @Mutation(() => DailySignupCodeResponse)
  @UseGuards(AuthGuard)
  async rotateDailySignupCode(@Context() context: { req: any }) {
    const role = context.req.user?.role ?? '';
    if (role !== 'Superadmin') {
      throw new BadRequestException('Akses ditolak');
    }
    return this.usersService.rotateDailySignupCode();
  }

  @Mutation(() => ForgotPasswordResponse)
  async forgotPassword(
    @Args('forgotPasswordDto') forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    return await this.usersService.forgotPassword(forgotPasswordDto);
  }

  @Mutation(() => ResetPasswordResponse)
  async resetPassword(
    @Args('resetPasswordDto') resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponse> {
    return await this.usersService.resetPassword(resetPasswordDto);
  }

  @Query(() => LogoutResponse)
  @UseGuards(AuthGuard)
  async LogOutUser(@Context() context: { req: Request }) {
    return await this.usersService.Logout(context.req);
  }

  // @Query(() => [User])
  // async getUsers() {
  //   return this.usersService.getUsers();
  // }

  @Mutation(() => User)
  @UseGuards(AuthGuard)
  async updateProfile(
    @CurrentUser() user: User,
    @Args('input') input: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateUserProfile(user.id, input);
  }

  @Resolver(() => UserType)
  @Query(() => [UserType])
  async getActivePetugas(): Promise<UserType[]> {
    return this.usersService.findMany({
      where: {
        role: 'User',
      },
    });
  }

  @Mutation(() => User)
  @UseGuards(AuthGuard)
  async editUserRole(
    @Args('userId') userId: string,
    @Args('updateRole') updateRole: UpdateRoleDto,
  ): Promise<User> {
    return this.usersService.editUserRole(userId, updateRole);
  }

  @Mutation(() => User)
  @UseGuards(AuthGuard)
  async updateBillLimit(
    @Args('userId') userId: string,
    @Args('updateBillLimit') updateBillLimit: UpdateBillLimitDto,
  ): Promise<User> {
    return this.usersService.editUserBillLimit(userId, updateBillLimit);
  }
}
