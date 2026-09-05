import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddWishlistItemDto {
  @IsString()
  @IsNotEmpty()
  shopifyProductId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  variantTitle?: string;

  @IsString()
  @IsOptional()
  price?: string;
}
