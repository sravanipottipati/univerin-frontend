import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';

export default function DPOrderOfferScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);

  const fetchOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await client.get('/dp/orders/available/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(res.data);
    } catch (e) {
      // silent fail on background refresh, only alert on manual pull
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let fetching = false;

      const refreshOrders = async () => {
        if (!active || fetching) return;
        fetching = true;
        try {
          await fetchOrders();
        } finally {
          fetching = false;
        }
      };

      setLoading(true);
      refreshOrders();

      const interval = setInterval(refreshOrders, 10000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const openNavigation = async (latitude, longitude, address) => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    const hasCoordinates =
      latitude !== null && latitude !== undefined &&
      longitude !== null && longitude !== undefined &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    const destination = hasCoordinates
      ? `${lat},${lng}`
      : address?.trim();

    if (!destination) {
      Alert.alert('Location Unavailable', 'No navigation location is available.');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Navigation Error', 'Unable to open Google Maps.');
    }
  };

  const handleAccept = async (orderId) => {
    setAcceptingId(orderId);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await client.post(
        `/dp/orders/${orderId}/accept/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigation.replace('DPActiveOrder', { orderId });
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to accept order. It may have been taken already.';
      Alert.alert('Error', msg);
      fetchOrders(); // refresh list since this one is likely gone now
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await client.post(
        `/dp/orders/${orderId}/reject/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      // ignore
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1669ef" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.canGoBack()
            ? navigation.goBack()
            : navigation.navigate('DPHome')}
          accessibilityLabel="Back to Dashboard"
        >
          <Ionicons name="arrow-back" size={23} color="#1669ef" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Available Orders</Text>
          <Text style={styles.subtitle}>Delivery opportunities near you</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshIcon}
          onPress={handleRefresh}
          disabled={refreshing}
          accessibilityLabel="Refresh orders"
        >
          <Ionicons name="refresh" size={21} color="#1669ef" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="cube-outline" size={42} color="#1669ef" />
            </View>
            <Text style={styles.emptyText}>No orders available yet</Text>
            <Text style={styles.emptySubtext}>
              New delivery requests will appear here when available.
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <Ionicons name="refresh" size={18} color="#1669ef" />
              <Text style={styles.refreshButtonText}>
                {refreshing ? 'Refreshing...' : 'Refresh Orders'}
              </Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.shopName}>{item.shop_name}</Text>
              <Text style={styles.orderAmount}>₹{item.delivery_fee}</Text>
            </View>
            <Text style={styles.addressText}>Pickup: {item.shop_address}</Text>
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={() => openNavigation(
                item.shop_latitude, item.shop_longitude, item.shop_address
              )}
            >
              <Ionicons name="navigate-outline" size={16} color="#1669ef" />
              <Text style={styles.navigateText}>Navigate to Shop</Text>
            </TouchableOpacity>

            <Text style={styles.addressText}>Drop: {item.delivery_address}</Text>
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={() => openNavigation(
                item.delivery_latitude, item.delivery_longitude, item.delivery_address
              )}
            >
              <Ionicons name="navigate-outline" size={16} color="#1669ef" />
              <Text style={styles.navigateText}>Navigate to Buyer</Text>
            </TouchableOpacity>

            <View style={styles.itemsSection}>
              <Text style={styles.itemsTitle}>Order Items</Text>
              {Array.isArray(item.items) && item.items.length > 0 ? (
                item.items.map((product, index) => (
                  <View key={index} style={styles.itemRow}>
                    <Text style={styles.itemName}>
                      {product.product_name} × {product.quantity}
                    </Text>
                    <Text style={styles.itemPrice}>₹{product.price}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.addressText}>Item details unavailable</Text>
              )}
            </View>

            <View style={styles.orderFooter}>
              <Text style={styles.paymentBadge}>{item.payment_mode === 'cod' ? 'Cash on Delivery' : 'Prepaid'}</Text>
              <Text style={styles.totalText}>Order value: ₹{item.total_amount}</Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
                <Text style={styles.rejectText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => handleAccept(item.id)}
                disabled={acceptingId === item.id}
              >
                {acceptingId === item.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.acceptText}>Accept</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 19, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  refreshIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    marginTop: 70, marginHorizontal: 4,
    paddingHorizontal: 22, paddingVertical: 35,
    borderRadius: 18, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB', gap: 12,
  },
  emptyIconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 17, color: '#111827',
    fontWeight: '700', textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13, color: '#6B7280',
    textAlign: 'center', lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 12, marginTop: 8,
  },
  refreshButtonText: {
    color: '#1669ef', fontWeight: '700', fontSize: 14,
  },
  orderCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  shopName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  orderAmount: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  addressText: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    marginBottom: 8,
  },
  navigateText: {
    color: '#1669ef',
    fontSize: 13,
    fontWeight: '700',
  },
  itemsSection: {
    marginTop: 12, marginBottom: 8,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  itemsTitle: {
    fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', gap: 12, marginBottom: 6,
  },
  itemName: {
    flex: 1, fontSize: 13, color: '#374151',
  },
  itemPrice: {
    fontSize: 13, fontWeight: '600', color: '#111827',
  },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  paymentBadge: {
    fontSize: 11, fontWeight: '600', color: '#1669ef', backgroundColor: '#EFF6FF',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  totalText: { fontSize: 12, color: '#6B7280' },
  actionRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  rejectText: { color: '#6B7280', fontWeight: '600', fontSize: 14 },
  acceptBtn: {
    flex: 1, backgroundColor: '#1669ef', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});