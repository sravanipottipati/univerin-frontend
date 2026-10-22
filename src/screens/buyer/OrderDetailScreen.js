import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../../api/client';

const STATUS_INFO = {
  placed:     { label: 'Order Placed',      icon: 'receipt-outline',          color: '#EA580C', bg: '#FFF7ED', desc: 'Your order has been placed successfully!' },
  accepted:   { label: 'Order Accepted',    icon: 'checkmark-circle-outline', color: '#16A34A', bg: '#F0FDF4', desc: 'Shop has accepted your order!' },
  preparing:  { label: 'Preparing',         icon: 'restaurant-outline',       color: '#1669ef', bg: '#eff6ff', desc: 'Shop is preparing your order' },
  dispatched: { label: 'Out for Delivery',  icon: 'bicycle-outline',          color: '#8B5CF6', bg: '#F5F3FF', desc: 'Your order is on the way!' },
  delivered:  { label: 'Delivered',         icon: 'home-outline',             color: '#16A34A', bg: '#DCFCE7', desc: 'Order delivered successfully!' },
  cancelled:  { label: 'Cancelled',         icon: 'close-circle-outline',     color: '#DC2626', bg: '#FEF2F2', desc: 'This order was cancelled' },
  rejected:   { label: 'Rejected by Shop',  icon: 'close-circle-outline',     color: '#DC2626', bg: '#FEF2F2', desc: 'Shop rejected this order' },
};

const STEPS = [
  { key: 'placed',     label: 'Order\nPlaced',    icon: 'receipt-outline',          activeIcon: 'receipt' },
  { key: 'accepted',   label: 'Accepted',         icon: 'checkmark-circle-outline', activeIcon: 'checkmark-circle' },
  { key: 'preparing',  label: 'Preparing',        icon: 'restaurant-outline',       activeIcon: 'restaurant' },
  { key: 'dispatched', label: 'Out for\nDelivery',icon: 'bicycle-outline',          activeIcon: 'bicycle' },
  { key: 'delivered',  label: 'Delivered',        icon: 'home-outline',             activeIcon: 'home' },
];

const STATUSES = ['placed', 'accepted', 'preparing', 'dispatched', 'delivered'];

