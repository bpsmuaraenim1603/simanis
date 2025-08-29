declare module 'apollo-upload-client' {
  import type { ApolloLink } from '@apollo/client';

  // Kalau mau ketat, bisa definisikan UploadOptions mirip HttpOptions.
  // Untuk cepatnya pakai any saja agar tidak bentrok versi.
  export function createUploadLink(options?: any): ApolloLink;
}