"use client";

import { Suspense } from "react";
import Loading from "@/components/common/Loading/Loading";
import ScanLogin from "./scan-login";

export default function ScanPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ScanLogin />
    </Suspense>
  );
}
