import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class RequestEmailCodeDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class VerifyEmailCodeDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'The code is 6 digits' })
  code: string;
}
