import { gql } from '@apollo/client';

export const ADD_JOBLETTER = gql`
  mutation CreateJobLetter($input: CreateJobLetterDTO!, $file: Upload) {
    createJobLetter(input: $input, file: $file) {
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
      user { id name }
      subSurveyActivity { id name }
    }
  }
`;