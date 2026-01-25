"use client"

import { DocumentNode, gql } from "@apollo/client";

export const GET_ALL_OF_VILLAGE: DocumentNode = gql`
  query AllVillages {
    allVillages {
      id
      name
      coderegion
      districtId
    }
  }
`;