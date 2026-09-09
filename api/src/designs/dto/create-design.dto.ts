import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { DesignStatus } from '@prisma/client';

export class CreateDesignDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Freeform ("Spring 2027") — not from a fixed list, see schema.prisma's comment.
  @IsOptional()
  @IsString()
  round?: string;

  @IsOptional()
  @IsEnum(DesignStatus)
  status?: DesignStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
