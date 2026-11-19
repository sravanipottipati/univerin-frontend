import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OrderSuccessScreen({ navigation, route }) {
  const { order, calculatedTotal } = route.params || {};
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 50, friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const date = order?.created_at
    ? new Date(order.created_at).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Success Top ── */}
        <View style={styles.successTop}>

          {/* Animated checkmark circle */}
          <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons name="checkmark" size={50} color="#fff" />
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
            <Text style={styles.successTitle}>Order Placed! 🎉</Text>
            <Text style={styles.successSubtitle}>
              Your order has been placed successfully and the shop is preparing it now.
            </Text>
          </Animated.View>

          {/* Order ID pill */}
          <View style={styles.orderIdPill}>
            <Ionicons name="receipt-outline" size={14} color="#1669ef" />
            <Text style={styles.orderIdText}>
              Order #{order?.order_number || order?.id?.slice(0, 8).toUpperCase() || '—'}
            </Text>
          </View>
          {/* Estimated Delivery Time */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
            <Ionicons name="time-outline" size={16} color="#1669ef" />
            <Text style={{ fontSize: 13, color: '#1669ef', fontWeight: '700' }}>
              Estimated Delivery: {order?.estimated_delivery_time || 30}-{(order?.estimated_delivery_time || 30) + 15} mins
            </Text>
          </View>
        </View>

        {/* ── Order Details ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Details</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="cash-outline" size={16} color="#888" />
              <Text style={styles.detailLabel}>Total Amount</Text>
            </View>
            <Text style={[styles.detailValue, { color: '#1669ef', fontWeight: '800', fontSize: 16 }]}>
              ₹{calculatedTotal ? calculatedTotal.toFixed(1) : order?.total_amount || '0'}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="wallet-outline" size={16} color="#888" />
              <Text style={styles.detailLabel}>Payment</Text>
            </View>
            <Text style={styles.detailValue}>Cash on Delivery</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="time-outline" size={16} color="#888" />
              <Text style={styles.detailLabel}>Order Time</Text>
            </View>
            <Text style={styles.detailValue}>{date || '—'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="bicycle-outline" size={16} color="#888" />
              <Text style={styles.detailLabel}>Est. Delivery</Text>
            </View>
            <Text style={[styles.detailValue, { color: '#16A34A', fontWeight: '700' }]}>
              30 minutes
            </Text>
          </View>
        </View>



        {/* ── Delivery Address ── */}
        {order?.delivery_address && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivering To</Text>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={18} color="#1669ef" />
              <Text style={styles.addressText}>{order.delivery_address}</Text>
            </View>
          </View>
        )}

        {/* ── What Happens Next ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What happens next?</Text>
          {[
            { icon: 'checkmark-circle', color: '#1669ef', text: 'Order placed successfully' },
            { icon: 'storefront-outline', color: '#F59E0B', text: 'Shop is preparing your order' },
            { icon: 'bicycle-outline', color: '#8B5CF6', text: 'Delivery partner picks up' },
            { icon: 'home-outline', color: '#16A34A', text: 'Delivered to your door' },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Ionicons name={step.icon} size={20} color={step.color} />
              <Text style={[styles.stepText, i === 0 && { fontWeight: '700', color: '#111' }]}>
                {step.text}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Buttons ── */}
        <TouchableOpacity
          style={styles.trackBtn}
          onPress={() => navigation.navigate('OrderDetail', { orderId: order?.id })}
        >
          <Ionicons name="location-outline" size={18} color="#fff" />
          <Text style={styles.trackBtnText}>Track Order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('BuyerTabs', { screen: 'Home' })}
        >
          <Ionicons name="home-outline" size={18} color="#1669ef" />
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomTab}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Home' })}>
          <Ionicons name="home-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Cart' })}>
          <Ionicons name="cart-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('BuyerTabs', { screen: 'MyOrders' })}>
          <Ionicons name="receipt" size={22} color="#1669ef" />
          <Text style={styles.tabLabelActive}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Profile' })}>
          <Ionicons name="person-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  successTop: {
    alignItems: 'center', paddingTop: 60,
    paddingBottom: 30, paddingHorizontal: 24,
  },
  successCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#1669ef', justifyContent: 'center',
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#1669ef', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  successTitle: {
    fontSize: 24, fontWeight: '900', color: '#111',
    marginBottom: 10, textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14, color: '#888',
    textAlign: 'center', lineHeight: 22, marginBottom: 20,
  },
  orderIdPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eff6ff', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: '#dbeafe',
  },
  orderIdText: { fontSize: 13, color: '#1669ef', fontWeight: '700' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#111', marginBottom: 14 },
  divider:   { height: 1, backgroundColor: '#F5F5F5', marginVertical: 4 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  detailLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 13, color: '#888' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#111' },

  shopRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1669ef', justifyContent: 'center', alignItems: 'center',
  },
  shopAvatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  shopInfo:       { flex: 1 },
  shopName:       { fontSize: 15, fontWeight: 'bold', color: '#111', marginBottom: 2 },
  shopLocation:   { fontSize: 12, color: '#888' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#eff6ff', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1669ef' },
  statusText: { fontSize: 12, color: '#1669ef', fontWeight: '600' },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addressText: { fontSize: 14, color: '#555', lineHeight: 20, flex: 1 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  stepText: { fontSize: 13, color: '#888' },

  trackBtn: {
    backgroundColor: '#1669ef', borderRadius: 14,
    marginHorizontal: 16, marginBottom: 12,
    padding: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    shadowColor: '#1669ef', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  trackBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  homeBtn: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#dbeafe',
    marginHorizontal: 16, marginBottom: 12,
    padding: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  homeBtnText: { color: '#1669ef', fontSize: 16, fontWeight: '600' },
  bottomTab: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 24, paddingTop: 10,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  tabItem:        { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel:       { fontSize: 11, color: '#9CA3AF' },
  tabLabelActive: { fontSize: 11, color: '#1669ef', fontWeight: 'bold' },
});