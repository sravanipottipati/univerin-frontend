import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import client from '../../api/client';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VendorWalletScreen({ navigation }) {
  const [wallet, setWallet]         = useState(null);
  const [transactions, setTrans]    = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shop, setShop]               = useState(null);
  const [orders, setOrders]           = useState([]);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankName, setBankName]           = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankConfirmNumber, setBankConfirmNumber] = useState('');
  const [bankIFSC, setBankIFSC]           = useState('');
  const [savingBank, setSavingBank]       = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const downloadTDS = async () => {
    try {
      setDownloading(true);
      const token = `Bearer ${await AsyncStorage.getItem('access_token')}`;
      const url = `${client.defaults.baseURL}/invoices/tcs/`;
      const fileUri = FileSystem.documentDirectory + `univerin_tcs_Q${Math.ceil(selectedMonth/3)}_${selectedYear}.pdf`;
      const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: token }
      });
      // Check if response is error (small file = error JSON)
      const fileInfo = await FileSystem.getInfoAsync(downloadRes.uri);
      if (fileInfo.size < 1000) {
        Alert.alert('Not Available', 'TCS Certificate is only available for GST registered sellers.');
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'TCS Certificate',
        });
      }
    } catch (e) {
      console.log('TCS download error:', e.message);
      Alert.alert('Error', 'Download failed. Please try again!');
    } finally {
      setDownloading(false);
    }
  };

  const downloadSettlementPDF = async () => {
    try {
      setDownloading(true);
      const token = `Bearer ${await AsyncStorage.getItem('access_token')}`;
      const url = `${client.defaults.baseURL}/invoices/settlement/`;
      const fileUri = FileSystem.documentDirectory + `univerin_settlement_${selectedMonth}_${selectedYear}.pdf`;
      const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: token }
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Settlement Statement',
        });
      }
    } catch (e) {
      console.log('Settlement PDF error:', e.message);
      Alert.alert('Error', 'Download failed. Please try again!');
    } finally {
      setDownloading(false);
    }
  };

  const downloadExcel = async () => {
    try {
      setDownloading(true);
      const token = `Bearer ${await AsyncStorage.getItem('access_token')}`;
      const month = selectedMonth;
      const year = selectedYear;
      const url = `${client.defaults.baseURL}/invoices/export/seller/?month=${month}&year=${year}`;
      const fileUri = FileSystem.documentDirectory + `univerin_earnings_${month}_${year}.xlsx`;
      const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: token }
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Save Earnings Report',
        });
      }
    } catch (e) {
      console.log('Download error:', e.message);
      alert('Download failed. Please try again!');
    } finally {
      setDownloading(false);
    }
  };

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const fetchData = async () => {
    try {
      const [walletRes, transRes, shopRes, ordersRes] = await Promise.all([
        client.get('/wallet/summary/'),
        client.get('/wallet/transactions/'),
        client.get('/vendors/myshop/'),
        client.get('/orders/vendor/'),
      ]);
      setWallet(walletRes.data);
      const data = Array.isArray(transRes.data)
        ? transRes.data
        : transRes.data.transactions || [];
      setTrans(data);
      const shopData = shopRes.data;
      setShop(shopData);
      const ordersData = Array.isArray(ordersRes.data)
        ? ordersRes.data
        : ordersRes.data.orders || [];
      setOrders(ordersData);
      setBankName(shopData.bank_name || '');
      setBankAccountName(shopData.bank_account_name || '');
      setBankAccountNumber(shopData.bank_account_number || '');
      setBankConfirmNumber(shopData.bank_account_number || '');
      setBankIFSC(shopData.bank_ifsc_code || '');
    } catch (e) {
      console.log('Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const hasBankDetails = shop?.bank_account_number && shop?.bank_ifsc_code;

  const saveBankDetails = async () => {
    if (!bankAccountName.trim()) { Alert.alert('Error', 'Please enter account holder name'); return; }
    if (!bankAccountNumber.trim()) { Alert.alert('Error', 'Please enter account number'); return; }
    if (bankAccountNumber !== bankConfirmNumber) { Alert.alert('Error', 'Account numbers do not match'); return; }
    if (!bankIFSC.trim()) { Alert.alert('Error', 'Please enter IFSC code'); return; }
    setSavingBank(true);
    try {
      await client.patch('/vendors/myshop/', {
        bank_account_name:   bankAccountName,
        bank_account_number: bankAccountNumber,
        bank_ifsc_code:      bankIFSC.toUpperCase(),
        bank_name:           bankName,
      });
      setShowBankModal(false);
      fetchData();
      Alert.alert('Success', 'Bank details saved successfully!');
    } catch (e) {
      Alert.alert('Error', 'Could not save bank details');
    } finally {
      setSavingBank(false);
    }
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('VendorNotifications')}
        >
          <Ionicons name='notifications-outline' size={24} color='#444' />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* Total Earnings Card */}
        <View style={styles.totalCard}>
          <View style={styles.totalCardLeft}>
            <Text style={styles.totalLabel}>Total Earnings</Text>
            <Text style={styles.totalValue}>
              ₹{wallet?.total_earnings?.toFixed(0) || wallet?.wallet_balance?.toFixed(2) || '0'}
            </Text>
            <Text style={styles.lifetimeLabel}>Lifetime earnings</Text>
          </View>
          <View style={styles.totalCardIcon}>
            <Text style={styles.totalCardIconText}>₹</Text>
          </View>
        </View>

          {/* Today's Earnings */}
          {(() => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayDelivered = orders.filter(o => o.status === 'delivered' && new Date(o.created_at) >= todayStart);
            const todayTotal = todayDelivered.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
            const todayCommission = todayDelivered.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0);
            const todayNet = todayTotal - todayCommission;
            return (
              <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#BBF7D0' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#16A34A', marginBottom: 10 }}>Today's Earnings</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#888' }}>Orders Total</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#111' }}>{String.fromCharCode(8377)}{todayTotal.toFixed(0)}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#888' }}>Platform Fee</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#DC2626' }}>-{String.fromCharCode(8377)}{todayCommission.toFixed(0)}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#888' }}>Net Earnings</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#16A34A' }}>{String.fromCharCode(8377)}{todayNet.toFixed(0)}</Text>
                  </View>
                </View>
              </View>
            );
          })()}

        {/* Pending + Settled */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#FFF7ED' }]}>
            <Text style={styles.statIcon}>🕐</Text>
            <Text style={styles.statLabel}>Pending Settlement</Text>
            <Text style={[styles.statValue, { color: '#EA580C' }]}>
              ₹{wallet?.pending_settlement?.toFixed(0) || wallet?.wallet_balance?.toFixed(0) || '0'}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={styles.statLabel}>Settled Amount</Text>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>
              ₹{wallet?.settled_amount?.toFixed(0) || '0'}
            </Text>
          </View>
        </View>

        {/* Bank Details */}
        {!hasBankDetails ? (
          <TouchableOpacity style={styles.bankWarning} onPress={() => setShowBankModal(true)}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bankWarningTitle}>⚠️ Bank Details Missing!</Text>
              <Text style={styles.bankWarningText}>Add bank details to receive payments. Orders may be blocked without bank details.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#DC2626" />
          </TouchableOpacity>
        ) : (
          <View style={styles.bankCard}>
            <View style={styles.bankCardHeader}>
              <Text style={styles.bankCardTitle}>🏦 Bank Details</Text>
              <TouchableOpacity onPress={() => setShowBankModal(true)}>
                <Ionicons name="create-outline" size={18} color="#1669ef" />
              </TouchableOpacity>
            </View>
            <View style={styles.bankRow}><Text style={styles.bankLabel}>Account Name</Text><Text style={styles.bankValue}>{shop?.bank_account_name}</Text></View>
            <View style={styles.bankRow}><Text style={styles.bankLabel}>Account Number</Text><Text style={styles.bankValue}>{'*'.repeat((shop?.bank_account_number?.length || 4) - 4) + shop?.bank_account_number?.slice(-4)}</Text></View>
            <View style={styles.bankRow}><Text style={styles.bankLabel}>IFSC Code</Text><Text style={styles.bankValue}>{shop?.bank_ifsc_code}</Text></View>
            {shop?.bank_name && <View style={styles.bankRow}><Text style={styles.bankLabel}>Bank Name</Text><Text style={styles.bankValue}>{shop?.bank_name}</Text></View>}
          </View>
        )}

        {/* Download Report */}
        <View style={styles.downloadCard}>
          <View style={styles.downloadHeader}>
            <Text style={styles.downloadTitle}>📊 Monthly Earnings Report</Text>
            <Text style={styles.downloadSubtitle}>Download Excel for GST filing</Text>
          </View>
          <View style={styles.monthSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {months.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedMonth(i + 1)}
                  style={[styles.monthBtn, selectedMonth === i + 1 && styles.monthBtnActive]}
                >
                  <Text style={[styles.monthBtnText, selectedMonth === i + 1 && styles.monthBtnTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity
            style={[styles.downloadBtn, downloading && styles.downloadBtnDisabled]}
            onPress={downloadExcel}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.downloadBtnText}>⬇ Download {months[selectedMonth-1]} {selectedYear} Report</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: '#7C3AED', marginTop: 10 }, downloading && styles.downloadBtnDisabled]}
            onPress={downloadTDS}
            disabled={downloading}
          >
            <Text style={styles.downloadBtnText}>⬇ Download TCS Certificate (PDF)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: '#16A34A', marginTop: 10 }, downloading && styles.downloadBtnDisabled]}
            onPress={downloadSettlementPDF}
            disabled={downloading}
          >
            <Text style={styles.downloadBtnText}>⬇ Download Settlement Statement (PDF)</Text>
          </TouchableOpacity>
        </View>

        {/* Settlement History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Settlement History</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>Your settlements will appear here</Text>
          </View>
        ) : (
          transactions.map((txn, index) => (
            <View key={index} style={styles.txnCard}>
              <View style={styles.txnLeft}>
                <Text style={styles.txnId}>
                  SETT#{txn.id?.toString().slice(-4).toUpperCase() || index + 1001}
                </Text>
                <Text style={styles.txnDate}>{formatDate(txn.created_at || txn.date)}</Text>
              </View>
              <View style={styles.txnRight}>
                <Text style={styles.txnAmount}>₹{parseFloat(txn.net_settlement || txn.amount || 0).toFixed(0)}</Text>
                <View style={[
                  styles.txnBadge,
                  { backgroundColor: txn.status === 'settled' ? '#DCFCE7' : '#FFF7ED' }
                ]}>
                  <Text style={[
                    styles.txnBadgeText,
                    { color: txn.status === 'settled' ? '#16A34A' : '#EA580C' }
                  ]}>
                    ● {txn.status === 'settled' ? 'Paid' : 'Pending'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}


        {/* Order Transaction History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Order History</Text>
        </View>
        {orders.filter(o => o.status === 'delivered').length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No delivered orders yet</Text>
          </View>
        ) : (
          orders.filter(o => o.status === 'delivered').slice(0, 20).map((order, index) => {
            const total = parseFloat(order.total_amount || 0);
            const platformFee = parseFloat(order.platform_fee || 0);
            const net = total - platformFee;
            return (
              <View key={index} style={[styles.txnCard, { marginBottom: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnId}>Order #{order.order_number || order.id?.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.txnDate}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                    <Text style={{ fontSize: 11, color: '#888' }}>Total: <Text style={{ color: '#111', fontWeight: '600' }}>{String.fromCharCode(8377)}{total.toFixed(0)}</Text></Text>
                    <Text style={{ fontSize: 11, color: '#888' }}>Fee: <Text style={{ color: '#DC2626', fontWeight: '600' }}>-{String.fromCharCode(8377)}{platformFee.toFixed(0)}</Text></Text>
                    <Text style={{ fontSize: 11, color: '#888' }}>Net: <Text style={{ color: '#16A34A', fontWeight: '600' }}>{String.fromCharCode(8377)}{net.toFixed(0)}</Text></Text>
                  </View>
                </View>
                <View style={[styles.txnBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.txnBadgeText, { color: '#16A34A' }]}>Delivered</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
      {/* Bank Details Modal */}
      <Modal visible={showBankModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏦 Bank Details</Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Required for receiving payments</Text>
            <Text style={styles.fieldLabel}>Bank Name</Text>
            <TextInput style={styles.input} placeholder="e.g. State Bank of India" placeholderTextColor="#9CA3AF" value={bankName} onChangeText={setBankName} />
            <Text style={styles.fieldLabel}>Account Holder Name *</Text>
            <TextInput style={styles.input} placeholder="As per bank records" placeholderTextColor="#9CA3AF" value={bankAccountName} onChangeText={setBankAccountName} />
            <Text style={styles.fieldLabel}>Account Number *</Text>
            <TextInput style={styles.input} placeholder="Enter account number" placeholderTextColor="#9CA3AF" value={bankAccountNumber} onChangeText={setBankAccountNumber} keyboardType="numeric" secureTextEntry />
            <Text style={styles.fieldLabel}>Confirm Account Number *</Text>
            <TextInput style={styles.input} placeholder="Re-enter account number" placeholderTextColor="#9CA3AF" value={bankConfirmNumber} onChangeText={setBankConfirmNumber} keyboardType="numeric" />
            <Text style={styles.fieldLabel}>IFSC Code *</Text>
            <TextInput style={styles.input} placeholder="e.g. SBIN0001234" placeholderTextColor="#9CA3AF" value={bankIFSC} onChangeText={setBankIFSC} autoCapitalize="characters" />
            <TouchableOpacity style={styles.saveBtn} onPress={saveBankDetails} disabled={savingBank}>
              {savingBank ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Bank Details</Text>}
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom Tab */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: 20, paddingTop: 10 }}>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('VendorHome')}>
          <Ionicons name="home-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('VendorOrders')}>
          <Ionicons name="receipt-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('VendorProducts')}>
          <Ionicons name="cube-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('VendorProfile')}>
          <Ionicons name="person-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 24, color: '#111' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  bellBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  bellIcon: { fontSize: 22 },

  totalCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1669ef', margin: 16, borderRadius: 20, padding: 24,
  },
  totalCardLeft: {},
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  totalValue: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  lifetimeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  totalCardIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  totalCardIconText: { fontSize: 26 },

  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16,
  },
  statCard: {
    flex: 1, borderRadius: 16, padding: 16,
  },
  statIcon: { fontSize: 22, marginBottom: 8 },
  statLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: 'bold' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#111' },
  viewAll: { fontSize: 13, color: '#1669ef', fontWeight: '600' },

  txnCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  txnLeft: {},
  txnId: { fontSize: 14, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  txnDate: { fontSize: 12, color: '#888' },
  txnRight: { alignItems: 'flex-end', gap: 6 },
  txnAmount: { fontSize: 15, fontWeight: 'bold', color: '#111' },
  txnBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  txnBadgeText: { fontSize: 12, fontWeight: '600' },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#888' },
  downloadCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    marginBottom: 8,
  },
  downloadHeader: { marginBottom: 12 },
  downloadTitle: { fontSize: 15, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  downloadSubtitle: { fontSize: 12, color: '#888' },
  monthSelector: { marginBottom: 12 },
  monthBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#F3F4F6', marginRight: 8,
  },
  monthBtnActive: { backgroundColor: '#1669ef' },
  monthBtnText: { fontSize: 13, color: '#666', fontWeight: '600' },
  monthBtnTextActive: { color: '#fff' },
  downloadBtn: {
    backgroundColor: '#1669ef', padding: 14, borderRadius: 12,
    alignItems: 'center',
  },
  downloadBtnDisabled: { backgroundColor: '#93c5fd' },
  downloadBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  bankWarning: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#FECACA' },
  bankWarningTitle: { fontSize: 13, fontWeight: '700', color: '#DC2626', marginBottom: 2 },
  bankWarningText: { fontSize: 12, color: '#DC2626' },
  bankCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  bankCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bankCardTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  bankLabel: { fontSize: 13, color: '#888' },
  bankValue: { fontSize: 13, color: '#111', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#111' },
  modalSub: { fontSize: 13, color: '#888', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#111', backgroundColor: '#F9FAFB' },
  saveBtn: { backgroundColor: '#1669ef', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});