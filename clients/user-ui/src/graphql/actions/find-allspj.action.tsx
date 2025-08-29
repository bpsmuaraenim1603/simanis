"use client";
import { DocumentNode, gql } from "@apollo/client";

export const GET_ALL_SPJ: DocumentNode = gql`
  query GetAllSPJ {
    getAllSPJ {
      id
      userId
      subSurveyActivityId
      submitState
      submitDate
      approveDate
      verifyNote
      eviDocumentPath
      eviDocumentSignedUrl
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
