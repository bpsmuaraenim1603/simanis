import { gql } from "@apollo/client";

export const UPDATE_SUBSURVEY_STATUS = gql`
  mutation UpdateSubSurveyActivityStatus($input: UpdateSubSurveyActivityStatusDTO!) {
    updateSubSurveyActivityStatus(input: $input) {
      id
      status
      endDate
      startDate
    }
  }
`;
