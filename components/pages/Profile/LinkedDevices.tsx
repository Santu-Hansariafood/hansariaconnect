"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, LoaderCircle, LogOut, Smartphone } from "lucide-react";
import { MAX_DEVICE_SESSIONS } from "@/lib/auth/deviceLimits";

type Device = {
  sessionId: string;
  browserName: string;
  deviceName: string;
  createdAt: number;
  current: boolean;
};

type LinkedDevicesProps = {
  onDevicesChange?: (count: number) => void;
};

const fetchDevices = async (): Promise<Device[]> => {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !Array.isArray(data?.user?.devices)) {
    throw new Error(data?.error || "Could not load your linked devices.");
  }
  return data.user.devices;
};

export default function LinkedDevices({
  onDevicesChange,
}: LinkedDevicesProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");

  const loadDevices = useCallback(async () => {
    try {
      const nextDevices = await fetchDevices();
      setDevices(nextDevices);
      onDevicesChange?.(nextDevices.length);
      setError("");
    } catch (loadError) {
      console.error("Failed to load linked devices:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your linked devices.",
      );
    } finally {
      setLoading(false);
    }
  }, [onDevicesChange]);

  useEffect(() => {
    let active = true;
    fetchDevices()
      .then((nextDevices) => {
        if (!active) return;
        setDevices(nextDevices);
        onDevicesChange?.(nextDevices.length);
      })
      .catch((loadError: unknown) => {
        console.error("Failed to load linked devices:", loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load your linked devices.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onDevicesChange]);

  const removeDevice = async (device: Device) => {
    if (
      device.current ||
      !window.confirm(
        `Log out ${device.browserName} on this linked device?`,
      )
    ) {
      return;
    }

    setRemovingId(device.sessionId);
    setError("");
    try {
      const response = await fetch("/api/auth/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: device.sessionId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Could not remove this device.");
      }
      await loadDevices();
    } catch (removeError) {
      console.error("Failed to remove linked device:", removeError);
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove this device.",
      );
    } finally {
      setRemovingId("");
    }
  };

  return (
    <section className="rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-[#e9edef]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#667781]">
            Linked devices
          </p>
          <p className="mt-1 text-sm text-[#54656f]">
            Up to {MAX_DEVICE_SESSIONS} devices can be signed in at once.
          </p>
        </div>
        <span className="rounded-full bg-[#e7f8f1] px-3 py-1 text-sm font-semibold text-[#008069]">
          {loading ? "…" : `${devices.length}/${MAX_DEVICE_SESSIONS}`}
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-[#667781]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading devices…
        </div>
      ) : devices.length === 0 ? (
        <p className="py-2 text-sm text-[#667781]">No linked devices found.</p>
      ) : (
        <ul className="divide-y divide-[#e9edef]">
          {devices.map((device) => (
            <li
              key={device.sessionId}
              className="flex items-center gap-3 py-3 first:pt-1 last:pb-1"
            >
              {device.deviceName.toLowerCase().includes("mobile") ? (
                <Smartphone className="h-5 w-5 shrink-0 text-[#008069]" />
              ) : (
                <Laptop className="h-5 w-5 shrink-0 text-[#008069]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#111b21]">
                  {device.browserName}
                  {device.current && (
                    <span className="ml-2 text-xs font-normal text-[#008069]">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-xs text-[#667781]">
                  {device.deviceName} ·{" "}
                  {new Date(device.createdAt).toLocaleDateString()}
                </p>
              </div>
              {!device.current && (
                <button
                  type="button"
                  onClick={() => void removeDevice(device)}
                  disabled={removingId === device.sessionId}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-medium text-[#b42318] transition hover:bg-red-50 disabled:opacity-50"
                  aria-label={`Log out ${device.browserName}`}
                >
                  {removingId === device.sessionId ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Log out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
