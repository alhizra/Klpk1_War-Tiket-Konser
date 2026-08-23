import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ambilOutboxTiket } from "../api/endpoints";
import { simpanTiket } from "../api/tickets";
import { colors } from "../theme";

function fmtRp(n) {
  if (n == null || n === "") return null;
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  } catch {
    return `Rp ${n}`;
  }
}

/** E-ticket QR + receipt (selaras web) */
export default function ETicketScreen({ route, navigation }) {
  const { pesanan, title, seatCodes, pendingSync, benefits } = route.params || {};
  const kode =
    pesanan?.orderId || `WTK-${Date.now().toString(36).toUpperCase()}`;
  const seats =
    (seatCodes || pesanan?.seatCodes || []).join(" · ") || "GA / standing";
  const [Qr, setQr] = useState(null);
  const [mailStatus, setMailStatus] = useState(null);
  const [mailHint, setMailHint] = useState(null);

  useEffect(() => {
    simpanTiket({
      orderId: kode,
      title: title || "Konser",
      seatCodes: seatCodes || pesanan?.seatCodes || [],
      status: pesanan?.status || "CONFIRMED",
      amountIdr: pesanan?.amountIdr,
      buyerEmail: pesanan?.buyerEmail,
      buyerName: pesanan?.buyerName,
      pendingSync: !!pendingSync,
    }).catch(() => {});
  }, [kode]);

  useEffect(() => {
    let ok = true;
    import("react-native-qrcode-svg")
      .then((m) => {
        if (ok) setQr(() => m.default);
      })
      .catch(() => {
        if (ok) setQr(null);
      });
    return () => {
      ok = false;
    };
  }, []);

  // poll e-ticket outbox seperti web
  useEffect(() => {
    if (pendingSync || !pesanan?.orderId) return;
    if (String(pesanan.orderId).startsWith("PENDING")) return;
    let stop = false;
    let n = 0;
    async function poll() {
      if (stop || n > 8) return;
      n += 1;
      try {
        const r = await ambilOutboxTiket(pesanan.orderId);
        if (stop) return;
        if (r?.found || r?.status === "SENT" || r?.to) {
          setMailStatus("sent");
          setMailHint(
            r.to
              ? `E-ticket dikirim ke ${r.to}`
              : "E-ticket ada di outbox lab"
          );
          return;
        }
        setMailStatus("pending");
        setMailHint("E-ticket sedang diproses…");
        setTimeout(poll, 900);
      } catch {
        if (!stop) {
          setMailStatus("pending");
          setMailHint("Cek email beberapa saat lagi");
        }
      }
    }
    poll();
    return () => {
      stop = true;
    };
  }, [pesanan?.orderId, pendingSync]);

  const qrValue = JSON.stringify({
    orderId: kode,
    title: title || "Konser",
    seats: seatCodes || pesanan?.seatCodes || [],
    status: pesanan?.status || "CONFIRMED",
  });

  const amount = fmtRp(pesanan?.amountIdr);
  const paid =
    !pendingSync &&
    String(pesanan?.status || "CONFIRMED").toUpperCase() !== "PENDING";

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>
        {paid ? "Booking confirmed" : "E-Ticket"}
      </Text>
      <Text style={styles.title}>{title || "Konser"}</Text>

      {pendingSync ? (
        <Text style={styles.pending}>
          Menunggu sinkron — akan dikirim saat online
        </Text>
      ) : null}

      <View style={styles.receipt}>
        <View style={styles.recRow}>
          <Text style={styles.recK}>Kode booking</Text>
          <Text style={styles.recV}>{kode}</Text>
        </View>
        <View style={styles.recRow}>
          <Text style={styles.recK}>Status</Text>
          <Text style={[styles.recV, paid && styles.ok]}>
            {pesanan?.status || "CONFIRMED"}
          </Text>
        </View>
        <View style={styles.recRow}>
          <Text style={styles.recK}>Kursi</Text>
          <Text style={styles.recV}>{seats}</Text>
        </View>
        {amount ? (
          <View style={styles.recRow}>
            <Text style={styles.recK}>Total</Text>
            <Text style={styles.recV}>{amount}</Text>
          </View>
        ) : null}
        {pesanan?.buyerName ? (
          <View style={styles.recRow}>
            <Text style={styles.recK}>Nama</Text>
            <Text style={styles.recV}>{pesanan.buyerName}</Text>
          </View>
        ) : null}
        {pesanan?.buyerEmail ? (
          <View style={styles.recRow}>
            <Text style={styles.recK}>Email</Text>
            <Text style={styles.recV}>{pesanan.buyerEmail}</Text>
          </View>
        ) : null}
        {Array.isArray(benefits) && benefits.length > 0 ? (
          <View style={styles.benBlock}>
            <Text style={styles.recK}>Benefit</Text>
            {benefits.map((b, i) => (
              <Text key={i} style={styles.benL}>
                · {b}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.box}>
        {Qr ? (
          <Qr value={qrValue} size={180} backgroundColor="#fff" />
        ) : (
          <View style={styles.qrFallback}>
            <Text style={styles.qrFallbackText}>ORDER</Text>
            <Text style={styles.codeDark}>{kode}</Text>
          </View>
        )}
        <Text style={styles.sub}>Tunjukkan QR di pintu masuk</Text>
        {mailStatus === "pending" ? (
          <View style={styles.mailRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.mailT}>{mailHint}</Text>
          </View>
        ) : mailHint ? (
          <Text style={styles.mailOk}>{mailHint}</Text>
        ) : null}
        <Text style={styles.hint}>
          Tiket tersimpan di HP. Tetap tampil offline setelah dibuka sekali.
        </Text>
      </View>

      {pesanan?.sisa != null ? (
        <Text style={styles.meta}>Sisa kuota event: {pesanan.sisa}</Text>
      ) : null}

      <Pressable style={styles.btn} onPress={() => navigation.popToTop()}>
        <Text style={styles.btnText}>Kembali ke daftar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    justifyContent: "center",
  },
  kicker: {
    color: colors.accentDark,
    fontWeight: "800",
    letterSpacing: 1.2,
    fontSize: 11,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 8,
    letterSpacing: -0.2,
  },
  pending: {
    color: colors.warning,
    marginTop: 12,
    fontWeight: "600",
    backgroundColor: colors.warningSoft,
    padding: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  receipt: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  recRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  recK: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  recV: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  ok: { color: colors.accentDark },
  benBlock: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  benL: { color: "#475569", fontSize: 11, lineHeight: 16, marginTop: 2 },
  box: {
    marginTop: 14,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrFallback: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderColor: "#0f172a",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  qrFallbackText: { color: "#64748b", fontWeight: "700", fontSize: 12 },
  codeDark: {
    color: "#0f172a",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
  },
  sub: { color: "#475569", marginTop: 12, fontWeight: "600" },
  mailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  mailT: { color: colors.muted, fontSize: 12 },
  mailOk: {
    color: colors.accentDark,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
  hint: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 14,
    textAlign: "center",
  },
  meta: { color: colors.muted, marginTop: 12, textAlign: "center" },
  btn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  btnText: { color: colors.onAccent || "#fff", fontWeight: "800", fontSize: 15 },
});
