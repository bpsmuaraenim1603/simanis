import { gql } from "@apollo/client";

export const GET_VILLAGES_BY_DISTRICT = gql`
  query VillagesByDistrict($districtId: ID!) {
    villagesByDistrict(districtId: $districtId) {
      id
      name
      coderegion
      districtId
    }
  }
`;
