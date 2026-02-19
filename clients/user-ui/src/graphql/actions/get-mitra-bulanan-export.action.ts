import { gql } from "@apollo/client";

export const GET_MITRA_BULANAN_EXPORT = gql`
  query GetMitraBulananExport($year: Int!) {
    getMitraBulananExport(year: $year) {
      year
      month
      userId
      name
      job_name
      district
      city
      subsurveyactivity
      startDate
      endDate
      totalAssigned
      sampleType
      unitWorkPrice
      docsBill
      budgetCode
      limit_bill
      chiefName
      dipa
    }
  }
`;
