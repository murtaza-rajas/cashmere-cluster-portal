import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStoryCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
