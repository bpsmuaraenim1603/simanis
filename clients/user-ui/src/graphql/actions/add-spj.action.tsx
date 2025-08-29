import { gql } from "@apollo/client";

export const ADD_SPJ = gql`
  mutation CreateSPJ($input: CreateSPJDTO!, $file: Upload) {
    createSPJ(input: $input, file: $file) {
      id
      userId
      subSurveyActivityId
      submitState
      verifyNote
      eviDocumentPath
      eviDocumentSignedUrl
      submitDate
      approveDate
    }
  }
`;
