import { gql } from "@apollo/client";

export const GET_ALL_JOBLETTERS = gql`
  query GetAllJobLetters {
    getAllJobLetters {
      id
      userId
      subSurveyActivityId
      region
      submitDate
      agreeState
      rejectNote
      approveDate
      eviLetterPath
      eviLetterSignedUrl
      user {
        id
        name
      }
      subSurveyActivity {
        id
        name
      }
    }
  }
`;