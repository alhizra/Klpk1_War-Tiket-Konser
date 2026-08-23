import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export default function RoleGateScreen({ navigation }) {
  return (
    <View style={s.root}>
      <View style={s.hero}>
        <Text style={s.eye}>WAR TIKET KONSER</Text>
        <Text style={s.logo}>
          WTK<Text style={s.logoG}>TICKET</Text>
        </Text>
        <Text style={s.h1}>Masuk sebagai</Text>
        <Text style={s.sub}>Pilih peran sebelum membuka dashboard</Text>
      </View>

      <View style={s.cards}>
        <Pressable style={s.card} onPress={() => navigation.replace("Daftar")}>
          <View style={[s.iconBox, s.iconUser]}>
            <Text style={s.icon}>👤</Text>
          </View>
          <View style={s.body}>
            <Text style={s.title}>User</Text>
            <Text style={s.desc}>Beli tiket · konser · denah & booking</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </Pressable>

        <Pressable
          style={[s.card, s.cardAdmin]}
          onPress={() => navigation.replace("Admin")}
        >
          <View style={[s.iconBox, s.iconAdmin]}>
            <Text style={s.icon}>🛠️</Text>
          </View>
          <View style={s.body}>
            <Text style={s.title}>Admin</Text>
            <Text style={s.desc}>Tambah konser · stok · pantau order</Text>
          </View>
          <Text style={[s.arrow, { color: colors.accent2 }]}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  hero: {
    backgroundColor: "#0b1a12",
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  eye: {
    color: "#4ade80",
    fontWeight: "800",
    letterSpacing: 2,
    fontSize: 11,
    marginBottom: 10,
  },
  logo: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  logoG: { color: colors.accent },
  h1: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sub: {
    color: "#94a3b8",
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  cards: {
    padding: 20,
    marginTop: -8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardAdmin: {
    borderColor: "#bae6fd",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  iconUser: { backgroundColor: colors.accentSoft },
  iconAdmin: { backgroundColor: colors.accent2Soft },
  icon: { fontSize: 22 },
  body: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  desc: {
    color: colors.muted,
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
  arrow: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: "300",
    marginLeft: 4,
  },
});
