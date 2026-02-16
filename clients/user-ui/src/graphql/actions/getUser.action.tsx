"use client"

import {gql, DocumentNode} from '@apollo/client';

export const GET_USER: DocumentNode = gql`
  query {
    getLoggedInUser {
      user {
        id
        name
        email
        phone_number
        address
        job_name
        nip
        districtId
        villageId
        district {
          id
          name
        }
        village {
          id
          name
        }
        primaryRole
        roles
      }
      accessToken
      refreshToken
    }
  }
`;