export default function OrderDetailScreen({ navigation, route }) {
  const { orderId }         = route.params;
  const [order, setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await client.get(`/orders/${orderId}/`);
      setOrder(res.data);
    } catch (e) {
      console.log('Error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrder(); }, [orderId]);

  const handleCancelOrder = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await client.post(`/orders/${orderId}/status/`, { status: 'cancelled' });
            await fetchOrder();
            Alert.alert('Cancelled', 'Your order has been cancelled.');
          } catch (e) {
            Alert.alert('Error', e.response?.data?.error || 'Could not cancel order');
          } finally {
            setCancelling(false);
          }
        }
      }
    ]);
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#1669ef" /></View>
  );

  if (!order) return (
    <View style={styles.center}><Text style={styles.errorText}>Order not found</Text></View>
  );

  const statusInfo    = STATUS_INFO[order.status] || STATUS_INFO.placed;
  const isCancelled   = ['cancelled', 'rejected'].includes(order.status);
  const isDelivered   = order.status === 'delivered';

  const generateInvoice = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const url = `https://api.univerin.in/api/invoices/buyer/${orderId}/`;
      const fileUri = FileSystem.documentDirectory + `invoice_${orderId}.pdf`;
      const res = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice ${order.order_number}`,
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not download invoice');
    }
  };
  const hasReview     = order.has_review || false;
  const hasReturn     = order.has_return || false;
  const canCancel     = order.status === 'placed';
  const currentIndex  = STATUSES.indexOf(order.status);
  const shopHasGST    = !!(order.vendor_gstin && order.vendor_gstin.trim());
  const subtotal      = order.items?.reduce((sum, i) => sum + (parseFloat(i.price) * i.quantity * (shopHasGST ? (1 + (parseFloat(i.product_gst || 0) / 100)) : 1)), 0) || parseFloat(order.subtotal || 0);
  const deliveryFee   = parseFloat(order.delivery_fee || 0) + parseFloat(order.gst_on_delivery || 0);
  const platformFee   = parseFloat((parseFloat(order.platform_fee || 10) * 1.18).toFixed(1));
  const gstOnPlatform = parseFloat(order.gst_on_platform || 0);
  const total         = parseFloat((subtotal + deliveryFee + platformFee).toFixed(1));
  const totalSavings  = order.items?.reduce((sum, i) => {
    const mrp = parseFloat(i.product_mrp || 0);
    const price = parseFloat(i.price || 0);
    return sum + (mrp > price ? (mrp - price) * i.quantity : 0);
  }, 0) || 0;
  const date          = new Date(order.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>#{order.order_number}</Text>
          <Text style={styles.headerSub}>{date}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={[styles.statusBanner, { backgroundColor: statusInfo.bg, borderColor: statusInfo.color + '30' }]}>
          <View style={[styles.statusIconBox, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon} size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            <Text style={styles.statusDesc}>{statusInfo.desc}</Text>
          </View>
          <Text style={styles.statusAmount}>₹{total % 1 === 0 ? total.toFixed(0) : total.toFixed(1)}</Text>
        </View>
        {order.delivery_otp && ['picked_up', 'arrived_at_buyer'].includes(order.dp_status) && (
          <View style={styles.deliveryOtpCard}>
            <Ionicons name="shield-checkmark-outline" size={28} color="#1669ef" />
            <Text style={styles.deliveryOtpTitle}>Your Delivery OTP</Text>
            <Text style={styles.deliveryOtpCode}>{order.delivery_otp}</Text>
            <Text style={styles.deliveryOtpHint}>
              Share this 6-digit code with your delivery partner only when receiving your order.
            </Text>
          </View>
        )}

        {isDelivered && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#16A34A', fontWeight: '600' }}>🎉 Thank you for shopping with Univerin!</Text>
          </View>
        )}

        {!isCancelled && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Progress</Text>
            <View style={styles.stepperContainer}>
              <View style={styles.stepperLine} />
              <View style={[styles.stepperLineFill, { width: `${Math.min((currentIndex / (STEPS.length - 1)) * 100, 100)}%` }]} />
              <View style={styles.stepperRow}>
                {STEPS.map((step) => {
                  const stepIndex = STATUSES.indexOf(step.key);
                  const isDone    = stepIndex <= currentIndex;
                  const isCurrent = stepIndex === currentIndex;
                  return (
                    <View key={step.key} style={styles.stepCol}>
                      <View style={[
                        styles.stepCircle,
                        isDone && { backgroundColor: '#1669ef', borderColor: '#1669ef' },
                        !isDone && { backgroundColor: '#fff', borderColor: '#D1D5DB' },
                        isCurrent && { shadowColor: '#1669ef', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
                      ]}>
                        <Ionicons
                          name={isDone ? step.activeIcon : step.icon}
                          size={16}
                          color={isDone ? '#fff' : '#D1D5DB'}
                        />
                      </View>
                      <Text style={[
                        styles.stepLabel,
                        isDone ? { color: '#1669ef', fontWeight: '700' } : { color: '#9CA3AF' },
                      ]}>
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ({order.items?.length || 0})</Text>
          {order.items?.map((item, i) => (
            <View key={i} style={[styles.itemRow, i < order.items.length - 1 && styles.itemRowBorder]}>
              <View style={styles.itemQtyBox}>
                <Text style={styles.itemQtyText}>{item.quantity}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product_name || item.name}{item.variant_name ? ` (${item.variant_name})` : ''}</Text>
                <Text style={styles.itemUnit}>₹{parseFloat(item.price).toFixed(0)} each</Text>
              </View>
              <Text style={styles.itemPrice}>₹{(item.quantity * parseFloat(item.price)).toFixed(0)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items Total{shopHasGST ? ' (incl. GST)' : ''}</Text>
            <Text style={styles.billValue}>₹{subtotal % 1 === 0 ? subtotal.toFixed(0) : subtotal.toFixed(1)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee (incl. 18% GST)</Text>
            {deliveryFee === 0
              ? <Text style={[styles.billValue, { color: '#16A34A' }]}>FREE</Text>
              : <Text style={styles.billValue}>₹{deliveryFee % 1 === 0 ? deliveryFee.toFixed(0) : deliveryFee.toFixed(1)}</Text>
            }
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform Fee (incl. 18% GST)</Text>
            <Text style={styles.billValue}>₹{platformFee % 1 === 0 ? platformFee.toFixed(0) : platformFee.toFixed(1)}</Text>
          </View>
          <View style={[styles.billRow, styles.billTotal]}>
            <Text style={styles.billTotalLabel}>Total Amount</Text>
            <Text style={styles.billTotalValue}>₹{total % 1 === 0 ? total.toFixed(0) : total.toFixed(1)}</Text>
          </View>
          {totalSavings > 0 && (
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center' }}>
              <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 13 }}>🎉 You saved ₹{Math.round(totalSavings)} on this order!</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivering To</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Ionicons name="location-outline" size={18} color="#1669ef" />
            <Text style={styles.addressText}>{order.delivery_address}</Text>
          </View>
          {order.instructions ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
              <Ionicons name="chatbubble-outline" size={18} color="#f59e0b" />
              <Text style={[styles.addressText, {color:'#f59e0b', fontStyle:'italic'}]}>
                {order.instructions}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID</Text>
            <Text style={styles.infoValue}>#{order.order_number}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date & Time</Text>
            <Text style={styles.infoValue}>{date}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment</Text>
            <Text style={[styles.infoValue, { color: '#16A34A' }]}>
              {order.payment_mode === 'online' ? '💳 Online Payment' : '💵 Cash on Delivery'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Shop</Text>
            <Text style={styles.infoValue}>{order.vendor_name || order.shop_name || 'Shop'}</Text>
          </View>
        </View>

        {canCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelOrder} disabled={cancelling}>
            {cancelling
              ? <ActivityIndicator color="#DC2626" />
              : <>
                  <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                  <Text style={styles.cancelBtnText}>Cancel Order</Text>
                </>
            }
          </TouchableOpacity>
        )}



        <View style={styles.actionBtnsCard}>
          {isDelivered && (
            <TouchableOpacity style={styles.invoiceBtn} onPress={generateInvoice}>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.invoiceBtnText}>Download Invoice</Text>
            </TouchableOpacity>
          )}

          {isDelivered && !hasReview && (
            <TouchableOpacity style={styles.rateBtnFull} onPress={() => navigation.navigate('RateOrder', { order })}>
              <Text style={styles.rateBtnFullText}>Rate this Order</Text>
            </TouchableOpacity>
          )}
          {isDelivered && !hasReturn && (
            <TouchableOpacity style={styles.returnBtnFull} onPress={() => navigation.navigate('ReturnOrder', { order })}>
              <Text style={styles.returnBtnFullText}>Return & Refund</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#888' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn:     { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  headerSub:   { fontSize: 11, color: '#888', marginTop: 2 },
  deliveryOtpCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    alignItems: 'center',
  },
  deliveryOtpTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E40AF',
    marginTop: 8,
  },
  deliveryOtpCode: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 8,
    marginVertical: 12,
  },
  deliveryOtpHint: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, borderRadius: 16, padding: 16, borderWidth: 1,
  },
  statusIconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  statusLabel:   { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  statusDesc:    { fontSize: 12, color: '#888' },
  statusAmount:  { fontSize: 18, fontWeight: '900', color: '#111' },
  card:      { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 16 },
  divider:   { height: 1, backgroundColor: '#F5F5F5', marginVertical: 8 },
  stepperContainer: { position: 'relative', paddingVertical: 4 },
  stepperLine:      { position: 'absolute', top: 20, left: '10%', right: '10%', height: 3, backgroundColor: '#E5E7EB', borderRadius: 2 },
  stepperLineFill:  { position: 'absolute', top: 20, left: '10%', height: 3, backgroundColor: '#1669ef', borderRadius: 2, maxWidth: '80%' },
  stepperRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  stepCol:          { alignItems: 'center', flex: 1 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 6 },
  stepLabel: { fontSize: 9.5, textAlign: 'center', lineHeight: 13 },
  itemRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  itemQtyBox:    { width: 32, height: 32, borderRadius: 8, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  itemQtyText:   { fontSize: 13, fontWeight: 'bold', color: '#1669ef' },
  itemName:      { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  itemUnit:      { fontSize: 12, color: '#888' },
  itemPrice:     { fontSize: 14, fontWeight: 'bold', color: '#111' },
  billRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  billLabel:      { fontSize: 13, color: '#888' },
  billValue:      { fontSize: 13, color: '#111' },
  billTotal:      { borderTopWidth: 1, borderTopColor: '#F5F5F5', marginTop: 8, paddingTop: 10 },
  billTotalLabel: { fontSize: 15, fontWeight: '800', color: '#111' },
  billTotalValue: { fontSize: 16, fontWeight: '900', color: '#1669ef' },
  addressText: { fontSize: 14, color: '#555', lineHeight: 20, flex: 1 },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 13, color: '#111', fontWeight: '500' },
  actionBtnsCard:    { margin: 16, gap: 10 },
  invoiceBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, backgroundColor: '#1669ef', marginBottom: 10 },
  invoiceBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
  reorderBtnFull:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#1669ef', backgroundColor: '#EFF6FF' },
  reorderBtnFullText:{ fontSize: 15, fontWeight: '700', color: '#1669ef' },
  rateBtnFull:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, backgroundColor: '#FEF3C7' },
  rateBtnFullText:   { fontSize: 15, fontWeight: '700', color: '#92400e' },
  returnBtnFull:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, backgroundColor: '#FEF2F2' },
  returnBtnFullText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#DC2626', borderRadius: 14,
    padding: 14, backgroundColor: '#fff',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  deliveredCard: {
    backgroundColor: '#F0FDF4', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 12, padding: 20,
    alignItems: 'center', gap: 8,
  },
  deliveredText: { fontSize: 16, fontWeight: '700', color: '#16A34A' },
  deliveredSub:  { fontSize: 13, color: '#888' },
});
