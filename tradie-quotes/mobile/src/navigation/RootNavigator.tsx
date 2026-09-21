import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "../theme/ThemeProvider";
import { useMe } from "../api/hooks";
import { TabBarIcon } from "./TabBarIcon";
import type { RootStackParamList, TabsParamList } from "./types";
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
const Tab = createBottomTabNavigator<TabsParamList>();

function Tabs() {
  const theme = useTheme();
  const me = useMe();

  if (me.isLoading || !me.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const isOwner = me.data.role === "Owner";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent.accent,
        tabBarInactiveTintColor: theme.colors.neutral[600],
        tabBarStyle: { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.divider },
        tabBarLabelStyle: { fontFamily: theme.fonts.body, fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase" },
      }}
    >
      {isOwner && <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} /> }} />}
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} round /> }} />
      {isOwner && <Tab.Screen name="Money" component={MoneyScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} /> }} />}
      <Tab.Screen name="Clients" component={ClientListScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} round /> }} />
      <Tab.Screen name="Timesheet" component={TimesheetScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} /> }} />
      {isOwner && <Tab.Screen name="Business" component={BusinessSetupScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} /> }} />}
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="QuoteBuilder" component={QuoteBuilderScreen} options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="PdfPreview" component={PdfPreviewScreen} options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="SafetyLibrary" component={SafetyLibraryScreen} options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="AccountingSummary" component={AccountingSummaryScreen} options={{ animation: "slide_from_right" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
