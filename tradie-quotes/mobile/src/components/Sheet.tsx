import React from "react";
import { Modal, Pressable, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(29,31,32,0.45)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.colors.bg,
            borderTopWidth: 1,
            borderColor: theme.colors.divider,
            padding: 16,
            paddingBottom: 34,
          }}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
