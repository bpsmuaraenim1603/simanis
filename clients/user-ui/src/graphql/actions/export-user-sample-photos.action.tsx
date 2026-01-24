"use client";
import { gql } from "@apollo/client";

export const EXPORT_USER_SAMPLE_PHOTOS = gql`
  mutation ExportUserSamplePhotos($userProgressId: String!) {
    exportUserSamplePhotos(userProgressId: $userProgressId) {
      zipUrl
      totalPhotos
    }
  }
`;
