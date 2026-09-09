import { IsOptional, IsString } from 'class-validator';

// Only ever an update — topics are fixed and pre-seeded (see schema.prisma's
// CareGuide comment), there's no create/delete for this resource. `body`
// itself is optional so staff can explicitly clear it back to null (reverting
// to the "Guide coming soon" placeholder) as well as set it.
export class UpdateCareGuideDto {
  @IsOptional()
  @IsString()
  body?: string;
}
