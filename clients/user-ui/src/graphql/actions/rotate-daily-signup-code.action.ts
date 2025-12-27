"use client"

import {gql, DocumentNode} from '@apollo/client';

export const ROTATE_DAILY_SIGNUP_CODE: DocumentNode = gql`
mutation RotateDailySignupCode {
    rotateDailySignupCode {
        dateKey
        code
    }
}
`;