import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "../theme/ThemeProvider";
import { TabBarIcon } from "./TabBarIcon";
import type { RootStackParamList, TabsParamList } from "./types";
import { InboxScreen } from "../screens/InboxScreen";
import { MoneyScreen } from "../screens/MoneyScreen";
import { ClientListScreen } from "../screens/ClientListScreen";
import { BusinessSetupScreen } from "../screens/BusinessSetupScreen";
import { QuoteBuilderScreen } from "../screens/QuoteBuilderScreen";
import { PdfPreviewScreen } from "../screens/PdfPreviewScreen";
import { ClientDetailScreen } from "../screens/ClientDetailScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabsParamList>();

function Tabs() {
  const theme = useTheme();
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
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} /> }} />
      <Tab.Screen name="Money" component={MoneyScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} /> }} />
      <Tab.Screen name="Clients" component={ClientListScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} round /> }} />
      <Tab.Screen name="Business" component={BusinessSetupScreen} options={{ tabBarIcon: ({ color }) => <TabBarIcon color={color} /> }} />
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
