import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';

const TABS = [
  { key: 'all',        label: 'All',        icon: 'list-outline'           },
  { key: 'placed',     label: 'New',        icon: 'receipt-outline'        },
  { key: 'accepted',   label: 'Accepted',   icon: 'checkmark-circle-outline'},
  { key: 'preparing',  label: 'Preparing',  icon: 'restaurant-outline'     },
  { key: 'dispatched', label: 'Ready',      icon: 'bicycle-outline'        },
  { key: 'delivered',  label: 'Delivered',  icon: 'home-outline'           },
  { key: 'cancelled',  label: 'Cancelled',  icon: 'close-circle-outline'   },
];

const STATUS_COLORS = {
  placed:     { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  accepted:   { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  preparing:  { bg: '#eff6ff', text: '#1669ef', border: '#bfdbfe' },
  dispatched: { bg: '#F5F3FF', text: '#8B5CF6', border: '#DDD6FE' },
  delivered:  { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  cancelled:  { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  rejected:   { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
};

const STATUS_LABELS = {
  placed:     'New Order',
  accepted:   'Accepted',
  preparing:  'Preparing',
  dispatched: 'Out for Delivery',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
  rejected:   'Rejected',
};

const STATUS_ICONS = {
  placed:     'receipt-outline',
  accepted:   'checkmark-circle-outline',
  preparing:  'restaurant-outline',
  dispatched: 'bicycle-outline',
  delivered:  'home-outline',
  cancelled:  'close-circle-outline',
  rejected:   'close-circle-outline',
};

const getTimeAgo = (dateStr) => {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 60000);
  if (diff < 1)    return 'Just now';
  if (diff < 60)   return `${diff} min ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`;
  return `${Math.floor(diff / 1440)} days ago`;
};

export default function VendorOrdersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState('placed');
  const [shop, setShop]             = useState(null);

  const fetchOrders = async () => {
    try {
      const [res, shopRes] = await Promise.all([
        client.get('/orders/vendor/'),
        client.get('/vendors/myshop/'),
      ]);
      const data = Array.isArray(res.data) ? res.data : res.data.orders || [];
      setOrders(data);
      setShop(shopRes.data);
    } catch (e) {
      console.log('Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);
  useFocusEffect(useCallback(() => { fetchOrders(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchOrders(); };

  const getTabCount = (key) => key === 'all'
    ? orders.length
    : orders.filter(o => o.status === key).length;

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter(o => o.status === activeTab);

  const todayOrders   = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const pendingOrders = orders.filter(o => o.status === 'placed');
  const todayRevenue  = todayOrders.reduce((sum, o) => sum + parseFloat(o.subtotal || 0), 0);

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSub}>
            {todayOrders.length} orders today • ₹{todayRevenue.toFixed(0)} revenue
          </Text>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('VendorNotifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#444" />
        </TouchableOpacity>
      </View>

      {/* ── New Orders Alert ── */}
      {/* Shop Pending/Rejected Banner */}
      {shop?.status === 'pending' && (
        <View style={{ margin: 16, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#FDE68A' }}>
          <Ionicons name="time-outline" size={22} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>Shop Pending Approval</Text>
            <Text style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>You cannot accept orders until your shop is approved by admin.</Text>
          </View>
        </View>
      )}
      {shop?.status === 'rejected' && (
        <View style={{ margin: 16, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#FECACA' }}>
          <Ionicons name="close-circle-outline" size={22} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#991B1B' }}>Shop Rejected</Text>
            <Text style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>Your shop has been rejected. Please contact support.</Text>
          </View>
        </View>
      )}
      {pendingOrders.length > 0 && shop?.status === 'approved' && (
        <TouchableOpacity
          style={styles.newOrderAlert}
          onPress={() => setActiveTab('placed')}
        >
          <View style={styles.newOrderAlertDot} />
          <Text style={styles.newOrderAlertText}>
            <Text style={styles.newOrderAlertBold}>{pendingOrders.length} new order{pendingOrders.length > 1 ? 's' : ''}</Text> waiting for acceptance
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#EA580C" />
        </TouchableOpacity>
      )}

      {/* ── Filter Tabs ── */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {TABS.map(tab => {
            const count    = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon}
                  size={13}
                  color={isActive ? '#fff' : '#555'}
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Orders List ── */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#1669ef" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1669ef" colors={['#1669ef']} />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>
                No {TABS.find(t => t.key === activeTab)?.label} orders
              </Text>
              <Text style={styles.emptySubtitle}>Orders will appear here</Text>
            </View>
          ) : (
            filteredOrders.map(order => {
              const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.placed;
              const statusLabel = STATUS_LABELS[order.status] || order.status;
              const statusIcon  = STATUS_ICONS[order.status]  || 'receipt-outline';
              const itemCount   = order.items?.length || 0;
              const isNew       = order.status === 'placed';

              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderCard, isNew && styles.orderCardNew]}
                  onPress={() => navigation.navigate('VendorOrderDetail', { orderId: order.id })}
                  activeOpacity={0.75}
                >
                  {/* Top row — ID + amount */}
                  <View style={styles.orderTopRow}>
                    <View style={styles.orderIdRow}>
                      {isNew && <View style={styles.newDot} />}
                      <Text style={styles.orderId}>
                        #{order?.order_number || order?.id?.slice(0, 8).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.orderAmount}>
                      ₹{parseFloat(order.subtotal || 0).toFixed(0)}
                    </Text>
                  </View>

                  {/* Middle row — items + time */}
                  <View style={styles.orderMidRow}>
                    <Text style={styles.orderMeta}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.orderDot}>•</Text>
                    <Text style={styles.orderMeta}>{getTimeAgo(order.created_at)}</Text>
                    {order.buyer_name && (
                      <>
                        <Text style={styles.orderDot}>•</Text>
                        <Ionicons name="person-outline" size={11} color="#888" />
                        <Text style={styles.orderMeta}>{order.buyer_name}</Text>
                      </>
                    )}
                  </View>

                  {/* Items preview */}
                  {order.items && order.items.length > 0 && (
                    <Text style={styles.itemsPreview} numberOfLines={1}>
                      {order.items.map(i => `${i.quantity}× ${i.product_name || i.name}`).join('  ·  ')}
                    </Text>
                  )}

                  {/* Special Instructions */}
                  {order.instructions && (
                    <View style={{flexDirection:'row', alignItems:'center', gap:4, marginTop:4}}>
                      <Ionicons name="chatbubble-outline" size={11} color="#888" />
                      <Text style={[styles.orderMeta, {color:'#f59e0b', fontStyle:'italic'}]} numberOfLines={1}>
                        {order.instructions}
                      </Text>
                    </View>
                  )}
                  {/* Bottom row — status + arrow */}
                  <View style={styles.orderBottomRow}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
                      <Ionicons name={statusIcon} size={12} color={statusColor.text} />
                      <Text style={[styles.statusText, { color: statusColor.text }]}>
                        {statusLabel}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Bottom Tab ── */}
      <View style={[styles.bottomTab, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorHome')}>
          <Ionicons name="grid-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="receipt" size={22} color="#1669ef" />
          <Text style={styles.tabLabelActive}>Orders</Text>
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
  container: { flex: 1, backgroundColor: '#F0F2F5' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  headerSub:   { fontSize: 12, color: '#888', marginTop: 2 },
  bellBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  newOrderAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF7ED', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#FED7AA',
  },
  newOrderAlertDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EA580C' },
  newOrderAlertText: { flex: 1, fontSize: 13, color: '#EA580C' },
  newOrderAlertBold: { fontWeight: '800' },

  tabsWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    paddingVertical: 12,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: 'transparent',
  },
  tabActive:     { backgroundColor: '#1669ef', borderColor: '#1669ef' },
  tabText:       { fontSize: 13, color: '#555', fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  tabBadge: {
    backgroundColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  tabBadgeActive:     { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText:       { fontSize: 10, color: '#555', fontWeight: '700' },
  tabBadgeTextActive: { color: '#fff' },

  loadingBox:  { alignItems: 'center', marginTop: 60, gap: 12 },
  loadingText: { fontSize: 14, color: '#888' },

  // Order Card
  orderCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginBottom: 10, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  orderCardNew: { borderLeftWidth: 3, borderLeftColor: '#EA580C' },

  orderTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  orderIdRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EA580C' },
  orderId:      { fontSize: 15, fontWeight: '800', color: '#111' },
  orderAmount:  { fontSize: 16, fontWeight: '900', color: '#111' },

  orderMidRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8,
  },
  orderMeta: { fontSize: 12, color: '#888' },
  orderDot:  { fontSize: 10, color: '#D1D5DB' },

  itemsPreview: {
    fontSize: 12, color: '#555', marginBottom: 10,
    backgroundColor: '#F8F9FA', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },

  orderBottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '600' },

  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#F3F4F6', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  emptyTitle:    { fontSize: 17, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#888' },

  bottomTab: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 24, paddingTop: 10,
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 10,
  },
  tabItem:        { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel:       { fontSize: 11, color: '#9CA3AF' },
  tabLabelActive: { fontSize: 11, color: '#1669ef', fontWeight: 'bold' },
});