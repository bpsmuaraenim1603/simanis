import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver, Int } from '@nestjs/graphql';
import { UsersService } from './users.service';
import {
  ActivationResponse,
  DailySignupCodeResponse,
  DocNumberConfigResponse,
  ForgotPasswordResponse,
  LoginResponse,
  LogoutResponse,
  NotificationListResponse,
  PpkOptionResponse,
  RegisterResponse,
  ResetPasswordResponse,
  UnreadCountResponse,
  UsersPageResponse,
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
import { Public } from './decorators/public.decorator';

@Resolver('User')
// @UseFilters()
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}


  private getReqRoles(req: any): string[] {
    const u = req?.user;
    if (!u) return [];
    if (Array.isArray(u.roles)) return u.roles.filter(Boolean);
    if (u.primaryRole) return [u.primaryRole];
    if (u.role) return [u.role]; // legacy
    return [];
  }

  private requireAnyRole(req: any, allowed: string[]) {
    const roles = this.getReqRoles(req);
    const ok = allowed.some((r) => roles.includes(r));
    if (!ok) throw new BadRequestException('Akses ditolak');
  }

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
  @Public()
  async register(
    @Args('registerDto') registerDto: RegisterDto,
    @Context() context: { res: Response },
  ): Promise<RegisterResponse> {
    if (!registerDto.name || !registerDto.email || !registerDto.password || !registerDto.phone_number || !registerDto.address || !registerDto.job_name || !registerDto.districtId || !registerDto.villageId|| !registerDto.signupCode) {
      throw new BadRequestException('Tolong isi semua kolom yang tersedia!');
    }

    const { activation_token } = await this.usersService.register(
      registerDto,
      context.res,
    );

    return { activation_token };
  }

  @Mutation(() => ActivationResponse)
  @Public()
  async activateUser(
    @Args('activationDto') activationDto: ActivationDto,
    @Context() context: { res: Response },
  ): Promise<ActivationResponse> {
    return await this.usersService.activateUser(activationDto, context.res);
  }

  @Mutation(() => LoginResponse)
  @Public()
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
    this.requireAnyRole(context.req, ['Superadmin','Keuangan']);
    return this.usersService.getOrCreateDailySignupCode();
  }

  // Regenerate kode hari ini (hanya Superadmin)
  @Mutation(() => DailySignupCodeResponse)
  @UseGuards(AuthGuard)
  async rotateDailySignupCode(@Context() context: { req: any }) {
    this.requireAnyRole(context.req, ['Superadmin']);
    return this.usersService.rotateDailySignupCode();
  }

  @Mutation(() => ForgotPasswordResponse)
  @Public()
  async forgotPassword(
    @Args('forgotPasswordDto') forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    return await this.usersService.forgotPassword(forgotPasswordDto);
  }

  @Mutation(() => ResetPasswordResponse)
  @Public()
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

  @Query(() => [User])
  async getUsers() {
    return this.usersService.getUsers();
  }

  @Query(() => UsersPageResponse)
  async getUsersPage(
    @Args('page', { type: () => Int }) page: number,
    @Args('pageSize', { type: () => Int }) pageSize: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.usersService.getUsersPage({
      page,
      pageSize,
      search,
    });
  }

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
        OR: [
          { roles: { has: 'User' } },
          { primaryRole: 'User' },
        ],
      },
    });
  }

  @Mutation(() => User)
  @UseGuards(AuthGuard)
  async editUserRole(
    @Args('userId') userId: string,
    @Args('updateRole') updateRole: UpdateRoleDto,
  ): Promise<User> {
    return this.usersService.editUserRoles(userId, updateRole);
  }

  @Mutation(() => User)
  @UseGuards(AuthGuard)
  async updateBillLimit(
    @Args('userId') userId: string,
    @Args('updateBillLimit') updateBillLimit: UpdateBillLimitDto,
  ): Promise<User> {
    return this.usersService.editUserBillLimit(userId, updateBillLimit);
  }

  @Query(() => UnreadCountResponse)
  @UseGuards(AuthGuard)
  async myUnreadNotificationCount(
    @CurrentUser() user: User,
  ): Promise<UnreadCountResponse> {
    const count = await this.usersService.getUnreadNotificationCount(user.id);
    return { count };
  }

  @Query(() => NotificationListResponse)
  @UseGuards(AuthGuard)
  async myNotifications(
    @CurrentUser() user: User,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string,
  ): Promise<NotificationListResponse> {
    return this.usersService.getMyNotifications({
      recipientId: user.id,
      take,
      cursor,
    });
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthGuard)
  async markNotificationRead(
    @CurrentUser() user: User,
    @Args('notificationId') notificationId: string,
  ): Promise<boolean> {
    return this.usersService.markNotificationRead({
      recipientId: user.id,
      notificationId,
    });
  }

  @Mutation(() => Int)
  @UseGuards(AuthGuard)
  async markAllNotificationsRead(@CurrentUser() user: User): Promise<number> {
    return this.usersService.markAllNotificationsRead(user.id);
  }

  @UseGuards(AuthGuard)
  @Query(() => [PpkOptionResponse])
  async ppkOptions() {
    return this.usersService.ppkOptions();
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async setDefaultPpkUser(
    @CurrentUser() user: User,
    @Args('userId', { type: () => String }) userId: string,
  ) {
    return this.usersService.setDefaultPpkUser(user as any, userId);
  }

  @UseGuards(AuthGuard)
  @Query(() => DocNumberConfigResponse)
  async DocNumberConfig() {
    return this.usersService.getDocNumberConfig();
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async setDocNumberConfig(
    @CurrentUser() user: User,
    @Args('spkStartNumber', { type: () => Int }) spkStartNumber: number,
    @Args('bastStartNumber', { type: () => Int }) bastStartNumber: number,
    @Args('spkFormat', { type: () => String, nullable: true }) spkFormat?: string,
    @Args('bastFormat', { type: () => String, nullable: true }) bastFormat?: string,
  ) {
    return this.usersService.setDocNumberConfig(
      user as any,
      spkStartNumber,
      bastStartNumber,
      spkFormat,
      bastFormat
    );
  }
}
