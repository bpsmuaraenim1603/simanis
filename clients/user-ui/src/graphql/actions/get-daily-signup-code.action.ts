"use client"

import {gql, DocumentNode} from '@apollo/client';

export const GET_DAILY_SIGNUP_CODE: DocumentNode = gql`
query GetDailySignupCode {
    getDailySignupCode {
        dateKey
        code
    }
}
`;