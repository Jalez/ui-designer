import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Notification, NotificationRaw } from "@/types";

type NotificationState = Notification[];

const initialState: NotificationState = [];

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    addNotificationData: (state, action: PayloadAction<NotificationRaw>) => {
      const { payload } = action;
      const newNotification: Notification = {
        ...payload,
        id: `${Date.now() * Math.random()}`,
      };
      state.push(newNotification);
    },
    removeNotificationData: (state, action: PayloadAction<number>) => {
      const { payload } = action;

      const stateIndex = state.findIndex(
        (notification) => notification.id !== `${payload}`
      );
      state.splice(stateIndex, 1);
    },
  },
});

export const { addNotificationData, removeNotificationData } =
  notificationsSlice.actions;

export default notificationsSlice.reducer;
