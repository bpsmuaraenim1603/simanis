import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { JobLetterType } from './types/surveyact.types';
import { JobLetter } from '@prisma/client';
import { SurveyActivityService } from './surveyacts.service';

@Resolver(() => JobLetterType)
export class JobLetterResolver {
  constructor(private readonly service: SurveyActivityService) {}

  @ResolveField(() => String, { name: 'eviLetterSignedUrl', nullable: true })
  async eviLetterSignedUrl(@Parent() jl: JobLetter) {
    return this.service.getJobLetterSignedUrl(jl.eviLetterPath ?? null);
  }
}