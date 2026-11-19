import React, { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import client from '../../api/client';

const TYPE_CONFIG = {
  order_placed:    { icon: '📋', bg: '#eff6ff' },
  order_accepted:  { icon: '✅', bg: '#DCFCE7' },
  order_rejected:  { icon: '❌', bg: '#FEF2F2' },
  order_preparing: { icon: '👨‍🍳', bg: '#FFF7ED' },
  order_dispatched:{ icon: '🛵', bg: '#F0FDF4' },
  order_delivered: { icon: '🎉', bg: '#DCFCE7' },
  order_cancelled: { icon: '❌', bg: '#FEF2F2' },
  new_order:       { icon: '📦', bg: '#eff6ff' },
  settlement:      { icon: '💰', bg: '#DCFCE7' },
};

const getTimeAgo = (dateStr) => {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 60000);
  if (diff < 1)    return 'just now';
  if (diff < 60)   return `${diff} mins ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hrs ago`;
  return `${Math.floor(diff / 1440)} days ago`;
};

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const fetchNotifications = async () => {
    try {
      const res  = await client.get('/orders/notifications/');
      setNotifications(res.data.notifications || []);
    } catch (e) {
      console.log('Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchNotifications(); };

  const clearAll = async () => {
    try {
      await client.delete('/orders/notifications/clear/');
      setNotifications([]);
    } catch (e) { console.log('Error:', e.message); }
  };

  const markAllRead = async () => {
    try {
      await client.post('/orders/notifications/read/');
      fetchNotifications();
    } catch (e) {
      console.log('Error:', e.message);
    }
  };

  const markRead = async (id, orderId) => {
    try {
      await client.post(`/orders/notifications/${id}/read/`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (orderId) navigation.navigate('OrderDetail', { orderId: orderId.toString() });
    } catch (e) {
      console.log('Error:', e.message);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} unread</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllIcon}>✓</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={clearAll} style={[styles.markAllBtn, { backgroundColor: '#FEE2E2' }]}>
            <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1669ef" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-outline" size={60} color="#1669ef" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
                Order updates will appear here
              </Text>
            </View>
          ) : (
            notifications.map(item => {
              const config = TYPE_CONFIG[item.type] || { icon: '🔔', bg: '#F3F4F6' };
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
                  onPress={() => markRead(item.id, item.order_id)}
                >
                  <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
                    <Text style={styles.iconText}>{config.icon}</Text>
                  </View>
                  <View style={styles.notifInfo}>
                    <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}>
                      {item.title}
                    </Text>
                    <Text style={styles.notifMessage}>{item.message}</Text>
                    <Text style={styles.notifTime}>{getTimeAgo(item.created_at)}</Text>
                  </View>
                  {!item.is_read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
      {/* Bottom Tab */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: 20, paddingTop: 10, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Home' })}>
          <Ionicons name="home-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Cart' })}>
          <Ionicons name="cart-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'MyOrders' })}>
          <Ionicons name="receipt-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Profile' })}>
          <Ionicons name="person-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 24, color: '#111' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  markAllBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  markAllIcon: { fontSize: 18, color: '#1669ef', fontWeight: 'bold' },

  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center' },

  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  notifCardUnread: { backgroundColor: '#F8FAFF' },
  iconBox: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  iconText: { fontSize: 22 },
  notifInfo: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '500', color: '#555', marginBottom: 4 },
  notifTitleUnread: { fontWeight: 'bold', color: '#111' },
  notifMessage: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, color: '#9CA3AF' },
  unreadDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#1669ef', marginTop: 4,
  },
});