import React from "react";
import { View, ViewProps, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

/** An elevated "paper" surface — rounded corners + a soft realistic shadow,
 * standing in for a physical card or sheet sitting above the background. */
export function BlueprintBox({
  style,
  children,
  elevation = 1,
  ...rest
}: ViewProps & { noCorners?: boolean; elevation?: 0 | 1 | 2 | 3 | 4 }) {
  const theme = useTheme();
  return (
    <View style={[styles.shadowWrap, { borderRadius: theme.radius.lg }, theme.elevation(elevation)]}>
      <View
        style={[
          styles.surface,
          { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: { position: "relative" },
  surface: { overflow: "hidden" },
});
