import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../state/auth";
import { Button } from "../components/Button";

export function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState("owner@haleelectrical.com.au");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Couldn't sign in. Check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: 24, gap: 14 }}
      >
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: 30, color: theme.colors.text }}>
          Quotes & invoicing
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.neutral[700], marginBottom: 10 }}>
          Sign in to your business
        </Text>

        <View style={{ gap: 5 }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.neutral[700] }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              minHeight: 42,
              borderWidth: 1,
              borderColor: theme.colors.divider,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 12,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
            }}
          />
        </View>

        <View style={{ gap: 5 }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.neutral[700] }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              minHeight: 42,
              borderWidth: 1,
              borderColor: theme.colors.divider,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 12,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
            }}
          />
        </View>

        {error ? <Text style={{ color: "#b00020", fontFamily: theme.fonts.body, fontSize: 12.5 }}>{error}</Text> : null}

        <Button variant="primary" onPress={submit} minHeight={48} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: theme.fonts.heading, fontSize: 15 }}>Sign in</Text>}
        </Button>

        <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600], textAlign: "center", marginTop: 4 }}>
          Demo login · owner@haleelectrical.com.au / password123
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
