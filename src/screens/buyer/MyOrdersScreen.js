import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import client from '../../api/client';
import { useCart } from '../../context/CartContext';

const STATUS_COLORS = {
  placed:     { bg: '#1669ef', text: '#fff', border: '#1350c9' },
  accepted:   { bg: '#16A34A', text: '#fff', border: '#15803d' },
  preparing:  { bg: '#D97706', text: '#fff', border: '#b45309' },
  dispatched: { bg: '#0891b2', text: '#fff', border: '#0e7490' },
  delivered:  { bg: '#16A34A', text: '#fff', border: '#15803d' },
  cancelled:  { bg: '#DC2626', text: '#fff', border: '#b91c1c' },
  rejected:   { bg: '#DC2626', text: '#fff', border: '#b91c1c' },
};

const STATUS_LABELS = {
  placed:     'Order Placed',
  accepted:   'Accepted',
  preparing:  'Preparing',
  dispatched: 'On the Way',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
  rejected:   'Rejected',
};

const STATUS_EMOJI = {
  placed:     '📋',
  accepted:   '✅',
  preparing:  '👨‍🍳',
  dispatched: '🛵',
  delivered:  '🎉',
  cancelled:  '❌',
  rejected:   '❌',
};

export default function MyOrdersScreen({ navigation }) {
  const isFocused = useIsFocused();
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]               = useState('active');

  const { addToCart, clearCart, cart, shop: cartShop } = useCart();

  const fetchOrders = async () => {
    try {
      const res = await client.get('/orders/mine/');
      if (Array.isArray(res.data)) {
        setOrders(res.data);
      } else if (res.data.orders) {
        setOrders(res.data.orders);
      } else {
        setOrders([]);
      }
    } catch (e) {
      console.log('Error:', e.message);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchOrders(); };

  const activeStatuses = ['placed', 'accepted', 'preparing', 'dispatched'];
  const pastStatuses   = ['delivered', 'cancelled', 'rejected'];
  const activeOrders   = orders.filter(o => activeStatuses.includes(o.status));
  const pastOrders     = orders.filter(o => pastStatuses.includes(o.status));
  const displayOrders  = tab === 'active' ? activeOrders : pastOrders;

  const handleReorder = async (order) => {
    try {
      // Check if cart has items from different shop
      if (cartShop && cartShop.id !== order.vendor_id && Object.keys(cart).length > 0) {
        Alert.alert(
          'Clear Cart?',
          `Your cart has items from "${cartShop.shop_name}". Reordering will clear it.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reorder',
              style: 'destructive',
              onPress: () => doReorder(order),
            },
          ]
        );
        return;
      }
      doReorder(order);
    } catch (e) {
      Alert.alert('Error', 'Could not reorder. Please try again.');
    }
  };

  const doReorder = async (order) => {
    await clearCart();
    // Fetch shop details and add items to cart
    const shopData = {
      id:        order.vendor_id,
      shop_name: order.shop_name || order.vendor_name || 'Shop',
      town:      order.vendor_town || '',
      platform_fee: order.platform_fee || 5,
    };
    console.log('ORDER ITEMS:', JSON.stringify(order.items));
    console.log('ORDER VENDOR:', order.vendor_id, order.vendor, order.shop_name);
    for (const item of (order.items || [])) {
      const product = {
        id:    item.product || item.product_id || item.id,
        name:  item.product_name || item.name,
        price: item.price,
      };
      await addToCart(product, shopData);
    }
    Alert.alert(
      'Cart Ready! 🛒',
      `${order.items?.length} items added from ${order.shop_name || order.vendor_name}`,
      [
        {
          text: 'View Cart',
          onPress: () => setTimeout(() => navigation.navigate('Cart'), 1500),
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  const OrderCard = ({ order }) => {
    const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.placed;
    const statusLabel = STATUS_LABELS[order.status] || order.status;
    const statusEmoji = STATUS_EMOJI[order.status] || '📋';
    const isPast      = pastStatuses.includes(order.status);
    const date        = new Date(order.created_at).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={[styles.orderCard, { borderLeftColor: statusColor.bg }]}
        onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
        activeOpacity={0.9}
      >
        {/* Shop row */}
        <View style={styles.orderTop}>
          <View style={styles.shopIconBox}>
            <Ionicons name="storefront-outline" size={22} color="#fff" />
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.shopName}>{order.shop_name || order.vendor_name || 'Shop'}</Text>
            <Text style={styles.orderDate}>{date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {statusEmoji} {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Items */}
        {order.items?.slice(0, 3).map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <View style={styles.itemDot} />
            <Text style={styles.itemText}>
              {item.quantity}x {item.product_name || item.name}{item.variant_name ? ` (${item.variant_name})` : ''}
            </Text>
            <Text style={styles.itemPrice}>
              ₹{(item.quantity * parseFloat(item.price)).toFixed(0)}
            </Text>
          </View>
        ))}
        {order.items?.length > 3 && (
          <Text style={styles.moreItems}>+{order.items.length - 3} more items</Text>
        )}

        {/* Bottom row */}
        <View style={styles.orderBottom}>
          <View>
            <Text style={styles.totalText}>₹{order.total_amount}</Text>
            <Text style={styles.itemCount}>{order.items?.length} item{order.items?.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.actionBtns}>


            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
            >
              <Text style={styles.detailBtnText}>Details ›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Active {activeOrders.length > 0 && `(${activeOrders.length})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'past' && styles.tabActive]}
          onPress={() => setTab('past')}
        >
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>
            Past Orders {pastOrders.length > 0 && `(${pastOrders.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1669ef" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16 }}
        >
          {displayOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>
                {tab === 'active' ? '🛵' : '📦'}
              </Text>
              <Text style={styles.emptyTitle}>
                {tab === 'active' ? 'No active orders' : 'No past orders'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'active'
                  ? 'Place an order from any local shop!'
                  : 'Your completed orders will appear here'
                }
              </Text>
              {tab === 'active' && (
                <TouchableOpacity
                  style={styles.shopNowBtn}
                  onPress={() => navigation.navigate('Cart')}
                >
                  <Text style={styles.shopNowText}>Browse Shops</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            displayOrders.map(order => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Bottom Tab */}
      {isFocused && <View style={styles.bottomTab}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={25} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart-outline" size={25} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="receipt" size={25} color="#1669ef" />
          <Text style={styles.tabLabelActive}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-outline" size={25} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>}

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
  backBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backText:    { fontSize: 24, color: '#111' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },

  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: '#1669ef' },
  tabText:       { fontSize: 14, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#1669ef', fontWeight: 'bold' },

  orderCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderLeftWidth: 4, borderLeftColor: '#1669ef',
  },
  orderTop:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  shopIconBox: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1669ef', justifyContent: 'center',
    alignItems: 'center', marginRight: 12,
  },
  shopIconText: { fontSize: 22 },
  orderInfo:    { flex: 1 },
  shopName:     { fontSize: 15, fontWeight: 'bold', color: '#111' },
  orderDate:    { fontSize: 12, color: '#888', marginTop: 2 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:   { fontSize: 11, fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#F5F5F5', marginBottom: 10 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 6, gap: 8,
  },
  itemDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  itemText: { flex: 1, fontSize: 13, color: '#555' },
  itemPrice:{ fontSize: 13, color: '#111', fontWeight: '500' },
  moreItems:{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 },

  orderBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5',
  },
  totalText: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  itemCount: { fontSize: 11, color: '#888', marginTop: 2 },

  actionBtns:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  reorderBtn: {
    backgroundColor: '#eff6ff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#1669ef',
  },
  reorderBtnText: { fontSize: 13, color: '#1669ef', fontWeight: '700' },
  detailBtn: {
    backgroundColor: '#F9FAFB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  detailBtnText: { fontSize: 13, color: '#555', fontWeight: '600' },

  emptyState:   { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyEmoji:   { fontSize: 60, marginBottom: 16 },
  emptyTitle:   { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 8 },
  emptySubtitle:{ fontSize: 13, color: '#888', marginBottom: 24, textAlign: 'center' },
  shopNowBtn: {
    backgroundColor: '#1669ef', borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 12,
  },
  shopNowText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  bottomTab: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 24, paddingTop: 10,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  tabItem:       { flex: 1, alignItems: 'center' },
  tabIcon:       { fontSize: 22, marginBottom: 2, color: '#9CA3AF' },
  tabLabel:      { fontSize: 11, color: '#9CA3AF' },
  tabLabelActive:{ fontSize: 11, color: '#1669ef', fontWeight: 'bold' },
});