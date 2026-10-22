import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Linking, Alert, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import client from '../../api/client';

const STATUS_INFO = {
  placed:     { label: 'New Order',        icon: 'receipt-outline',          color: '#EA580C', bg: '#FFF7ED' },
  accepted:   { label: 'Accepted',         icon: 'checkmark-circle-outline', color: '#16A34A', bg: '#F0FDF4' },
  preparing:  { label: 'Preparing',        icon: 'restaurant-outline',       color: '#1669ef', bg: '#eff6ff' },
  dispatched: { label: 'Out for Delivery', icon: 'bicycle-outline',          color: '#8B5CF6', bg: '#F5F3FF' },
  delivered:  { label: 'Delivered',        icon: 'home-outline',             color: '#16A34A', bg: '#DCFCE7' },
  cancelled:  { label: 'Cancelled',        icon: 'close-circle-outline',     color: '#DC2626', bg: '#FEF2F2' },
  rejected:   { label: 'Rejected',         icon: 'close-circle-outline',     color: '#DC2626', bg: '#FEF2F2' },
};

const NEXT_ACTION = {
  placed:     { label: 'Accept Order',       next: 'accepted',   color: '#16A34A', icon: 'checkmark-circle' },
  accepted:   { label: 'Start Preparing',    next: 'preparing',  color: '#1669ef', icon: 'restaurant' },
};

