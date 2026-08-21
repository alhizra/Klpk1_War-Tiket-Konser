import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
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

export default function App() {
  return (
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
  );
}
