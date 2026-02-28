// packages/mobile-app/src/screens/PaymentScreen.tsx
// React Native payment screen.
// Mirrors web PaymentForm but with mobile-specific concerns.

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useTransactions } from "@finpay/shared/hooks/useTransactions";
import { formatCurrency } from "@finpay/shared/utils/currency";

interface PaymentScreenProps {
  route: {
    params: {
      fromAccountId: string;
      toAccountId: string;
    };
  };
  navigation: any; // BUG 26 (LOW): using 'any' for navigation type
                   // Should use typed navigation from @react-navigation/native
}

/**
 * BUG 27 (MEDIUM - React Native specific): Keyboard doesn't dismiss on submit.
 * After payment is sent, the keyboard stays visible.
 * Should call Keyboard.dismiss() on successful submission.
 *
 * BUG 28 (MEDIUM - React Native specific): No handling for app going to background.
 * If the user backgrounds the app mid-payment (presses home button),
 * the payment may still process but the success handler won't fire.
 * Should use AppState listener to handle this case.
 *
 * BUG 29 (MEDIUM): Alert.alert used for errors on iOS shows an alert dialog
 * which blocks the UI. On Android it behaves differently.
 * Cross-platform error display should use a consistent in-screen component.
 */
export function PaymentScreen({ route, navigation }: PaymentScreenProps) {
  const { fromAccountId, toAccountId } = route.params;
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { sendPayment } = useTransactions(fromAccountId);

  /**
   * BUG 30 (MEDIUM): Navigation happens before state cleanup.
   * After successful payment, navigation.goBack() is called,
   * but setIsSubmitting(false) may be called on unmounted component
   * since navigation removes this screen from the stack.
   * Should use isMounted ref pattern or cleanup in useEffect.
   */
  const handleSubmit = useCallback(async () => {
    if (!amount || !description) {
      Alert.alert("Error", "Please fill in all fields"); // BUG 29
      return;
    }

    setIsSubmitting(true);

    const success = await sendPayment(
      fromAccountId,
      toAccountId,
      amount,
      description
    );

    setIsSubmitting(false); // BUG 30: may run after component unmounted

    if (success) {
      Alert.alert(
        "Success",
        `Payment of ${formatCurrency(parseFloat(amount) * 100)} sent!`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
        // BUG 29: Alert.alert inconsistent across platforms
      );
    } else {
      Alert.alert("Error", "Payment failed. Please try again."); // BUG 29
    }
  }, [amount, description, fromAccountId, toAccountId, sendPayment, navigation]);

  /**
   * BUG 31 (LOW - React Native): No numeric keyboard for amount field.
   * keyboardType="decimal-pad" should be set on the amount input
   * so the numeric keyboard appears automatically on mobile.
   */
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.form}>
        <Text style={styles.title}>Send Payment</Text>

        <Text style={styles.label}>Amount ($)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          // BUG 31: missing keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="What's this for?"
        />

        {/* Amount preview */}
        {amount ? (
          <Text style={styles.preview}>
            You will send: {formatCurrency(parseFloat(amount) * 100)}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Payment</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  form: { padding: 24, flex: 1 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 32, color: "#1a1a2e" },
  label: { fontSize: 14, color: "#666", marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  preview: { marginTop: 16, fontSize: 16, color: "#333", fontWeight: "500" },
  button: {
    backgroundColor: "#4a90e2",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 32,
  },
  buttonDisabled: { backgroundColor: "#a0c4f1" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
