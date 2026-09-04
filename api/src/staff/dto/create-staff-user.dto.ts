import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateStaffUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
