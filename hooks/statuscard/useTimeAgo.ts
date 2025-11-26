"use client";

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";

export const useTimeAgo = (timestamp: string | number | Date) => {
  return useMemo(
    () =>
      formatDistanceToNow(new Date(timestamp), {
        addSuffix: true,
      }),
    [timestamp]
  );
};
