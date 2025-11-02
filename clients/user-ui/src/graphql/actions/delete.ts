import { gql } from "@apollo/client";

export const DELETE_SURVEY_ACTIVITY = gql`
  mutation DeleteSurveyActivity($input: DeleteByIdInput!) {
    deleteSurveyActivity(input: $input) { success message }
  }
`;

export const DELETE_SUBSURVEY_ACTIVITY = gql`
  mutation DeleteSubSurveyActivity($input: DeleteByIdInput!) {
    deleteSubSurveyActivity(input: $input) { success message }
  }
`;

export const DELETE_USER_SURVEY_PROGRESS = gql`
  mutation DeleteUserSurveyProgress($input: DeleteByIdInput!) {
    deleteUserSurveyProgress(input: $input) { success message }
  }
`;

export const DELETE_JOBLETTER = gql`
  mutation DeleteJobLetter($input: DeleteByIdInput!) {
    deleteJobLetter(input: $input) { success message }
  }
`;
export const DELETE_SUBMIT_SPJ = gql`
  mutation DeleteSubmitSPJ($input: DeleteByIdInput!) {
    deleteSubmitSPJ(input: $input) { success message }
  }
`;
