import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt';
import {
  ActivationDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateRoleDto,
  UpdateUserDto,
} from './dto/users.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { EmailService } from './email/email.service';
import { TokenSender } from './utils/sendToken';
import { Prisma, User } from '@prisma/client';

interface UserData {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  address: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // register user
  async register(registerDto: RegisterDto, response: Response) {
    const { name, email, phone_number, password, address } = registerDto;
    const isEmailExist = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    // const isPhoneNumberExist = await this.prisma.user.findUnique({
    //   where: {
    //     phone_number,
    //   },
    // });

    // if (isPhoneNumberExist) {
    //   throw new BadRequestException('Nomor telepon ini sudah dipakai!');
    // }

    if (isEmailExist) {
      throw new BadRequestException('Email ini sudah dipakai!');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      name,
      email,
      phone_number,
      password: hashedPassword,
      address,
    };
    const activationToken = await this.createActivationToken(user);
    const activationCode = activationToken.activationCode;
    const activation_token = activationToken.token;

    await this.emailService.sendMail({
      email,
      subject: 'Aktivasi akun mu',
      template: './activation-mail',
      name,
      activationCode,
    });
    return { activation_token, response };
  }

  // create activation token
  async createActivationToken(user: UserData) {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const token = this.jwtService.sign(
      { user, activationCode },
      {
        secret: this.configService.get<string>('ACTIVATION_SECRET'),
        expiresIn: '5m',
      },
    );
    return { token, activationCode };
  }

  // activation user
  async activateUser(activationDto: ActivationDto, response: Response) {
    const { activationToken, activationCode } = activationDto;

    const newUser: { user: UserData; activationCode: string } =
      this.jwtService.verify(activationToken, {
        secret: this.configService.get<string>('ACTIVATION_SECRET'),
      } as JwtVerifyOptions) as { user: UserData; activationCode: string };

    if (newUser.activationCode !== activationCode) {
      throw new BadRequestException('Kode Aktivasi tidak sesuai!');
    }

    const { name, email, password, phone_number, address } = newUser.user;
    const existUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existUser) {
      throw new BadRequestException('Akun ini sudah tersedia!');
    }

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password,
        phone_number,
        address,
      },
    });

    return { user, response };
  }

  // login service
  async Login(LoginDto: LoginDto) {
    const { email, password } = LoginDto;

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user && (await this.comparePassword(password, user.password))) {
      const tokenSender = new TokenSender(this.configService, this.jwtService);
      return tokenSender.sendToken(user);
    } else {
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        error: {
          message: 'Email atau Password tidak sesuai!',
        },
      };
    }
  }

  //compare with hashed password
  async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // generate forgot password link
  async generateForgotPasswordLink(user: User) {
    const forgotPasswordToken = this.jwtService.sign(
      {
        user,
      },
      {
        secret: this.configService.get<string>('FORGOT_PASSWORD_SECRET'),
        expiresIn: '5m',
      },
    );
    return forgotPasswordToken;
  }

  // forgot password
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found with this email!');
    }
    const forgotPasswordToken = await this.generateForgotPasswordLink(user);

    const resetPasswordUrl =
      this.configService.get<string>('CLIENT_SIDE_URI') +
      `/reset-password?verify=${forgotPasswordToken}`;

    await this.emailService.sendMail({
      email,
      subject: 'Reset Passwordmu!',
      template: './forgot-password',
      name: user.name,
      activationCode: resetPasswordUrl,
    });

    return { message: `Permintaan reset password berhasil dikirim!` };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { password, activationToken } = resetPasswordDto;

    const decoded = await this.jwtService.decode(activationToken);

    if (!decoded || decoded?.exp * 1000 < Date.now()) {
      throw new BadRequestException('Invalid token!');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.update({
      where: {
        id: decoded.user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return { user };
  }

  //get logged in user
  async getLoggedInUser(req: any) {
    const user = req.user;
    const accessToken = req.accesstoken;
    const refreshToken = req.refreshtoken;
    return { user, accessToken, refreshToken };
  }

  //log out user
  async Logout(req: any) {
    req.user = null;
    req.accesstoken = null;
    req.refreshtoken = null;
    return { message: 'Logout berhasil!' };
  }

  // get all users service
  async getUsers() {
    return this.prisma.user.findMany({});
  }

  // async updateUserSurveyInfo(
  //   userId: string,
  //   updateSurveyActivityDto: UpdateSurveyActivityDto,
  // ) {
  //   return this.prisma.user.update({
  //     where: { id: userId },
  //     data: {
  //       subSurveyActivityId: updateSurveyActivityDto.subSurveyActivityId,
  //       region: updateSurveyActivityDto.region,
  //     },
  //   });
  // }

  // update user profile
  async updateUserProfile(
    userId: string,
    updateData: UpdateUserDto,
  ): Promise<User> {
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== null),
    );
    return this.prisma.user.update({
      where: { id: userId },
      data: cleanedData,
    });
  }

  async findMany(args: Prisma.UserFindManyArgs) {
    return this.prisma.user.findMany(args);
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async editUserRole(userId: string, updateRole: UpdateRoleDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: updateRole.name,
        role: updateRole.role,
      },
    });
  }
}
