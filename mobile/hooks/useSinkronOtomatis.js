import { useEffect, useRef } from "react";
import { sinkron } from "../api/outbox";
import { useJaringan } from "./useJaringan";

/** Saat online kembali, kirim outbox (materi P4). */
export function useSinkronOtomatis(onDone) {
  const online = useJaringan();
  const pernahOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      pernahOffline.current = true;
      return;
    }
    if (!pernahOffline.current && online) {
      // tetap coba sinkron saat mount jika ada sisa outbox
    }
    let batal = false;
    sinkron()
      .then((h) => {
        if (!batal && h.terkirim > 0 && onDone) onDone(h);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [online]);

  return online;
}
