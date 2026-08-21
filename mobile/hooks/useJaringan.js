import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useJaringan() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const lepas = NetInfo.addEventListener((s) => {
      setOnline(!!(s.isConnected && s.isInternetReachable !== false));
    });
    NetInfo.fetch().then((s) => {
      setOnline(!!(s.isConnected && s.isInternetReachable !== false));
    });
    return lepas;
  }, []);

  return online;
}
