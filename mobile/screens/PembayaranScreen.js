import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { buatPesanan, simulasikanBayar } from "../api/endpoints";
import { antre } from "../api/outbox";
import { benefitsOf } from "../data/eventMeta";
import { useJaringan } from "../hooks/useJaringan";
import { colors } from "../theme";

function emailOk(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function fmtRp(n) {
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

export default function PembayaranScreen({ route, navigation }) {
  const { eventId, title, seatCodes, qty, amountIdr } = route.params;
  const online = useJaringan();
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);
  const [email, setEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");

  const cats = useMemo(() => {
    const set = new Set();
    for (const c of seatCodes || []) {
      const part = String(c).split("-")[0];
      if (part) set.add(part.replace(/\d+$/, "") || part);
    }
    return [...set];
  }, [seatCodes]);

  const benLines = useMemo(() => {
    if (!eventId) return [];
    const codes = cats.length ? cats : ["REG"];
    return codes.flatMap((c) => benefitsOf(eventId, c).slice(0, 2));
  }, [eventId, cats]);

  async function bayar() {
    if (memuat) return;

    const name = buyerName.trim();
    const mail = email.trim();
    if (!name || name.length < 2) {
      setGalat("Isi nama pembeli dulu (min. 2 huruf).");
      return;
    }
    if (!mail) {
      setGalat("Isi email e-ticket dulu.");
      return;
    }
    if (!emailOk(mail)) {
      setGalat("Format email tidak valid.");
      return;
    }

    setMemuat(true);
    setGalat(null);

    const body = {
      eventId,
      qty: qty || seatCodes?.length || 1,
      seatCodes,
      email: mail,
      buyerName: name,
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
            buyerEmail: mail,
            buyerName: name,
            amountIdr: amountIdr,
          },
          title,
          seatCodes,
          pendingSync: true,
          benefits: benLines,
        });
        return;
      }

      let pesanan = await buatPesanan(body);
      // sama web: settle mock jika belum CONFIRMED
      if (pesanan?.orderId && pesanan.status !== "CONFIRMED") {
        try {
          const pay = await simulasikanBayar(pesanan.orderId);
          if (pay?.ok || pay?.status === "CONFIRMED") {
            pesanan = {
              ...pesanan,
              status: pay.status || "CONFIRMED",
              amountIdr: pay.amountIdr ?? pesanan.amountIdr,
            };
          }
        } catch {
          /* tetap lanjut ke e-ticket dengan status order */
        }
      }

      navigation.replace("ETicket", {
        pesanan: {
          ...pesanan,
          buyerEmail: pesanan.buyerEmail || mail,
          buyerName: pesanan.buyerName || name,
          amountIdr: pesanan.amountIdr ?? amountIdr,
        },
        title,
        seatCodes: pesanan.seatCodes?.length ? pesanan.seatCodes : seatCodes,
        benefits: benLines,
      });
    } catch (e) {
      if (e.status === 409) {
        setGalat("Kursi/kuota baru saja habis. Pilih kursi lain.");
      } else if (e.status === 429) {
        setGalat("Server sibuk (batas laju). Coba lagi sebentar.");
      } else if (e.status === 400) {
        setGalat(e.message || "Data tidak valid (nama/email/qty).");
      } else if (!e.status) {
        try {
          await antre({ path: "/orders", body, meta: { title, seatCodes } });
          navigation.replace("ETicket", {
            pesanan: {
              orderId: `PENDING-${Date.now()}`,
              status: "PENDING_SYNC",
              buyerEmail: mail,
              buyerName: name,
              amountIdr,
            },
            title,
            seatCodes,
            pendingSync: true,
            benefits: benLines,
          });
          return;
        } catch {
          setGalat(
            e.message ||
              "Jaringan bermasalah. Periksa API & BASE_URL di config.js."
          );
        }
      } else {
        setGalat(`Gagal (${e.status}). ${e.message || ""}`.trim());
      }
    } finally {
      setMemuat(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>Pembayaran</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {qty} tiket · {(seatCodes || []).join(", ") || "tanpa seat code"}
        </Text>
        {amountIdr != null ? (
          <Text style={styles.total}>{fmtRp(amountIdr)}</Text>
        ) : null}

        {benLines.length > 0 ? (
          <View style={styles.benBox}>
            <Text style={styles.benH}>Benefit zona</Text>
            {benLines.map((b, i) => (
              <Text key={i} style={styles.benL}>
                · {b}
              </Text>
            ))}
          </View>
        ) : null}

        {!online && (
          <Text style={styles.warn}>
            Offline: pesanan masuk antrean dan dikirim otomatis saat online.
          </Text>
        )}

        <Text style={styles.label}>Nama pembeli *</Text>
        <TextInput
          style={styles.input}
          value={buyerName}
          onChangeText={setBuyerName}
          placeholder="Nama di e-ticket"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          editable={!memuat}
        />

        <Text style={styles.label}>Email e-ticket *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="nama@email.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!memuat}
        />

        <Text style={styles.note}>
          Nama dan email wajib. Setelah bayar, e-ticket dikirim ke email (lab
          outbox) dan QR disimpan di HP.
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  wrap: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  kicker: {
    color: colors.accent,
    fontWeight: "800",
    letterSpacing: 1.2,
    fontSize: 11,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
    letterSpacing: -0.3,
  },
  meta: { color: colors.muted, marginTop: 8, fontSize: 14 },
  total: {
    color: colors.accentDark,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  benBox: {
    marginTop: 14,
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  benH: {
    color: colors.accentDark,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4,
  },
  benL: { color: "#047857", fontSize: 12, lineHeight: 18 },
  warn: {
    color: colors.warning,
    marginTop: 14,
    fontWeight: "600",
    backgroundColor: colors.warningSoft,
    padding: 12,
    borderRadius: 12,
    overflow: "hidden",
    fontSize: 13,
  },
  label: {
    color: colors.muted,
    marginTop: 18,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 16,
  },
  note: { color: colors.muted2, marginTop: 16, lineHeight: 20, fontSize: 13 },
  err: {
    color: colors.danger,
    marginTop: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  btn: {
    marginTop: 28,
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  btnOff: { opacity: 0.6 },
  btnText: { color: colors.onAccent, fontWeight: "800", fontSize: 16 },
});
