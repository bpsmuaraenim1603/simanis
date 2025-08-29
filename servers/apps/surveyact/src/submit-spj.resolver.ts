import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { SubmitSPJType } from './types/surveyact.types';
import { SubmitSPJ } from '@prisma/client';
import { SurveyActivityService } from './surveyacts.service';

@Resolver(() => SubmitSPJType)
export class SubmitSPJResolver {
  constructor(private readonly service: SurveyActivityService) {}

  @ResolveField(() => String, { name: 'eviDocumentSignedUrl', nullable: true })
  async eviDocumentSignedUrl(@Parent() spj: SubmitSPJ) {
    return this.service.getSPJSignedUrl(spj.eviDocumentPath ?? null);
  }
}
