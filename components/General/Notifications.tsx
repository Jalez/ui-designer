/** @format */

import { useEffect } from "react";
import { VariantType, useSnackbar } from "notistack";
import { removeNotificationData } from "@/store/slices/notifications.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Notification } from "@/types";

const Notifications = () => {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const notifications = useAppSelector((state) => state.notifications);

  useEffect(() => {
    if (notifications.length > 0) {
      // setOpen(true);
      notifications.forEach((notification: Notification) => {
        enqueueSnackbar(notification.message, {
          variant: notification.type as VariantType,
        });
        dispatch(removeNotificationData(Number(notification.id)));
      });
    }
  }, [notifications]);

  return <></>;
};

export default Notifications;
