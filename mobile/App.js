import "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AdminScreen from "./screens/AdminScreen";
import AntreanScreen from "./screens/AntreanScreen";
import DaftarScreen from "./screens/DaftarScreen";
import DenahScreen from "./screens/DenahScreen";
import ETicketScreen from "./screens/ETicketScreen";
import PembayaranScreen from "./screens/PembayaranScreen";
import RoleGateScreen from "./screens/RoleGateScreen";
import { BASE_URL } from "./config";
import { colors } from "./theme";

const Stack = createNativeStackNavigator();

const header = {
  headerStyle: {
    backgroundColor: colors.headerBg,
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontWeight: "800",
    fontSize: 17,
    color: colors.text,
  },
  headerShadowVisible: false,
  headerBorderBottomWidth: 1,
  contentStyle: { backgroundColor: colors.bg },
};

function HeaderPill({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={pill.btn}>
      <Text style={pill.txt}>{label}</Text>
    </Pressable>
  );
}

const pill = StyleSheet.create({
  btn: {
    marginRight: 12,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  txt: {
    color: colors.accentDark,
    fontWeight: "800",
    fontSize: 12,
  },
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error("[WTK]", err, info?.componentStack);
  }
  render() {
    if (this.state.err) {
      return (
        <View style={eb.wrap}>
          <Text style={eb.title}>Terjadi kesalahan</Text>
          <Text style={eb.msg}>
            {String(this.state.err?.message || this.state.err)}
          </Text>
          <Text style={eb.api}>API: {BASE_URL}</Text>
          <Pressable
            style={eb.btn}
            onPress={() => this.setState({ err: null })}
          >
            <Text style={eb.btnText}>Coba lagi</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  title: { color: colors.danger, fontSize: 18, fontWeight: "800" },
  msg: { color: colors.muted, marginTop: 12, lineHeight: 20 },
  api: { color: colors.muted2, marginTop: 12, fontSize: 12 },
  btn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: colors.onAccent, fontWeight: "800" },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer>
            <StatusBar style="dark" />
            <Stack.Navigator initialRouteName="RoleGate" screenOptions={header}>
              <Stack.Screen
                name="RoleGate"
                component={RoleGateScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Daftar"
                component={DaftarScreen}
                options={({ navigation }) => ({
                  title: "WTK Ticket",
                  headerRight: () => (
                    <HeaderPill
                      label="Peran"
                      onPress={() => navigation.replace("RoleGate")}
                    />
                  ),
                })}
              />
              <Stack.Screen
                name="Denah"
                component={DenahScreen}
                options={{ title: "Denah & booking" }}
              />
              <Stack.Screen
                name="Antrean"
                component={AntreanScreen}
                options={{ title: "Antrean" }}
              />
              <Stack.Screen
                name="Pembayaran"
                component={PembayaranScreen}
                options={{ title: "Pembayaran" }}
              />
              <Stack.Screen
                name="ETicket"
                component={ETicketScreen}
                options={{ title: "E-Ticket", headerBackVisible: false }}
              />
              <Stack.Screen
                name="Admin"
                component={AdminScreen}
                options={({ navigation }) => ({
                  title: "Admin",
                  headerRight: () => (
                    <HeaderPill
                      label="Peran"
                      onPress={() => navigation.replace("RoleGate")}
                    />
                  ),
                })}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
