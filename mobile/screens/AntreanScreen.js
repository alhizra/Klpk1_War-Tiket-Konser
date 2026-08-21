import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export default function AntreanScreen({ route, navigation }) {
  const { eventId, title, seatCodes, qty } = route.params;
  const [detik, setDetik] = useState(3);

  useEffect(() => {
    if (detik <= 0) return;
    const t = setTimeout(() => setDetik((d) => d - 1), 1000);
    return () => clearTimeout(t);
  }, [detik]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>Antrean virtual</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {qty} kursi · {seatCodes?.join(", ")}
      </Text>

      {detik > 0 ? (
        <>
          <ActivityIndicator
            size="large"
            color={colors.accent2}
            style={{ marginTop: 40 }}
          />
          <Text style={styles.count}>Masuk gerbang bayar dalam {detik}…</Text>
        </>
      ) : (
        <>
          <Text style={styles.ready}>Giliranmu siap</Text>
          <Pressable
            style={styles.btn}
            onPress={() =>
              navigation.navigate("Pembayaran", {
                eventId,
                title,
                seatCodes,
                qty,
              })
            }
          >
            <Text style={styles.btnText}>Lanjut pembayaran</Text>
          </Pressable>
        </>
      )}
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
  kicker: { color: colors.accent2, fontWeight: "700", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 8 },
  meta: { color: colors.muted, marginTop: 8 },
  count: { color: colors.muted, textAlign: "center", marginTop: 16 },
  ready: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 32,
    textAlign: "center",
  },
  btn: {
    marginTop: 20,
    backgroundColor: colors.accent2,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: colors.bg, fontWeight: "800" },
});
