import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';

export default function VendorProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [shop, setShop]   = useState(null);
  const [wallet, setWallet] = useState(null);

  useFocusEffect(useCallback(() => {
    const fetchData = async () => {
      try {
        const [shopRes, walletRes] = await Promise.all([
          client.get('/vendors/myshop/'),
          client.get('/wallet/summary/'),
        ]);
        setShop(shopRes.data);
        setWallet(walletRes.data);
      } catch (e) {
        console.log('Error:', e.message);
      }
    };
    fetchData();
  }));

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your seller account? This action cannot be undone. We will process your request within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.post('/users/delete-account-request/');
              Alert.alert('Request Submitted', 'Your account deletion request has been submitted. We will delete your account within 24 hours.');
            } catch (e) {
              Alert.alert('Error', 'Failed to submit request. Please email contact@univerin.in');
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout from Univerin?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]
    );
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'V';

  const getMinOrderValue = (category) => {
    if (!category) return 199;
    const cat = category.toLowerCase();
    const mov = { 'restaurant': 499, 'supermarket': 699, 'bakery': 399, 'veg_fruits': 199, 'vegetables': 199, 'fruits': 199 };
    return mov[cat] || 199;
  };
  const storedMOV = parseFloat(shop?.min_order || shop?.min_order_value || 0);
  const minOrderValue = storedMOV > 100 ? storedMOV : getMinOrderValue(shop?.category);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('VendorNotifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#444" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.editIconBtn}
            onPress={() => navigation.navigate('VendorEditShop', { shop })}
          >
            <Ionicons name="create-outline" size={16} color="#1669ef" />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.full_name || 'Vendor'}</Text>
          <Text style={styles.shopName}>{shop?.shop_name || 'Your Shop'}</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>{shop?.town || 'Your Town'}</Text>
          </View>
        </View>

        {/* Earnings Card */}
        <TouchableOpacity
          style={styles.earningsCard}
          onPress={() => navigation.navigate('VendorWallet')}
        >
          <View>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsValue}>
              ₹{wallet?.total_earnings?.toFixed(0) || wallet?.wallet_balance?.toFixed(0) || '0'}
            </Text>
            <Text style={styles.viewEarnings}>View Earnings {'>'}</Text>
          </View>
          <View style={styles.earningsIconBox}>
            <Text style={styles.earningsIcon}>₹</Text>
          </View>
        </TouchableOpacity>

        {/* GPS Warning Banner */}
        {shop && !shop.latitude && (
          <TouchableOpacity
            style={styles.gpsWarning}
            onPress={() => navigation.navigate('VendorEditShop', { shop })}
          >
            <Ionicons name="location-outline" size={20} color="#92400e" />
            <View style={{ flex: 1 }}>
              <Text style={styles.gpsWarningTitle}>📍 Set Shop Location</Text>
              <Text style={styles.gpsWarningText}>Customers can't find your shop without GPS. Tap to set location.</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        )}
        {/* Account Menu */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            onPress={() => navigation.navigate('VendorEditShop', { shop })}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: '#eff6ff' }]}>
                <Text style={styles.menuIcon}>👤</Text>
              </View>
              <Text style={styles.menuLabel}>Edit Profile</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            onPress={() => navigation.navigate('VendorProducts')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="cube-outline" size={20} color="#EA580C" />
              </View>
              <Text style={styles.menuLabel}>My Products</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            onPress={() => navigation.navigate('VendorWallet')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="wallet-outline" size={20} color="#16A34A" />
              </View>
              <Text style={styles.menuLabel}>Earnings & Settlements</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            onPress={() => navigation.navigate('VendorHelp')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="help-circle-outline" size={20} color="#EA580C" />
              </View>
              <Text style={styles.menuLabel}>Help & Support</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('PrivacyPolicy')}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="document-text-outline" size={20} color="#6B7280" />
              </View>
              <Text style={styles.menuLabel}>Privacy Policy</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('TermsAndConditions')}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#6B7280" />
              </View>
              <Text style={styles.menuLabel}>Terms & Conditions</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

        </View>

        {/* Shop Details */}
        <Text style={styles.sectionTitle}>Shop Details</Text>
        <View style={styles.menuCard}>
          <View style={[styles.infoRow, styles.menuItemBorder]}>
            <Text style={styles.infoLabel}>Shop Name</Text>
            <Text style={styles.infoValue}>{shop?.shop_name || '—'}</Text>
          </View>
          <View style={[styles.infoRow, styles.menuItemBorder]}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>{shop?.category || '—'}</Text>
          </View>
          <View style={[styles.infoRow, styles.menuItemBorder]}>
            <Text style={styles.infoLabel}>Delivery Type</Text>
            <Text style={styles.infoValue}>{shop?.delivery_type || '—'}</Text>
          </View>
          <View style={[styles.infoRow, styles.menuItemBorder]}>
            <Text style={styles.infoLabel}>Est. Delivery Time</Text>
            <Text style={styles.infoValue}>{shop?.estimated_delivery_time || 30} mins</Text>
          </View>
          <View style={styles.infoRow}>
            <View>
              <Text style={styles.infoLabel}>Minimum Order Value</Text>
              <Text style={[styles.infoLabel, { fontSize: 11, color: '#1669ef' }]}>Set by Platform</Text>
            </View>
            <Text style={[styles.infoValue, { color: '#16A34A', fontWeight: '700' }]}>₹{minOrderValue}</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#1669ef" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.logoutBtn, { borderColor: '#ef4444', marginTop: 8 }]} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
          <Text style={[styles.logoutText, { color: '#ef4444' }]}>Delete Account</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Univerin Seller v1.0.0</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Tab */}
      <View style={[styles.bottomTab, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorHome')}>
          <Ionicons name="grid-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorOrders')}>
          <Ionicons name="receipt-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorProducts')}>
          <Ionicons name="cube-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="person" size={22} color="#1669ef" />
          <Text style={styles.tabLabelActive}>Profile</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  bellBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  bellIcon: { fontSize: 22 },

  profileCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  editIconBtn: {
    alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  editIcon: { fontSize: 14 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#1669ef', justifyContent: 'center',
    alignItems: 'center', marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  shopName: { fontSize: 14, color: '#555', marginBottom: 6 },
  gpsWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderRadius: 12, padding: 14, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: '#fcd34d' },
  gpsWarningTitle: { fontSize: 13, fontWeight: '700', color: '#92400e', marginBottom: 2 },
  gpsWarningText: { fontSize: 12, color: '#92400e' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationIcon: { fontSize: 14 },
  locationText: { fontSize: 13, color: '#888' },

  earningsCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1669ef', marginHorizontal: 16, marginBottom: 16,
    borderRadius: 16, padding: 20,
  },
  earningsLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  earningsValue: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  viewEarnings: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  earningsIconBox: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  earningsIcon: { fontSize: 24 },

  sectionTitle: {
    fontSize: 14, fontWeight: '600', color: '#888',
    marginHorizontal: 16, marginBottom: 8, marginTop: 4,
  },
  menuCard: {
    backgroundColor: '#fff', marginHorizontal: 16,
    borderRadius: 16, marginBottom: 16, overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  menuIcon: { fontSize: 18 },
  menuLabel: { fontSize: 14, color: '#111', fontWeight: '500' },
  menuArrow: { fontSize: 20, color: '#9CA3AF' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#111' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#1669ef',
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16,
    padding: 16, alignItems: 'center', marginBottom: 12,
  },
  logoutText: { fontSize: 15, color: '#1669ef', fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginBottom: 8 },

  bottomTab: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 24, paddingTop: 10,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 22, marginBottom: 2, color: '#9CA3AF' },
  tabLabel: { fontSize: 11, color: '#9CA3AF' },
  tabLabelActive: { fontSize: 11, color: '#1669ef', fontWeight: 'bold' },
});