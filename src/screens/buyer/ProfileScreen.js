import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import client from '../../api/client';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, setUser } = useAuth();
  const isFocused = useIsFocused();
  const [uploading, setUploading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (isFocused) {
      client.get('/orders/notifications/').then(res => setUnreadCount(res.data.unread || 0)).catch(() => {});
    }
  }, [isFocused]);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.post('/users/delete-account-request/');
              await logout();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete account. Please email contact@univerin.in');
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
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  // ── Profile Photo Upload ───────────────────────────────────────────────────
  const handlePhotoUpload = async () => {
    Alert.alert(
      'Profile Photo',
      'Choose an option',
      [
        { text: 'Camera',       onPress: () => pickImage('camera')  },
        { text: 'Gallery',      onPress: () => pickImage('gallery') },
        user?.photo_url
          ? { text: 'Remove Photo', onPress: removePhoto, style: 'destructive' }
          : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean)
    );
  };

  const pickImage = async (source) => {
    try {
      // Request permission
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery permission is required');
          return;
        }
      }

      // Launch picker
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect:        [1, 1],
            quality:       0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes:    ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect:        [1, 1],
            quality:       0.7,
          });

      if (result.canceled) return;

      // Upload to backend
      await uploadPhoto(result.assets[0]);

    } catch (err) {
      console.log('pickImage error:', err.message);
      Alert.alert('Error', 'Could not pick image');
    }
  };

  const uploadPhoto = async (imageAsset) => {
    try {
      setUploading(true);
      const token = await AsyncStorage.getItem('access_token'); // ← FIXED

      const formData = new FormData();
      formData.append('photo', {
        uri:  imageAsset.uri,
        name: 'profile_photo.jpg',
        type: 'image/jpeg',
      });

      const res = await client.post('/users/profile/photo/', formData, {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update user in context + AsyncStorage
      const updatedUser = { ...user, photo_url: res.data.photo_url };
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

      Alert.alert('✅ Success', 'Profile photo updated!');

    } catch (err) {
      console.log('uploadPhoto error:', err?.response?.data || err.message);
      Alert.alert('Error', 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    try {
      setUploading(true);
      const token = await AsyncStorage.getItem('access_token'); // ← FIXED
      await client.delete('/users/profile/photo/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedUser = { ...user, photo_url: null };
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      Alert.alert('✅ Done', 'Profile photo removed');
    } catch (err) {
      Alert.alert('Error', 'Could not remove photo');
    } finally {
      setUploading(false);
    }
  };

  const menuItems = [
    { icon: '👤', label: 'Edit Profile',   screen: 'EditProfile' },
    { icon: '📍', label: 'My Addresses',   screen: 'Address'     },
    { icon: '❤️',  label: 'Wishlist',       screen: 'Wishlist'    },
    { icon: '❓', label: 'Help & Support', screen: 'HelpSupport' },
    { icon: '🔒', label: 'Privacy Policy', screen: 'PrivacyPolicy' },
    { icon: '📋', label: 'Terms & Conditions', screen: 'TermsAndConditions' },
    { icon: '↩️', label: 'Refund Policy', screen: 'RefundPolicy' },
    { icon: '📞', label: 'Contact Us', screen: 'ContactUs' },

  ];

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={19} color="#111" />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>

            {/* Avatar — photo or initials */}
            <TouchableOpacity onPress={handlePhotoUpload} disabled={uploading}>
              {user?.photo_url ? (
                <View style={styles.avatarWrapper}>
                  <Image
                    source={{ uri: user.photo_url }}
                    style={styles.avatarImage}
                  />
                  {uploading && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                  <View style={styles.cameraIcon}>
                    <Text style={styles.cameraIconText}>📷</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.avatarWrapper}>
                  <View style={styles.avatar}>
                    {uploading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.avatarText}>{initials}</Text>
                    }
                  </View>
                  <View style={styles.cameraIcon}>
                    <Text style={styles.cameraIconText}>📷</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Edit button */}
            <TouchableOpacity
              style={styles.editIconBtn}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.tapPhotoHint}>Tap photo to change</Text>
          <Text style={styles.userName}>{user?.full_name || 'User'}</Text>
          <Text style={styles.userPhone}>+91 {user?.phone_number || ''}</Text>
          {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
          {user?.town  ? (
            <View style={styles.townBadge}>
              <Text style={styles.townBadgeText}>📍 {user.town}</Text>
            </View>
          ) : null}
        </View>

        {/* Menu Items */}
        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && styles.menuItemBorder,
              ]}
              onPress={() => item.screen && navigation.navigate(item.screen)}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconBox}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
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
        <Text style={styles.version}>Univerin v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Tab */}
      {isFocused && <View style={[styles.bottomTab, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={25} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart-outline" size={25} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('MyOrders')}>
          <Ionicons name="receipt-outline" size={25} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="person" size={25} color="#1669ef" />
          <Text style={styles.tabLabelActive}>Profile</Text>
        </TouchableOpacity>
      </View>}

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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center', marginLeft: 36 },
  bellBtn:     { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifBadge:     { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  bellIcon:    { fontSize: 22 },

  profileCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  avatarRow: {
    width: '100%', alignItems: 'center', marginBottom: 8, position: 'relative',
  },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1669ef', justifyContent: 'center', alignItems: 'center',
  },
  avatarImage: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: '#E0E7FF',
  },
  uploadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#fff', borderRadius: 12,
    width: 24, height: 24, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cameraIconText: { fontSize: 12 },
  avatarText:     { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  editIconBtn: {
    position: 'absolute', right: 0, top: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  editIcon:     { fontSize: 14 },
  tapPhotoHint: { fontSize: 11, color: '#9CA3AF', marginBottom: 8, textAlign: 'center' },
  userName:     { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4, textAlign: 'center' },
  userPhone:    { fontSize: 14, color: '#888', marginBottom: 2, textAlign: 'center' },
  userEmail:    { fontSize: 13, color: '#888', marginBottom: 6, textAlign: 'center' },
  townBadge: {
    backgroundColor: '#eff6ff', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 4,
  },
  townBadgeText: { fontSize: 12, color: '#1669ef', fontWeight: '500' },

  menuCard: {
    backgroundColor: '#fff', marginHorizontal: 16,
    borderRadius: 16, marginBottom: 12, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  menuLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  menuIcon:  { fontSize: 18 },
  menuLabel: { fontSize: 14, color: '#111', fontWeight: '500' },
  menuArrow: { fontSize: 20, color: '#9CA3AF' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#1669ef',
  },
  logoutText: { fontSize: 15, color: '#1669ef', fontWeight: '700' },
  version:    { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginBottom: 8 },

  bottomTab: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 24, paddingTop: 10,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  tabItem:        { flex: 1, alignItems: 'center' },
  tabIcon:        { fontSize: 22, marginBottom: 2, color: '#9CA3AF' },
  tabLabel:       { fontSize: 11, color: '#9CA3AF' },
  tabLabelActive: { fontSize: 11, color: '#1669ef', fontWeight: 'bold' },
});