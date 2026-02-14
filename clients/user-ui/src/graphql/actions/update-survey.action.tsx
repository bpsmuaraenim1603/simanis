import { gql, useMutation } from '@apollo/client';

export const UPDATE_SURVEY_ACTIVITY = gql`
  mutation UpdateSurveyActivity($surveyActivityId: String!, $input: UpdateSurveyActivityDTO!) {
    updateSurveyActivity(surveyActivityId: $surveyActivityId, input: $input) {
      id
      name
      slug
      chiefId
      chief {
        id
        name
      }
    }
  }
`;
