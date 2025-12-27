"use client";

import { gql, DocumentNode } from "@apollo/client";

export const GET_MY_UNREAD_NOTIFICATION_COUNT: DocumentNode = gql`
  query MyUnreadNotificationCount {
    myUnreadNotificationCount {
      count
    }
  }
`;

export const GET_MY_NOTIFICATIONS: DocumentNode = gql`
  query MyNotifications($take: Int, $cursor: String) {
    myNotifications(take: $take, cursor: $cursor) {
      items {
        id
        type
        targetType
        targetId
        title
        body
        actorName
        channel
        isRead
        readAt
        createdAt
      }
      nextCursor
    }
  }
`;

export const MARK_NOTIFICATION_READ: DocumentNode = gql`
  mutation MarkNotificationRead($notificationId: String!) {
    markNotificationRead(notificationId: $notificationId)
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ: DocumentNode = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;
