import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AntreanScreen from "./screens/AntreanScreen";
import DaftarScreen from "./screens/DaftarScreen";
import DenahScreen from "./screens/DenahScreen";
import ETicketScreen from "./screens/ETicketScreen";
import PembayaranScreen from "./screens/PembayaranScreen";
import { colors } from "./theme";

const Stack = createNativeStackNavigator();

const header = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "700" },
  contentStyle: { backgroundColor: colors.bg },
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <View style={eb.wrap}>
          <Text style={eb.title}>Error di app</Text>
          <Text style={eb.msg}>{String(this.state.err?.message || this.state.err)}</Text>
          <Pressable style={eb.btn} onPress={() => this.setState({ err: null })}>
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
  btn: {
    marginTop: 20,
    backgroundColor: colors.accent2,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: colors.bg, fontWeight: "800" },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator screenOptions={header}>
            <Stack.Screen
              name="Daftar"
              component={DaftarScreen}
              options={{ title: "WTK Ticket · Open Concert" }}
            />
            <Stack.Screen
              name="Denah"
              component={DenahScreen}
              options={{ title: "Denah & pilih kursi" }}
            />
            <Stack.Screen
              name="Antrean"
              component={AntreanScreen}
              options={{ title: "Antrean virtual" }}
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
          </Stack.Navigator>
        </NavigationContainer>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
