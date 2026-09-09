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

// Every field optional — same reasoning as UpdateEventDto/UpdateBenefitDto:
// a staff member editing one field shouldn't have to resubmit the whole design.
export class UpdateDesignDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

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
