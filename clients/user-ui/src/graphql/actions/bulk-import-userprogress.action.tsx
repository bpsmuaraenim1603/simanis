"use client";
import { gql } from "@apollo/client";

export const BULK_IMPORT_USERPROGRESS_EXCEL = gql`
  mutation BulkImportUserProgressExcel($file: Upload!) {
    bulkImportUserProgressExcel(file: $file) {
      insertedPetugas
      updatedPetugas
      insertedPengawas
      updatedPengawas
      errors { rowIndex message }
    }
  }
`;
