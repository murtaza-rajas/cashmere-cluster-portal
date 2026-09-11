import { IsOptional, IsString } from 'class-validator';

export class SubmitMongoliaPhotoDto {
  @IsOptional()
  @IsString()
  caption?: string;
}
