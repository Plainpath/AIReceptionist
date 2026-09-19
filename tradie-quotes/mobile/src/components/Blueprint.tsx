import React from "react";
import { View, ViewProps, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

function Corner({ corner, color }: { corner: "tl" | "tr" | "bl" | "br"; color: string }) {
  const pos: any = { position: "absolute", width: 11, height: 11 };
  if (corner === "tl") Object.assign(pos, { top: -6, left: -6 });
  if (corner === "tr") Object.assign(pos, { top: -6, right: -6 });
  if (corner === "bl") Object.assign(pos, { bottom: -6, left: -6 });
  if (corner === "br") Object.assign(pos, { bottom: -6, right: -6 });
  return (
    <View style={pos} pointerEvents="none">
      <View style={{ position: "absolute", left: 5, top: 0, width: 1, height: "100%", backgroundColor: color }} />
      <View style={{ position: "absolute", top: 5, left: 0, height: 1, width: "100%", backgroundColor: color }} />
    </View>
  );
}

/** The "blueprint" wireframe frame: hairline border + four registration-mark corners. */
export function BlueprintBox({ style, children, noCorners, ...rest }: ViewProps & { noCorners?: boolean }) {
  const theme = useTheme();
  const cornerColor = "rgba(29,31,32,0.55)";
  return (
    <View style={[styles.box, { borderColor: theme.colors.divider }, style]} {...rest}>
      {!noCorners && (
        <>
          <Corner corner="tl" color={cornerColor} />
          <Corner corner="tr" color={cornerColor} />
          <Corner corner="bl" color={cornerColor} />
          <Corner corner="br" color={cornerColor} />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, position: "relative" },
});
