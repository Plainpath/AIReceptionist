import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeProvider";
import { useMe } from "../api/hooks";
import { Sheet } from "./Sheet";
import type { Role } from "../api/types";
import type { RootStackParamList } from "../navigation/types";

export type PageAction = { label: string; onPress: () => void; destructive?: boolean };

type NavItem = { key: keyof RootStackParamList; label: string; roles: Role[] };

const NAV_ITEMS: NavItem[] = [
  { key: "Dashboard", label: "Dashboard", roles: ["Owner"] },
  { key: "Calendar", label: "Calendar", roles: ["Owner", "Employee"] },
  { key: "Money", label: "Money", roles: ["Owner"] },
  { key: "Clients", label: "Clients", roles: ["Owner", "Employee"] },
  { key: "Timesheet", label: "Timesheet", roles: ["Owner", "Employee"] },
  { key: "Business", label: "Business", roles: ["Owner"] },
];

function Kebab({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
      <View style={{ gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.text }} />
        ))}
      </View>
    </Pressable>
  );
}

/** Shared top bar: a kebab menu (top-left) that's the app's main navigation,
 * a page title, and an optional second kebab (top-right) for actions
 * specific to that page. */
export function AppHeader({ title, actions }: { title: string; actions?: PageAction[] }) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const me = useMe();
  const [navOpen, setNavOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const items = NAV_ITEMS.filter((n) => !me.data || n.roles.includes(me.data.role));

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 }}>
        <Kebab onPress={() => setNavOpen(true)} />
        <Text
          style={{ flex: 1, textAlign: "center", fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.text }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {actions && actions.length > 0 ? <Kebab onPress={() => setActionsOpen(true)} /> : <View style={{ width: 34 }} />}
      </View>

      <Sheet visible={navOpen} onClose={() => setNavOpen(false)}>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: 19, color: theme.colors.text }}>Menu</Text>
        <View style={{ marginTop: 10 }}>
          {items.map((item, i) => (
            <Pressable
              key={item.key}
              onPress={() => {
                setNavOpen(false);
                navigation.navigate(item.key as never);
              }}
              style={{ paddingVertical: 15, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.colors.divider }}
            >
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: theme.colors.text }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      {actions && (
        <Sheet visible={actionsOpen} onClose={() => setActionsOpen(false)}>
          <Text style={{ fontFamily: theme.fonts.heading, fontSize: 19, color: theme.colors.text }}>{title}</Text>
          <View style={{ marginTop: 10 }}>
            {actions.map((a, i) => (
              <Pressable
                key={a.label}
                onPress={() => {
                  setActionsOpen(false);
                  a.onPress();
                }}
                style={{ paddingVertical: 15, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.colors.divider }}
              >
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 15.5, color: a.destructive ? "#c0392b" : theme.colors.text }}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Sheet>
      )}
    </>
  );
}
