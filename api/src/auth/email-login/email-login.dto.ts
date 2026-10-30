import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

// "Join for free" on the sign-in panel: becomes a Newsletter member. The
// newsletter consent box must be ticked — the Newsletter level is the
// newsletter.
export class JoinDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Please enter your first name' })
  @MaxLength(100)
  firstName: string;

  @Equals(true, { message: 'Please tick the box to receive the newsletter' })
  newsletterConsent: boolean;
}
