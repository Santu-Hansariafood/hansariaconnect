"use client";

import dynamic from "next/dynamic";

const CreateGroup = dynamic(() => import("@/components/pages/CreateGroup/CreateGroup"));

const page = () => {
  const user = { name: "John Doe" };
  const theme = {
    primary: "#10B981",
    textSize: "text-base",
    wallpaper: "bg-gray-50",
  };

  return <CreateGroup user={user} theme={theme} />;
};

export default page;
