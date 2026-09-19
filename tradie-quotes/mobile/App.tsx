import React from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useFonts, Barlow_400Regular, Barlow_500Medium, Barlow_700Bold } from "@expo-google-fonts/barlow";
import { BarlowCondensed_400Regular, BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed";

import { AuthProvider, useAuth } from "./src/state/auth";
import { ThemeProvider } from "./src/theme/ThemeProvider";
import { useBusiness } from "./src/api/hooks";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RootNavigator } from "./src/navigation/RootNavigator";

const queryClient = new QueryClient();

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f2f2f3" }}>
      <ActivityIndicator />
    </View>
  );
}

function AuthedApp() {
  const business = useBusiness();
  if (business.isLoading || !business.data) return <Splash />;
  return (
    <ThemeProvider accent={business.data.accentColor}>
      <RootNavigator />
    </ThemeProvider>
  );
}

function AppShell() {
  const { ready, signedIn } = useAuth();
  if (!ready) return <Splash />;
  if (!signedIn) {
    return (
      <ThemeProvider accent="#5980a6">
        <LoginScreen />
      </ThemeProvider>
    );
  }
  return <AuthedApp />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_700Bold,
    BarlowCondensed_400Regular,
    BarlowCondensed_600SemiBold,
  });

  if (!fontsLoaded) return <Splash />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
