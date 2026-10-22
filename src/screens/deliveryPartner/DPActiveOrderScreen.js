import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../../api/client';

const STEPS = [
  { key: 'accepted',         label: 'Heading to Shop',   next: 'arrived_at_shop',  buttonLabel: 'Arrived at Shop' },
  { key: 'arrived_at_shop',  label: 'At the Shop',       next: 'picked_up',        buttonLabel: 'Order Picked Up' },
  { key: 'picked_up',        label: 'Heading to Buyer',  next: 'arrived_at_buyer', buttonLabel: 'Arrived at Buyer' },
  { key: 'arrived_at_buyer', label: 'At Buyer Location', next: null,               buttonLabel: 'Enter Delivery OTP' },
];

export default function DPActiveOrderScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchOrder = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await client.get('/dp/orders/active/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        setOrder(res.data);
      } else {
        navigation.replace('DPHome');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, []);

  const currentStepIndex = order ? STEPS.findIndex((s) => s.key === order.dp_status) : -1;
  const currentStep = currentStepIndex >= 0 ? STEPS[currentStepIndex] : null;

  const handleAdvance = async () => {
    if (!currentStep) return;

    if (currentStep.next === null) {
      navigation.navigate('DPDeliveryOtp', { orderId: order.id });
      return;
    }

    setUpdating(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await client.post(
        `/dp/orders/${order.id}/status/`,
        { dp_status: currentStep.next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchOrder();
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to update status';
      Alert.alert('Error', msg);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1669ef" />
      </View>
    );
  }

  if (!order) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 24) + 20,
      }}
    >
      <Text style={styles.orderNumber}>Order #{order.order_number}</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="storefront-outline" size={18} color="#6B7280" />
          <Text style={styles.infoText}>{order.shop_name}</Text>
        </View>
        <Text style={styles.addressText}>{order.shop_address}</Text>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color="#6B7280" />
          <Text style={styles.infoText}>Delivery Address</Text>
        </View>
        <Text style={styles.addressText}>{order.delivery_address}</Text>
      </View>

      <View style={styles.stepperCard}>
        {STEPS.map((step, index) => {
          const isDone = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={[
                styles.stepDot,
                isDone && styles.stepDotDone,
                isCurrent && styles.stepDotCurrent,
              ]}>
                {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.paymentCard}>
        <Text style={styles.paymentLabel}>
          {order.payment_mode === 'cod' ? `Collect ₹${order.total_amount} (Cash on Delivery)` : 'Prepaid — no collection needed'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.actionBtn, updating && styles.btnDisabled]}
        onPress={handleAdvance}
        disabled={updating}
      >
        {updating
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.actionBtnText}>{currentStep?.buttonLabel}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orderNumber: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  infoCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, marginBottom: 16,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  infoText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  addressText: { fontSize: 13, color: '#6B7280', marginLeft: 26, marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#F0EFEA', marginVertical: 8 },
  stepperCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, marginBottom: 16,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  stepDotCurrent: { borderColor: '#1669ef', borderWidth: 3 },
  stepLabel: { fontSize: 14, color: '#9CA3AF' },
  stepLabelCurrent: { color: '#111827', fontWeight: '700' },
  paymentCard: {
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginBottom: 20,
  },
  paymentLabel: { fontSize: 13, color: '#92400E', fontWeight: '600', textAlign: 'center' },
  actionBtn: {
    backgroundColor: '#1669ef', borderRadius: 12, paddingVertical: 15, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});