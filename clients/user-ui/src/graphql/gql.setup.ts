import {
  ApolloClient,
  ApolloLink,
  createHttpLink,
  InMemoryCache,
  split,
} from "@apollo/client";
import { setContext } from '@apollo/client/link/context';
import { createUploadLink } from "apollo-upload-client";
import { getMainDefinition } from "@apollo/client/utilities";
import Cookies from "js-cookie";

const auth = setContext((operation, prev) => ({
  headers: {
    ...prev.headers,
    accesstoken: typeof window !== 'undefined' ? localStorage.getItem('access_token') ?? '' : '',
    refreshtoken: typeof window !== 'undefined' ? localStorage.getItem('refresh_token') ?? '' : '',
    'apollo-require-preflight': 'true',
    'x-apollo-operation-name': operation.operationName || 'unknown',
  },
}));

const userLink = createUploadLink({
  uri: process.env.NEXT_PUBLIC_USER_SERVER_URI, // 4001
}) as any;
const surveyLink = createUploadLink({
  uri: process.env.NEXT_PUBLIC_SURVEYACT_SERVER_URI, // 4002
}) as any;

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    if (
      definition.kind === "OperationDefinition" &&
      typeof definition.name?.value === "string"
    ) {
      return (
        definition.name.value.toLowerCase().includes("survey") ||
        definition.name.value.toLowerCase().includes("progress") ||
        definition.name.value.toLowerCase().includes("spj") ||
        definition.name.value.toLowerCase().includes("jobletter") ||
        definition.name.value.toLowerCase().includes("issue") ||
        definition.name.value.toLowerCase().includes("patchuser") ||
        definition.name.value.toLowerCase().includes("monthly") ||
        definition.name.value.toLowerCase().includes("yearly") ||
        definition.name.value.toLowerCase().includes("district") ||
        definition.name.value.toLowerCase().includes("village") ||
        definition.name.value.toLowerCase().includes("usersamplephotos") ||
        definition.name.value.toLowerCase().includes("staffdoc") ||
        definition.name.value.toLowerCase().includes("mitrabulanan")
      );
    }
    return false;
  },
  surveyLink,
  userLink
);

const authMiddleware = new ApolloLink((operation, forward) => {
  operation.setContext({
    headers: {
      accesstoken: Cookies.get("access_token"),
      refreshtoken: Cookies.get("refresh_token"),
    },
  });
  return forward(operation);
});

export const graphqlClient = new ApolloClient({
  link: authMiddleware.concat(splitLink),
  cache: new InMemoryCache(),
});
