import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';

const STATUS_LABELS = {
  pending_kyc:          { label: 'Documents Pending',   color: '#92400E', bg: '#FFFBEB' },
  pending_verification: { label: 'Under Review',        color: '#92400E', bg: '#FFFBEB' },
  approved:             { label: 'Approved',            color: '#166534', bg: '#F0FDF4' },
  rejected:             { label: 'Rejected',            color: '#991B1B', bg: '#FEF2F2' },
};

export default function DPProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [dpStatus, setDpStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'DP';

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        const res = await client.get('/dp/onboarding/status/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDpStatus(res.data);
      } catch (e) {
        // silent — profile still shows basic info even if this fails
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        await logout();
      } },
    ]);
  };

  const statusInfo = dpStatus ? STATUS_LABELS[dpStatus.status] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={22} color="#1669ef" />
        <Text style={styles.backBtnText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.full_name || 'Delivery Partner'}</Text>
          <Text style={styles.phone}>+91 {user?.phone_number}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vehicle & Documents</Text>
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
        ) : (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Verification Status</Text>
              {statusInfo && (
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                </View>
              )}
            </View>
            {dpStatus?.vehicle_type && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Vehicle</Text>
                <Text style={styles.statusValue}>
                  {dpStatus.vehicle_type.charAt(0).toUpperCase() + dpStatus.vehicle_type.slice(1)} — {dpStatus.vehicle_number}
                </Text>
              </View>
            )}
            {dpStatus?.rejection_reason && (
              <Text style={styles.rejectionText}>Reason: {dpStatus.rejection_reason}</Text>
            )}
          </>
        )}
      </View>

      <View style={styles.menuCard}>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('DPEarnings')}>
          <Ionicons name="wallet-outline" size={20} color="#6B7280" />
          <Text style={styles.menuText}>Earnings</Text>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('DPHelp')}>
          <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.menuText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#6B7280" />
          <Text style={styles.menuText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('TermsAndConditions')}>
          <Ionicons name="document-text-outline" size={20} color="#6B7280" />
          <Text style={styles.menuText}>Terms & Conditions</Text>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    marginBottom: 16, marginTop: 44, alignSelf: 'flex-start',
    paddingVertical: 8, paddingRight: 12,
  },
  backBtnText: { fontSize: 16, color: '#1669ef', fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#1669ef',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: '#111827' },
  phone: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusLabel: { fontSize: 13, color: '#6B7280' },
  statusValue: { fontSize: 13, color: '#111827', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  rejectionText: { fontSize: 12, color: '#991B1B', marginTop: 4, fontStyle: 'italic' },
  menuCard: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuText: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: '#F0EFEA', marginLeft: 48 },
  logoutBtn: {
    borderWidth: 1, borderColor: '#1669ef', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', marginBottom: 20,
  },
  logoutText: { color: '#1669ef', fontSize: 15, fontWeight: '700' },
});