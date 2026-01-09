import { InputType, Field, registerEnumType } from '@nestjs/graphql';
import { Role } from '@prisma/client';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

registerEnumType(Role, {
  name: 'Role',
});

@InputType()
export class createUserDto {
  @Field()
  @IsNotEmpty({ message: 'Nama belum diisi' })
  @IsString({ message: 'Nama harus berupa teks' })
  name: string;

  @Field()
  @IsNotEmpty({ message: 'Password belum diisi' })
  @Min(8, { message: 'Password diisi minimal 8 karakter' })
  password: string;

  @Field()
  @IsNotEmpty({ message: 'Email belum diisi' })
  @IsEmail({}, { message: 'Format Email tidak sesuai' })
  email: string;

  @Field()
  @IsNotEmpty({ message: 'Nomor Telepon belum diisi' })
  @Min(12, { message: 'Nomor Telepon diisi minimal 12 angka' })
  phone_number: string;

  @Field()
  @IsNotEmpty({ message: 'Alamat belum diisi' })
  address: string;
}

@InputType()
export class RegisterDto {
  @Field()
  @IsNotEmpty({ message: 'Nama belum diisi' })
  @IsString({ message: 'Nama harus berupa teks' })
  name: string;

  @Field()
  @IsNotEmpty({ message: 'Password belum diisi' })
  @Min(8, { message: 'Password diisi minimal 8 karakter' })
  password: string;

  @Field()
  @IsNotEmpty({ message: 'Email belum diisi' })
  @IsEmail({}, { message: 'Format Email tidak sesuai' })
  email: string;

  @Field()
  @IsNotEmpty({ message: 'Nomor Telepon belum diisi' })
  @Min(12, { message: 'Nomor Telepon diisi minimal 12 angka' })
  phone_number: string;

  @Field()
  @IsNotEmpty({ message: 'Alamat belum diisi' })
  address: string;

  @Field()
  @IsNotEmpty({ message: 'Kode pendaftaran harus diisi' })
  @IsString({ message: 'Kode pendaftaran harus berupa teks' })
  @Matches(/^[A-Za-z0-9]{10}$/, {
    message: 'Kode pendaftaran harus 10 karakter (kombinasi huruf/angka)',
  })
  signupCode: string;
}

@InputType()
export class ActivationDto {
  @Field()
  @IsNotEmpty({ message: 'Token Aktivasi harus diisi' })
  activationToken: string;

  @Field()
  @IsNotEmpty({ message: 'Kode Aktivasi harus diisi' })
  activationCode: string;
}

@InputType()
export class LoginDto {
  @Field()
  @IsNotEmpty({ message: 'Email harus diisi' })
  @IsEmail({}, { message: 'Format Email tidak sesuai' })
  email: string;

  @Field()
  @IsNotEmpty({ message: 'Password harus diisi' })
  password: string;
}

@InputType()
export class ForgotPasswordDto {
  @Field()
  @IsNotEmpty({ message: 'Email harus diisi' })
  @IsEmail({}, { message: 'Format Email tidak sesuai' })
  email: string;
}

@InputType()
export class ResetPasswordDto {
  @Field()
  @IsNotEmpty({ message: 'Password baru harus diisi' })
  @Min(8, { message: 'Password baru diisi minimal 8 karakter' })
  password: string;

  @Field()
  @IsNotEmpty({ message: 'Kode Aktivasi harus diisi' })
  activationToken: string;
}

@InputType()
export class UpdateSurveyActivityDto {
  @Field()
  @IsUUID('4', { message: 'ID kegiatan survei harus berupa UUID yang valid' })
  @IsNotEmpty({ message: 'Kegiatan Survey belum diisi' })
  subSurveyActivityId: string;
}

@InputType()
export class UpdateUserDto {
  @Field(() => Role, { nullable: true })
  primaryRole?: Role;

  @Field(() => [Role], { nullable: true })
  roles?: Role[];

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone_number?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  limit_bill?: string;
}

@InputType()
export class UpdateRoleDto {
  @Field({ nullable: false })
  name?: string;

  @Field(() => Role, { nullable: true })
  primaryRole?: Role;

  @Field(() => [Role], { nullable: true })
  roles?: Role[];
}

@InputType()
export class UpdateBillLimitDto {
  @Field({ nullable: false })
  name?: string;

  @Field({ nullable: false })
  limit_bill?: string;
}
