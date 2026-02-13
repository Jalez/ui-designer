"use client";

import { useCallback, useState } from "react";
import { ActiveUser } from "../types";
import { generateUserColor } from "../utils";

interface UseCollaborationPresenceOptions {
  onUserJoined?: (user: ActiveUser) => void;
  onUserLeft?: (userId: string) => void;
}

interface UseCollaborationPresenceReturn {
  activeUsers: ActiveUser[];
  addUser: (user: ActiveUser) => void;
  removeUser: (userId: string) => void;
  setUsers: (users: ActiveUser[]) => void;
  clearUsers: () => void;
  getUserByClientId: (clientId: string) => ActiveUser | undefined;
}

export function useCollaborationPresence(
  options: UseCollaborationPresenceOptions = {}
): UseCollaborationPresenceReturn {
  const { onUserJoined, onUserLeft } = options;

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  const addUser = useCallback(
    (user: ActiveUser) => {
      setActiveUsers((prev) => {
        const existing = prev.find((u) => u.userId === user.userId);
        if (existing) {
          return prev;
        }
        const newUser = {
          ...user,
          color: user.color || generateUserColor(user.userEmail),
        };
        onUserJoined?.(newUser);
        return [...prev, newUser];
      });
    },
    [onUserJoined]
  );

  const removeUser = useCallback(
    (userId: string) => {
      setActiveUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== userId);
        if (filtered.length !== prev.length) {
          onUserLeft?.(userId);
        }
        return filtered;
      });
    },
    [onUserLeft]
  );

  const setUsers = useCallback((users: ActiveUser[]) => {
    setActiveUsers(
      users.map((u) => ({
        ...u,
        color: u.color || generateUserColor(u.userEmail),
      }))
    );
  }, []);

  const clearUsers = useCallback(() => {
    setActiveUsers([]);
  }, []);

  const getUserByClientId = useCallback(
    (clientId: string): ActiveUser | undefined => {
      return activeUsers.find((u) => u.clientId === clientId);
    },
    [activeUsers]
  );

  return {
    activeUsers,
    addUser,
    removeUser,
    setUsers,
    clearUsers,
    getUserByClientId,
  };
}
