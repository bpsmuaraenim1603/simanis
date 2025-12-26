declare module 'apollo-upload-client' {
  import type { ApolloLink } from '@apollo/client';

  export function createUploadLink(options?: any): ApolloLink;
}