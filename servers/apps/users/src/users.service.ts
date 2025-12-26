import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt';
import {
  ActivationDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateBillLimitDto,
  UpdateRoleDto,
  UpdateUserDto,
} from './dto/users.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { EmailService } from './email/email.service';
import { TokenSender } from './utils/sendToken';
import { Prisma, User } from '@prisma/client';
import * as crypto from 'crypto';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { BulkSpjDefaultsInput, BulkSpjResult } from './dto/bulk-spj.dto';

interface UserData {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  address: string;
}

async function saveEvidenceFile(
  buf: Buffer,
  filename: string,
  mimeType?: string,
): Promise<{ path: string; originalName: string; mimeType?: string; size: number; publicUrl?: string }> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${filename.replace(/\s+/g, '_')}`;
  const full = path.join(uploadDir, safeName);
  await fs.writeFile(full, buf);
  const publicBase = process.env.PUBLIC_UPLOAD_BASE_URL;
  return {
    path: full,
    originalName: filename,
    mimeType,
    size: buf.length,
    publicUrl: publicBase ? `${publicBase}/${safeName}` : undefined,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private genBatchCode(prefix = 'HON') {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${dayjs().format('YYYYMMDD-HHmm')}-${rand}`;
  }

  private parseTanggalLokal(input?: string): Date | null {
    if (!input) return null;
    const parsed = dayjs(input, 'D MMMM YYYY', 'id', true);
    return parsed.isValid() ? parsed.toDate() : null;
  }

  async createUser(registerDto: RegisterDto) {
    const { name, email, phone_number, password, address } = registerDto;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      name,
      email,
      phone_number,
      password: hashedPassword,
      address,
      limit_bill: '0',
    };
    return this.prisma.user.create({
      data: user,
    });
  }

  async register(registerDto: RegisterDto, response: Response) {
    const { name, email, phone_number, password, address } = registerDto;
    const isEmailExist = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

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
        limit_bill: '0',
      },
    });

    return { user, response };
  }

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

  async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

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
      this.configService.get<string>('CLIENT_SIDE_URI_SECOND') +
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

  async getLoggedInUser(req: any) {
    const user = req.user;
    const accessToken = req.accesstoken;
    const refreshToken = req.refreshtoken;
    return { user, accessToken, refreshToken };
  }

  async Logout(req: any) {
    req.user = null;
    req.accesstoken = null;
    req.refreshtoken = null;
    return { message: 'Logout berhasil!' };
  }

  async getUsers() {
    return this.prisma.user.findMany({});
  }

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

  async editUserBillLimit(userId: string, updateBillLimit: UpdateBillLimitDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: updateBillLimit.name,
        limit_bill: updateBillLimit.limit_bill,
      },
    });
  }

  async bulkSubmitSpjHonorFromFile(
    fileBuffer: Buffer,
    fileName: string,
    fileMime?: string,
    defaults?: BulkSpjDefaultsInput,
  ): Promise<BulkSpjResult> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!defaults?.subSurveyActivityId) {
      throw new Error('defaults.subSurveyActivityId wajib diisi.');
    }

    const evidence = await saveEvidenceFile(fileBuffer, fileName, fileMime);

    const batchCode = this.genBatchCode();
    const subSurveyActivityId = defaults.subSurveyActivityId;
    const submitState = defaults?.submitState || 'Menunggu';
    const defaultSubmitDate = this.parseTanggalLokal(defaults?.submitDate) || new Date();

    let inserted = 0;
    let skippedDuplicates = 0;
    const errors: { rowIndex: number; message: string }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
          const userId = String(r.userId || '').trim();
          let targetUserId = userId;
          if (!targetUserId) throw new Error('petugas tidak ditemukan.');

          const _tanggal = String(r.tanggal || '').trim();
          const submitDate = this.parseTanggalLokal(_tanggal) || defaultSubmitDate;

          const honorNominal = r.honorNominal ? Number(r.honorNominal) : undefined;
          const noteObj = {
            batch: batchCode,
            noSurat: defaults?.noSurat || null,
            keterangan: defaults?.keterangan || null,
            honorNominal: Number.isFinite(honorNominal) ? honorNominal : null,
            uraian: r.uraian || null,
            catatanBaris: r.catatanBaris || null,
          };
          const noteJson = JSON.stringify(noteObj);

          const checksumBase = `${targetUserId}|${subSurveyActivityId}|${dayjs(submitDate).format('YYYY-MM-DD')}|${honorNominal ?? ''}|${defaults?.noSurat ?? ''}`;
          const checksum = crypto.createHash('sha256').update(checksumBase).digest('hex');

          const existed = await tx.submitSPJ.findFirst({
            where: { verifyNote: { contains: checksum } },
            select: { id: true },
          });
          if (existed) { skippedDuplicates++; continue; }

          await tx.submitSPJ.create({
            data: {
              userId: targetUserId,
              subSurveyActivityId,
              verifyNote: `${noteJson} | checksum=${checksum}`,
              submitState,
              submitDate,
              approveDate: null,

              eviDocumentPath: evidence.path,
              eviOriginalName: evidence.originalName,
              eviMimeType: evidence.mimeType || null,
              eviSize: evidence.size,
              eviDocumentSignedUrl: evidence.publicUrl || null,
            } as any,
          });

          inserted++;
        } catch (e: any) {
          errors.push({ rowIndex: i + 2, message: e?.message || 'Row error' });
        }
      }
    });

    return {
      batchCode,
      inserted,
      skippedDuplicates,
      errors,
      evidenceUrl: evidence.publicUrl,
    };
  }
}
