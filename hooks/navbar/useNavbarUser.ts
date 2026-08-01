"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext/AppContext";

type User = {
  name?: string;
  photo?: string;
};

export function useNavbarUser(initialUser: User) {
  const { user: ctxUser } = useApp();
  const [navUser, setNavUser] = useState<User>({
    name: initialUser?.name,
    photo: initialUser?.photo,
  });

  useEffect(() => {
    const load = async () => {
      const id = (ctxUser as any)?.id;
      if (!id) {
        setNavUser(initialUser);
        return;
      }

      try {
        const res = await fetch(`/api/profile/${id}`, { credentials: "include" });
        const data = await res.json();

        if (data?.profile) {
          setNavUser({
            name: data.profile.name,
            photo: data.profile.photo,
          });
        } else {
          setNavUser(initialUser);
        }
      } catch {
        setNavUser(initialUser);
      }
    };

    load();
  }, [ctxUser, initialUser?.name, initialUser?.photo]);

  return navUser;
}
