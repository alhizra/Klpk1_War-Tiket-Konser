import { useEffect, useState } from "react";

/**
 * Status online — aman di web & native.
 * NetInfo kadang error di Expo Go; jangan crash app.
 */
export function useJaringan() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let lepas = () => {};
    let aktif = true;

    (async () => {
      try {
        const NetInfo = (await import("@react-native-community/netinfo")).default;
        if (!aktif) return;
        lepas = NetInfo.addEventListener((s) => {
          const ok = !!(s.isConnected && s.isInternetReachable !== false);
          setOnline(ok);
        });
        const s = await NetInfo.fetch();
        if (aktif) {
          setOnline(!!(s.isConnected && s.isInternetReachable !== false));
        }
      } catch {
        // fallback: anggap online
        if (aktif) setOnline(true);
      }
    })();

    return () => {
      aktif = false;
      try {
        lepas();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return online;
}
