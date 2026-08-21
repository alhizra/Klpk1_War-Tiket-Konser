import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { buatPesanan } from "../api/endpoints";
import { antre } from "../api/outbox";
import { useJaringan } from "../hooks/useJaringan";
import { colors } from "../theme";

export default function PembayaranScreen({ route, navigation }) {
  const { eventId, title, seatCodes, qty } = route.params;
  const online = useJaringan();
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);

  async function bayar() {
    if (memuat) return;
    setMemuat(true);
    setGalat(null);

    const body = {
      eventId,
      qty: qty || seatCodes?.length || 1,
      seatCodes,
    };

    try {
      if (!online) {
        await antre({
          path: "/orders",
          body,
          meta: { title, seatCodes },
        });
        navigation.replace("ETicket", {
          pesanan: {
            orderId: `PENDING-${Date.now()}`,
            status: "PENDING_SYNC",
            sisa: "—",
          },
          title,
          seatCodes,
          pendingSync: true,
        });
        return;
      }

      const pesanan = await buatPesanan(body);
      navigation.replace("ETicket", {
        pesanan,
        title,
        seatCodes: pesanan.seatCodes?.length ? pesanan.seatCodes : seatCodes,
      });
    } catch (e) {
      if (e.status === 409) {
        setGalat("Kursi/kuota baru saja habis. Pilih kursi lain.");
      } else if (e.status === 429) {
        setGalat("Server sibuk (batas laju). Coba lagi sebentar.");
      } else if (!e.status) {
        // jaringan putus di tengah — antre
        try {
          await antre({ path: "/orders", body, meta: { title, seatCodes } });
          navigation.replace("ETicket", {
            pesanan: {
              orderId: `PENDING-${Date.now()}`,
              status: "PENDING_SYNC",
            },
            title,
            seatCodes,
            pendingSync: true,
          });
          return;
        } catch {
          setGalat("Jaringan bermasalah. Periksa koneksi lalu ulangi.");
        }
      } else {
        setGalat(`Gagal (${e.status}). ${e.message || ""}`.trim());
      }
    } finally {
      setMemuat(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>Pembayaran</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {qty} tiket · {(seatCodes || []).join(", ") || "tanpa seat code"}
      </Text>
      {!online && (
        <Text style={styles.warn}>
          Offline: pesanan masuk antrean dan dikirim otomatis saat online.
        </Text>
      )}
      <Text style={styles.note}>
        POST /orders memotong kuota atomik di server. Tombol terkunci saat
        memuat (cegah kirim ganda).
      </Text>

      {galat ? <Text style={styles.err}>{galat}</Text> : null}

      <Pressable
        style={[styles.btn, memuat && styles.btnOff]}
        onPress={bayar}
        disabled={memuat}
      >
        {memuat ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.btnText}>
            {online ? "Bayar sekarang" : "Simpan & antre (offline)"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  kicker: { color: colors.accent2, fontWeight: "700" },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 8 },
  meta: { color: colors.muted, marginTop: 8 },
  warn: { color: "#fbbf24", marginTop: 12, fontWeight: "600" },
  note: { color: colors.muted, marginTop: 16, lineHeight: 20 },
  err: { color: colors.danger, marginTop: 16, textAlign: "center" },
  btn: {
    marginTop: 28,
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnOff: { opacity: 0.6 },
  btnText: { color: "#052e16", fontWeight: "800", fontSize: 16 },
});
