import React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useClients } from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import type { TabScreenProps } from "../navigation/types";

export function ClientListScreen({ navigation }: TabScreenProps<"Clients">) {
  const theme = useTheme();
  const clients = useClients();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 26, color: theme.colors.text }}>Clients</Text>
      </View>
      {clients.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={clients.data || []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate("ClientDetail", { clientId: item.id })}>
              <BlueprintBox style={{ padding: 13 }}>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.text }}>{item.name}</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.neutral[600], marginTop: 2 }}>
                  {item.address}
                </Text>
              </BlueprintBox>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
