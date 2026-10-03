import { IsIn, IsOptional } from 'class-validator';

// Self-service creation only exposes ACCESS/DELETION — EXPORT stays staff/webhook
// -only (see DataSubjectRequestsService.createFromMember). Defaults to ACCESS when
// omitted so the existing Settings page "Request my data" button (which never sent
// a body) keeps working unchanged.
export class CreateRequestDto {
  @IsOptional()
  @IsIn(['ACCESS', 'DELETION'])
  type?: 'ACCESS' | 'DELETION';
}
