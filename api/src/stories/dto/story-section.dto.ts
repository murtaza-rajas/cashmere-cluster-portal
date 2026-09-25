import { IsArray, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { StorySectionType } from '@prisma/client';

// One entry in a story's `sections` array. Every content field is optional
// here regardless of `type` — which ones are actually meaningful depends on
// `type` (TEXT uses `text`, IMAGE uses `imageUrl`, etc.) and is enforced in
// StoriesService.validateSectionShape rather than with per-type DTO
// subclasses, since class-validator has no clean "required if type is X"
// primitive and a handful of subclasses would add real ceremony for four
// simple, flat shapes.
export class StorySectionDto {
  @IsInt()
  order: number;

  @IsEnum(StorySectionType)
  type: StorySectionType;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImageUrls?: string[];

  @IsOptional()
  @IsString()
  quoteText?: string;

  @IsOptional()
  @IsString()
  quoteAttribution?: string;
}
