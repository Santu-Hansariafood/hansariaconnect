export const MOBILE_APP_SESSION_HEADER = "x-hansaria-mobile-app";

export const isMobileApp = (): boolean => {
  if (typeof window === "undefined") return false;

  const isStandalone =
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    );
  const isMobileDevice = /android|iphone|ipad|ipod/i.test(
    window.navigator.userAgent,
  );

  return isStandalone && isMobileDevice;
};

export const subscribeToMobileApp = (callback: () => void): (() => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};

  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", callback);
  return () => displayMode.removeEventListener("change", callback);
};
