import { gql, DocumentNode } from '@apollo/client';

export const RESET_PASSWORD: DocumentNode = gql`
mutation resetPassword($password: String!, $activationToken: String!) {
    resetPassword(
        resetPasswordDto: {
            password: $password,
            activationToken: $activationToken,
        }
    ) {
        user {
            name
            email
            password
            primaryRole
            roles
        }
    }
}
`;