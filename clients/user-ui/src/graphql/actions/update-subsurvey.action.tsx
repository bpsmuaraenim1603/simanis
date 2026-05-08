import { gql, useMutation } from '@apollo/client';

export const UPDATE_SUB_SURVEY_ACTIVITY = gql`
  mutation UpdateSubSurveyActivity($subSurveyActivityId: String!, $input: UpdateSubSurveyActivityDTO!) {
    updateSubSurveyActivity(subSurveyActivityId: $subSurveyActivityId, input: $input) {
      id
      name
      slug
      startDate
      endDate
      handoverMonth
      spkHandoverMonth
      bastHandoverMonth
      targetSample
      sampleType
      priceCompareUnit
      activityType
      budgetCode
      unitWorkPrice
    }
  }
`;
