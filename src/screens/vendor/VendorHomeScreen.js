import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
  Switch, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STATUS_COLORS = {
  placed:     { bg: '#FFF7ED', text: '#EA580C' },
  accepted:   { bg: '#F0FDF4', text: '#16A34A' },
  preparing:  { bg: '#eff6ff', text: '#1669ef' },
  dispatched: { bg: '#F5F3FF', text: '#8B5CF6', border: '#DDD6FE' },
  delivered:  { bg: '#DCFCE7', text: '#16A34A' },
  cancelled:  { bg: '#FEF2F2', text: '#DC2626' },
  rejected:   { bg: '#FEF2F2', text: '#DC2626' },
};

const STATUS_LABELS = {
  placed:     'New',
  accepted:   'Accepted',
  preparing:  'Preparing',
  dispatched: 'Out for Delivery',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
  rejected:   'Rejected',
};

export default function VendorHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout }        = useAuth();
  const [shop, setShop]         = useState(null);
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOpen, setIsOpen]     = useState(true);
  const [toggling, setToggling] = useState(false);
  const [search, setSearch]     = useState('');
  const [unreadCount, setUnreadCount] = useState(0); // ← notification badge
  const [isConnected, setIsConnected] = useState(true);

  const fetchData = async () => {
    try {
      const [shopRes, ordersRes, notifRes] = await Promise.all([
        client.get('/vendors/myshop/'),
        client.get('/orders/vendor/'),
        client.get('/orders/notifications/'),
      ]);
      setShop(shopRes.data);
      setIsOpen(shopRes.data.is_open);
      await AsyncStorage.setItem('shop_category', shopRes.data.category || '');
      const ordersData = Array.isArray(ordersRes.data)
        ? ordersRes.data
        : ordersRes.data.orders || [];
      setOrders(ordersData);

      // Count unread notifications
      const notifs = notifRes.data.notifications || [];
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (e) {
      console.log('Error:', e.message);
      if (e.response?.status === 404) {
        navigation.replace('VendorRegister');
        return;
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Refresh unread count every time screen is focused
  useFocusEffect(
    useCallback(() => {
      client.get('/orders/notifications/').then(res => {
        const notifs = res.data.notifications || [];
        setUnreadCount(notifs.filter(n => !n.is_read).length);
      }).catch(() => {});
    }, [])
  );

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleToggleShop = async () => {
    setToggling(true);
    try {
      const res = await client.post('/vendors/toggle/');
      setIsOpen(res.data.is_open);
    } catch (e) {
      console.log('Toggle error:', e.message);
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  // Today's date filter
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrders      = orders.filter(o => new Date(o.created_at) >= todayStart);
  const pendingOrders    = orders.filter(o => o.status === 'placed');
  const processingOrders = orders.filter(o => ['accepted', 'preparing', 'dispatched'].includes(o.status));
  const todayDelivered   = todayOrders.filter(o => o.status === 'delivered');
  const todayEarnings    = todayDelivered.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
  const totalEarnings    = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

  const filteredOrders = orders.filter(o => {
    if (!search) return true;
    return ((o?.order_number || o?.id?.slice(0, 8) || '').toLowerCase().includes(search.toLowerCase())) ||
      o.buyer_name?.toLowerCase().includes(search.toLowerCase());
  });

  const getTimeAgo = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff} mins ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hrs ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1669ef" />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.shopName}>{shop?.shop_name || user?.full_name}</Text>
          <Text style={styles.shopLocation}>
            <Ionicons name="location-outline" size={12} color="#888" /> {shop?.town || 'Your Town'}
          </Text>
        </View>

        {/* Bell with unread badge */}
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('VendorNotifications')}
        >
          <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={26} color={unreadCount > 0 ? '#1669ef' : '#444'} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>



      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1669ef" colors={['#1669ef']} />}
      >
        {/* Shop Toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <View style={[styles.statusDot, { backgroundColor: isOpen ? '#16A34A' : '#DC2626' }]} />
            <View>
              <Text style={styles.toggleLabel}>{isOpen ? 'Shop is Open' : 'Shop is Closed'}</Text>
              <Text style={styles.toggleSub}>{isOpen ? 'Accepting orders' : 'Not accepting orders'}</Text>
            </View>
          </View>
          <Switch
            value={isOpen}
            onValueChange={handleToggleShop}
            disabled={toggling}
            trackColor={{ false: '#FCA5A5', true: '#93c5fd' }}
            thumbColor={isOpen ? '#1669ef' : '#EF4444'}
          />
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders by ID or buyer name"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Offline Banner */}
        {!isConnected && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#111', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="wifi-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>No internet connection</Text>
          </View>
        )}
        {/* Pending Approval Banner */}
        {shop?.status === 'pending' && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#FDE68A' }}>
            <Ionicons name="time-outline" size={22} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>Shop Pending Approval</Text>
              <Text style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>Your shop is under review. You will be notified once approved.</Text>
            </View>
          </View>
        )}
        {shop?.status === 'rejected' && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#FECACA' }}>
            <Ionicons name="close-circle-outline" size={22} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#991B1B' }}>Shop Rejected</Text>
              <Text style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>Your shop registration was rejected. Please contact support.</Text>
            </View>
          </View>
        )}
        {/* Stats Cards */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#888', marginHorizontal: 16, marginBottom: 8 }}>Today's Summary</Text>
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: '#FFF7ED' }]}
            onPress={() => navigation.navigate('VendorOrders')}
          >
            <Ionicons name="time-outline" size={24} color="#EA580C" style={{ marginBottom: 8 }} />
            <Text style={styles.statCardLabel}>Pending</Text>
            <Text style={[styles.statCardValue, { color: '#EA580C' }]}>{pendingOrders.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: '#eff6ff' }]}
            onPress={() => navigation.navigate('VendorOrders')}
          >
            <Ionicons name="flash-outline" size={24} color="#1669ef" style={{ marginBottom: 8 }} />
            <Text style={styles.statCardLabel}>Processing</Text>
            <Text style={[styles.statCardValue, { color: '#1669ef' }]}>{processingOrders.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}
            onPress={() => navigation.navigate('VendorOrders')}
          >
            <Ionicons name="checkmark-circle-outline" size={24} color="#16A34A" style={{ marginBottom: 8 }} />
            <Text style={styles.statCardLabel}>Delivered</Text>
            <Text style={[styles.statCardValue, { color: '#16A34A' }]}>{todayDelivered.length}</Text>
          </TouchableOpacity>
        </View>

        {/* Earnings Card */}
        <View style={{ marginHorizontal: 16, marginBottom: 24, marginTop: 8, borderRadius: 14, overflow: 'hidden' }}>
          <View style={{ backgroundColor: '#1669ef', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', opacity: 0.8 }}>Today's Earnings</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{String.fromCharCode(8377)}{todayEarnings.toFixed(0)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', opacity: 0.8 }}>Total Earnings</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{String.fromCharCode(8377)}{totalEarnings.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => navigation.navigate('VendorOrders')}>
            <Text style={styles.viewAll}>View All →</Text>
          </TouchableOpacity>
        </View>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>New orders will appear here</Text>
          </View>
        ) : (
          filteredOrders.slice(0, 10).map(order => {
            const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.placed;
            const statusLabel = STATUS_LABELS[order.status] || order.status;
            const itemCount   = order.items?.length || 0;
            const isNew       = order.status === 'placed';
            return (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderCard, isNew && styles.orderCardNew]}
                onPress={() => navigation.navigate('VendorOrderDetail', { orderId: order.id })}
              >
                {isNew && <View style={styles.newDot} />}
                <View style={styles.orderLeft}>
                  <Text style={styles.orderId}>
                    #{order?.order_number || order?.id?.slice(0, 8).toUpperCase()}
                  </Text>
                  <Text style={styles.orderMeta}>
                    {itemCount} item{itemCount !== 1 ? 's' : ''} • {getTimeAgo(order.created_at)}
                  </Text>
                  {order.buyer_name && (
                    <Text style={styles.buyerName}>
                      <Ionicons name="person-outline" size={11} color="#888" /> {order.buyer_name}
                    </Text>
                  )}
                </View>
                <View style={styles.orderRight}>
                  <Text style={styles.orderAmount}>₹{parseFloat(order.subtotal || 0).toFixed(0)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                    <Text style={[styles.statusText, { color: statusColor.text }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Tab */}
      <View style={[styles.bottomTab, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="grid" size={22} color="#1669ef" />
          <Text style={styles.tabLabelActive}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorOrders')}>
          <View style={styles.tabIconWrap}>
            <Ionicons name="receipt-outline" size={22} color="#9CA3AF" />
            {pendingOrders.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingOrders.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.tabLabel}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorProducts')}>
          <Ionicons name="cube-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorProfile')}>
          <Ionicons name="person-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  shopName:     { fontSize: 20, fontWeight: 'bold', color: '#111' },
  shopLocation: { fontSize: 13, color: '#888', marginTop: 2 },

  bellBtn: { position: 'relative', width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  bellBadge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#EF4444', borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: '#fff',
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // New order alert bar
  newOrderAlert: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF7ED', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#FED7AA',
  },
  newOrderAlertLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  newOrderDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#EA580C',
  },
  newOrderAlertText: { fontSize: 13, color: '#EA580C' },
  newOrderAlertBold: { fontWeight: '800' },

  toggleCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  toggleLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#111' },
  toggleSub:   { fontSize: 12, color: '#888', marginTop: 2 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12,
    marginHorizontal: 16, marginTop: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 12, marginBottom: 8 },
  statCard: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: 'center',
  },
  statCardLabel: { fontSize: 11, color: '#888', marginBottom: 4, textAlign: 'center' },
  statCardValue: { fontSize: 26, fontWeight: 'bold' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16,
    marginTop: 12, marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#111' },
  viewAll:      { fontSize: 13, color: '#1669ef', fontWeight: '600' },

  orderCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16,
    marginBottom: 10, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    position: 'relative',
  },
  orderCardNew: { borderLeftWidth: 3, borderLeftColor: '#EA580C' },
  newDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#EA580C',
  },
  orderLeft:   { flex: 1 },
  orderId:     { fontSize: 14, fontWeight: 'bold', color: '#111', marginBottom: 3 },
  orderMeta:   { fontSize: 12, color: '#888', marginBottom: 2 },
  buyerName:   { fontSize: 11, color: '#888' },
  orderRight:  { alignItems: 'flex-end', marginRight: 8 },
  orderAmount: { fontSize: 15, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 12, fontWeight: '600' },

  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F3F4F6', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16,
  },
  emptyTitle:    { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#888' },

  bottomTab: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 24, paddingTop: 10,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  tabItem:        { flex: 1, alignItems: 'center', gap: 3 },
  tabIconWrap:    { position: 'relative' },
  tabLabel:       { fontSize: 11, color: '#9CA3AF' },
  tabLabelActive: { fontSize: 11, color: '#1669ef', fontWeight: 'bold' },
  tabBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#EF4444', borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#fff',
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});