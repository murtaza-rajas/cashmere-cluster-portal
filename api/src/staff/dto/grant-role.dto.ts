import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class GrantRoleDto {
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @IsOptional()
  @IsObject()
  dataScope?: object;
}