export default function VendorOrderDetailScreen({ navigation, route }) {
  const { orderId }             = route.params;
  const [order, setOrder]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showReject, setShowReject]     = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const downloadInvoice = async (type) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const endpoint = type === 'doc2' 
        ? `/invoices/seller/${orderId}/`
        : `/invoices/commission/${orderId}/`;
      const url = `https://api.univerin.in/api${endpoint}`;
      const fileUri = FileSystem.documentDirectory + `${type}_${orderId}.pdf`;
      const res = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, {
          mimeType: 'application/pdf',
          dialogTitle: type === 'doc2' ? 'Doc 2 - Seller Invoice' : 'Doc 4 - Commission Invoice',
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not download invoice');
    }
  };

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

  useFocusEffect(
    useCallback(() => {
      fetchOrder();
    }, [orderId])
  );

  const handleUpdateStatus = async (newStatus) => {
    Alert.alert('Confirm', `Mark order as "${STATUS_INFO[newStatus]?.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: async () => {
        setUpdating(true);
        try {
          await client.post(`/orders/${orderId}/status/`, { status: newStatus });
          await fetchOrder();
        } catch (e) {
          console.log('Status update error:', JSON.stringify(e.response?.data), e.message);
          Alert.alert('Error', JSON.stringify(e.response?.data) || e.message || 'Could not update status');
        } finally { setUpdating(false); }
      }}
    ]);
  };

  const handleRequestDelivery = async () => {
    if (updating) return;

    setUpdating(true);
    try {
      const latest = await client.get(`/orders/${orderId}/`);
      const current = latest.data;
      setOrder(current);

      const canRequest =
        current.status === 'preparing' &&
        !current.delivery_partner &&
        !current.delivery_partner_id &&
        ['unassigned', 'offered'].includes(current.dp_status);

      if (!canRequest) {
        Alert.alert(
          'Delivery Status Updated',
          'This order is no longer eligible for delivery assignment.'
        );
        return;
      }

      const response = await client.post(
        `/orders/${orderId}/request-delivery/`
      );

      await fetchOrder();

      Alert.alert(
        'Delivery Partner',
        response.data?.message || 'Delivery request completed.'
      );
    } catch (error) {
      Alert.alert(
        'Delivery Request Failed',
        error.response?.data?.error ||
          'Unable to find a Delivery Partner. Please try again.'
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async () => {
    setUpdating(true);
    try {
      await client.post(`/orders/${orderId}/status/`, { status: 'rejected', reason: rejectReason || 'Rejected by vendor' });
      setShowReject(false);
      await fetchOrder();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not reject order');
    } finally { setUpdating(false); }
  };

  const handleCallBuyer = () => {
    if (order?.buyer_phone) {
      Linking.openURL(`tel:${order.buyer_phone}`).catch(() => Alert.alert('Error', 'Could not open phone'));
    } else {
      Alert.alert('No phone number', 'Buyer phone number not available');
    }
  };

  const handleOpenMaps = () => {
    const address = encodeURIComponent(order.delivery_address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`)
      .catch(() => Alert.alert('Error', 'Could not open maps'));
  };

  const handleShareOrder = async () => {
    const items = order.items?.map(i => `  • ${i.quantity}x ${i.product_name || i.name} — Rs.${(i.quantity * parseFloat(i.price)).toFixed(0)}`).join('\n') || '';
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`;
    const text = `🛵 *Delivery Details*
━━━━━━━━━━━━━━━
📦 Order ID: #${order.order_number || order.id?.slice(0, 8).toUpperCase()}
👤 Customer: ${order.buyer_name || 'Customer'}
📞 Phone: ${order.buyer_phone || 'N/A'}

🛍️ *Items:*
${items}

📍 *Delivery Address:*
${order.delivery_address}

🗺️ Map: ${mapsLink}
━━━━━━━━━━━━━━━
💰 Total: Rs.${parseFloat(order.total_amount).toFixed(0)} (COD)`;

    try {
      await Share.share({ message: text, title: `Order #${order.order_number}` });
    } catch (e) {
      Alert.alert('Error', 'Could not share order details');
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1669ef" /></View>;
  if (!order)  return <View style={styles.loadingContainer}><Text style={styles.errorText}>Order not found</Text></View>;

  const statusInfo  = STATUS_INFO[order.status] || STATUS_INFO.placed;
  const nextAction  = NEXT_ACTION[order.status];
  const isCancelled = ['cancelled', 'rejected'].includes(order.status);
  const isDelivered = order.status === 'delivered';
  const isNew       = order.status === 'placed';
  const subtotal        = order.items?.reduce((sum, i) => sum + (parseFloat(i.price) * i.quantity * (1 + (parseFloat(i.product_gst || 0) / 100))), 0) || parseFloat(order.subtotal || 0);
  const commissionRate  = parseFloat(order.commission_rate || 0);
  const platformFeeGST  = Math.round(parseFloat(order.platform_fee || 0) * 1.18);
  const rawSubtotal     = parseFloat(order.subtotal || order.items?.reduce((s,i) => s + parseFloat(i.price) * i.quantity, 0) || 0);
  const commissionBase  = parseFloat(order.commission_amount || (rawSubtotal * commissionRate / 100));
  const commissionAmt   = parseFloat((commissionBase * 1.18).toFixed(2)); // incl. 18% GST
  const tdsAmt          = parseFloat((rawSubtotal * 1 / 100).toFixed(2));
  const gstTcsAmt       = parseFloat((rawSubtotal * 0.5 / 100).toFixed(2));
  const tcsAmt          = tdsAmt;
  const netSettlement   = subtotal - commissionAmt - tdsAmt - gstTcsAmt;
  const deliveryFee = parseFloat(order.delivery_fee || 0);
  const total       = parseFloat(order.total_amount || 0);
  const date        = new Date(order.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>#{order.order_number || order.id?.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.headerSub}>{date}</Text>
        </View>
        <TouchableOpacity style={styles.callBtn} onPress={handleCallBuyer}>
          <Ionicons name="call-outline" size={20} color="#1669ef" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={[styles.statusBanner, { backgroundColor: statusInfo.bg, borderColor: statusInfo.color + '40' }]}>
          <View style={[styles.statusIconBox, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon} size={24} color="#fff" />
          </View>
          <View style={styles.statusInfo}>
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            <Text style={styles.statusSub}>
              {isNew ? 'Respond within 10 minutes' : isDelivered ? 'Order completed successfully' : isCancelled ? 'This order was cancelled' : 'Update status as you progress'}
            </Text>
          </View>
          <Text style={styles.statusAmount}>Rs.{rawSubtotal.toFixed(0)}</Text>
        </View>

        {isNew && (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>Action Required</Text>
            <Text style={styles.actionSub}>Accept or reject this order within 10 minutes</Text>
            <View style={styles.actionBtns}>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => setShowReject(true)} disabled={updating}>
                <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => handleUpdateStatus('accepted')} disabled={updating}>
                {updating ? <ActivityIndicator color="#fff" size="small" /> : (
                  <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.acceptBtnText}>Accept Order</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!isNew && !isCancelled && !isDelivered && nextAction && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Update Order Status</Text>
            <TouchableOpacity style={[styles.progressBtn, { backgroundColor: nextAction.color }]} onPress={() => handleUpdateStatus(nextAction.next)} disabled={updating}>
              {updating ? <ActivityIndicator color="#fff" /> : (
                <><Ionicons name={nextAction.icon} size={20} color="#fff" /><Text style={styles.progressBtnText}>{nextAction.label}</Text></>
              )}
            </TouchableOpacity>
          </View>
        )}

        {order.status === 'preparing' &&
          !order.delivery_partner &&
          !order.delivery_partner_id &&
          ['unassigned', 'offered'].includes(order.dp_status) && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Delivery Assignment</Text>
            <TouchableOpacity
              style={[styles.progressBtn, { backgroundColor: '#16A34A' }]}
              onPress={handleRequestDelivery}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="bicycle-outline" size={20} color="#fff" />
                  <Text style={styles.progressBtnText}>Find Delivery Partner</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isDelivered && (
          <View style={[styles.progressCard, { backgroundColor: '#F0FDF4' }]}>
            <View style={styles.deliveredRow}>
              <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
              <View>
                <Text style={[styles.progressTitle, { color: '#16A34A' }]}>Order Delivered!</Text>
                <Text style={styles.progressSub}>Payment collected: Rs.{total % 1 === 0 ? total.toFixed(0) : total.toFixed(1)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={styles.invoiceBtn} onPress={() => downloadInvoice('doc2')}>
                <Ionicons name="document-text-outline" size={16} color="#1669ef" />
                <Text style={styles.invoiceBtnText}>Seller Invoice</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.invoiceBtn} onPress={() => downloadInvoice('doc4')}>
                <Ionicons name="receipt-outline" size={16} color="#8B5CF6" />
                <Text style={[styles.invoiceBtnText, { color: '#8B5CF6' }]}>Commission Invoice</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isDelivered && (
          <View style={[styles.card, { borderWidth: 1, borderColor: '#16A34A' }]}>
            <Text style={[styles.cardTitle, { color: '#16A34A' }]}>₹ Settlement Breakdown</Text>
            <View style={styles.billRow}><Text style={styles.billLabel}>Items Total (incl. GST)</Text><Text style={styles.billValue}>Rs.{subtotal.toFixed(2)}</Text></View>
            <View style={styles.billRow}><Text style={styles.billLabel}>Commission ({commissionRate}%)</Text><Text style={[styles.billValue, { color: '#DC2626' }]}>- Rs.{commissionAmt.toFixed(2)}</Text></View>
            <View style={styles.billRow}><Text style={styles.billLabel}>GST TCS (0.5%)</Text><Text style={[styles.billValue, { color: '#DC2626' }]}>- Rs.{gstTcsAmt.toFixed(2)}</Text></View>
            <View style={styles.billRow}><Text style={styles.billLabel}>TDS 194-O (1%)</Text><Text style={[styles.billValue, { color: '#DC2626' }]}>- Rs.{tdsAmt.toFixed(2)}</Text></View>
            <View style={styles.divider} />
            <View style={styles.billRow}>
              <Text style={styles.billTotalLabel}>Net Settlement</Text>
              <Text style={[styles.billTotalValue, { color: '#16A34A' }]}>Rs.{netSettlement.toFixed(2)}</Text>
            </View>
          </View>
        )}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ({order.items?.length || 0})</Text>
          {order.items?.map((item, i) => (
            <View key={i} style={[styles.itemRow, i < order.items.length - 1 && styles.itemRowBorder]}>
              <View style={styles.itemQtyBox}><Text style={styles.itemQtyText}>{item.quantity}</Text></View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product_name || item.name}</Text>
                <Text style={styles.itemUnit}>Rs.{parseFloat(item.price).toFixed(0)} each</Text>
              </View>
              <Text style={styles.itemPrice}>Rs.{(item.quantity * parseFloat(item.price)).toFixed(0)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.billRow}><Text style={styles.billTotalLabel}>Items Total (incl. GST)</Text><Text style={styles.billTotalValue}>Rs.{subtotal.toFixed(2)}</Text></View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}></Text>
          </View>

        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Address</Text>
          {order.buyer_name && <View style={styles.buyerRow}><Ionicons name="person-outline" size={16} color="#888" /><Text style={styles.buyerName}>{order.buyer_name}</Text></View>}
          <Text style={styles.addressText}>{order.delivery_address}</Text>
          {order.instructions ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, backgroundColor: '#FFFBEB', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' }}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#D97706', marginBottom: 2 }}>Special Instructions</Text>
                <Text style={{ fontSize: 13, color: '#92400E' }}>{order.instructions}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.addressBtns}>
            <TouchableOpacity style={styles.mapsBtn} onPress={handleShareOrder}>
              <Ionicons name="share-social-outline" size={16} color="#1669ef" /><Text style={styles.mapsBtnText}>Share Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.callBtnSmall} onPress={handleCallBuyer}>
              <Ionicons name="call-outline" size={16} color="#16A34A" /><Text style={styles.callBtnSmallText}>Call Buyer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Order ID</Text><Text style={styles.infoValue}>#{order.order_number || order.id?.slice(0, 8).toUpperCase()}</Text></View>
          <View style={styles.divider} />
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Date & Time</Text><Text style={styles.infoValue}>{date}</Text></View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Mode</Text>
            <Text style={[styles.infoValue, { color: '#16A34A' }]}>
              {order.payment_mode === 'online' ? 'Online Payment' : 'Cash on Delivery'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Status</Text>
            <Text style={[styles.infoValue, { color: order.payment_status === 'paid' ? '#16A34A' : '#EA580C', fontWeight: '700' }]}>
              {order.payment_status === 'paid' ? '✅ Paid' : order.payment_mode === 'cod' ? '⏳ Pending (COD)' : '⏳ Pending'}
            </Text>
          </View>
          {order.notes ? <><View style={styles.divider} /><View style={styles.infoRow}><Text style={styles.infoLabel}>Note</Text><Text style={[styles.infoValue, { color: '#EA580C' }]}>{order.notes}</Text></View></> : null}
        </View>
      </ScrollView>

      <View style={styles.bottomTab}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorHome')}>
          <Ionicons name="grid-outline" size={22} color="#9CA3AF" /><Text style={styles.tabLabel}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorOrders')}>
          <Ionicons name="receipt" size={22} color="#1669ef" /><Text style={styles.tabLabelActive}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorProducts')}>
          <Ionicons name="cube-outline" size={22} color="#9CA3AF" /><Text style={styles.tabLabel}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorProfile')}>
          <Ionicons name="person-outline" size={22} color="#9CA3AF" /><Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showReject} transparent animationType="slide" onRequestClose={() => setShowReject(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReject(false)} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Reject Order?</Text>
          <Text style={styles.modalSub}>Please give a reason (optional)</Text>
          <View style={styles.reasonBtns}>
            {['Item out of stock', 'Shop is closed', 'Cannot deliver to this area', 'Other'].map(reason => (
              <TouchableOpacity key={reason} style={[styles.reasonBtn, rejectReason === reason && styles.reasonBtnActive]} onPress={() => setRejectReason(reason)}>
                <Text style={[styles.reasonBtnText, rejectReason === reason && styles.reasonBtnTextActive]}>{reason}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.reasonInput} placeholder="Or type a reason..." placeholderTextColor="#9CA3AF" value={rejectReason} onChangeText={setRejectReason} />
          <TouchableOpacity style={styles.confirmRejectBtn} onPress={handleReject} disabled={updating}>
            {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmRejectBtnText}>Confirm Reject</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReject(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F0F2F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:        { fontSize: 16, color: '#888' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  headerSub:   { fontSize: 11, color: '#888', marginTop: 2 },
  callBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  statusBanner:  { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
  statusIconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  statusInfo:    { flex: 1 },
  statusLabel:   { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  statusSub:     { fontSize: 12, color: '#888' },
  statusAmount:  { fontSize: 18, fontWeight: '900', color: '#111' },
  actionCard:    { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16, borderWidth: 1.5, borderColor: '#FED7AA' },
  actionTitle:   { fontSize: 15, fontWeight: '800', color: '#EA580C', marginBottom: 4 },
  actionSub:     { fontSize: 12, color: '#888', marginBottom: 16 },
  actionBtns:    { flexDirection: 'row', gap: 12 },
  rejectBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#DC2626', borderRadius: 12, paddingVertical: 12 },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  acceptBtn:     { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 12 },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  progressCard:    { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16 },
  progressTitle:   { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 },
  progressSub:     { fontSize: 12, color: '#888' },
  progressBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  progressBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  deliveredRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card:      { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 12 },
  divider:   { height: 1, backgroundColor: '#F5F5F5', marginVertical: 8 },
  itemRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  itemQtyBox:    { width: 40, height: 40, borderRadius: 10, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  itemQtyText:   { fontSize: 16, fontWeight: 'bold', color: '#1669ef' },
  itemInfo:      { flex: 1 },
  itemName:      { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 3 },
  itemUnit:      { fontSize: 14, color: '#555', fontWeight: '500' },
  itemPrice:     { fontSize: 17, fontWeight: '800', color: '#111' },
  billRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  billLabel:      { fontSize: 13, color: '#888' },
  billValue:      { fontSize: 13, color: '#111' },
  billTotal:      { borderTopWidth: 1, borderTopColor: '#F5F5F5', marginTop: 8, paddingTop: 10 },
  billTotalLabel: { fontSize: 15, fontWeight: '800', color: '#111' },
  billTotalValue: { fontSize: 16, fontWeight: '900', color: '#1669ef' },
  buyerRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  buyerName:        { fontSize: 14, fontWeight: '600', color: '#111' },
  addressText:      { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 12 },
  addressBtns:      { flexDirection: 'row', gap: 10 },
  mapsBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#eff6ff', borderRadius: 10, padding: 10 },
  mapsBtnText:      { fontSize: 13, color: '#1669ef', fontWeight: '600' },
  callBtnSmall:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10 },
  callBtnSmallText: { fontSize: 13, color: '#16A34A', fontWeight: '600' },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 13, color: '#111', fontWeight: '500' },
  invoiceBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#1669ef', backgroundColor: '#eff6ff' },
  invoiceBtnText: { fontSize: 12, fontWeight: '600', color: '#1669ef' },
  bottomTab:      { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: 24, paddingTop: 10, position: 'absolute', bottom: 0, left: 0, right: 0 },
  tabItem:        { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel:       { fontSize: 11, color: '#9CA3AF' },
  tabLabelActive: { fontSize: 11, color: '#1669ef', fontWeight: 'bold' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 4 },
  modalSub:     { fontSize: 13, color: '#888', marginBottom: 16 },
  reasonBtns:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  reasonBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  reasonBtnActive:   { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  reasonBtnText:     { fontSize: 13, color: '#555' },
  reasonBtnTextActive: { color: '#DC2626', fontWeight: '700' },
  reasonInput:         { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#111', backgroundColor: '#F9FAFB', marginBottom: 16 },
  confirmRejectBtn:    { backgroundColor: '#DC2626', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  confirmRejectBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn:     { alignItems: 'center', padding: 12 },
  cancelBtnText: { fontSize: 14, color: '#888' },
});
