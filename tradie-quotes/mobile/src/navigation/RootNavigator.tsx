import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { useMe } from "../api/hooks";
import type { RootScreenProps, RootStackParamList } from "./types";
import { DashboardScreen } from "../screens/DashboardScreen";
import { CalendarScreen } from "../screens/CalendarScreen";
import { MoneyScreen } from "../screens/MoneyScreen";
import { ClientListScreen } from "../screens/ClientListScreen";
import { TimesheetScreen } from "../screens/TimesheetScreen";
import { BusinessSetupScreen } from "../screens/BusinessSetupScreen";
import { QuoteBuilderScreen } from "../screens/QuoteBuilderScreen";
import { PdfPreviewScreen } from "../screens/PdfPreviewScreen";
import { ClientDetailScreen } from "../screens/ClientDetailScreen";
import { SafetyLibraryScreen } from "../screens/SafetyLibraryScreen";
import { AccountingSummaryScreen } from "../screens/AccountingSummaryScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

function Splash() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}

/** Lands after login, then replaces itself with the right first screen for
 * the signed-in user's role (Employees don't have a financial Dashboard). */
function HomeScreen({ navigation }: RootScreenProps<"Home">) {
  const me = useMe();
  useEffect(() => {
    if (me.data) {
      navigation.replace(me.data.role === "Owner" ? "Dashboard" : "Calendar");
    }
  }, [me.data, navigation]);
  return <Splash />;
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="Money" component={MoneyScreen} />
        <Stack.Screen name="Clients" component={ClientListScreen} />
        <Stack.Screen name="Timesheet" component={TimesheetScreen} />
        <Stack.Screen name="Business" component={BusinessSetupScreen} />
        <Stack.Screen name="QuoteBuilder" component={QuoteBuilderScreen} options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="PdfPreview" component={PdfPreviewScreen} options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="SafetyLibrary" component={SafetyLibraryScreen} options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="AccountingSummary" component={AccountingSummaryScreen} options={{ animation: "slide_from_right" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
