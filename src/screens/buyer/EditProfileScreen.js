import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';

export default function EditProfileScreen({ navigation }) {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail]       = useState(user?.email || '');
  const [loading, setLoading]   = useState(false);

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    setLoading(true);
    try {
      await client.patch('/users/profile/', { full_name: fullName, email });
      const updatedUser = { ...user, full_name: fullName, email };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.log('EDIT PROFILE ERROR:', e.message, 'STATUS:', e.response?.status, 'DATA:', JSON.stringify(e.response?.data));
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.avatarName}>{fullName || 'Your Name'}</Text>
          <Text style={styles.avatarPhone}>+91 {user?.phone_number}</Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.fieldLabel}>Phone Number</Text>
          <View style={styles.inputDisabled}>
            <Text style={styles.inputDisabledText}>+91 {user?.phone_number}</Text>
            <Text style={styles.lockedIcon}>🔒</Text>
          </View>
          <Text style={styles.fieldHint}>Phone number cannot be changed</Text>

          <Text style={styles.fieldLabel}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email (optional)"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Town</Text>
          <TouchableOpacity
            style={styles.townBtn}
            onPress={() => navigation.navigate('TownSelection')}
          >
            <Text style={styles.townBtnText}>
              📍 {user?.town || 'Select your town'}
            </Text>
            <Text style={styles.townBtnArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
      {/* Bottom Tab */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: 20, paddingTop: 10 }}>
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
    </KeyboardAvoidingView>
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
  avatarSection: {
    alignItems: 'center', paddingVertical: 28,
    backgroundColor: '#fff', marginBottom: 16,
  },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#1669ef', justifyContent: 'center',
    alignItems: 'center', marginBottom: 10,
  },
  avatarText:  { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  avatarName:  { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  avatarPhone: { fontSize: 13, color: '#888' },
  formCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, padding: 16, marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: '#555',
    marginBottom: 8, marginTop: 14,
  },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, fontSize: 14, color: '#111', backgroundColor: '#F9FAFB',
  },
  inputDisabled: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, backgroundColor: '#F3F4F6',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  inputDisabledText: { fontSize: 14, color: '#9CA3AF' },
  lockedIcon:  { fontSize: 14 },
  fieldHint:   { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  townBtn: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, backgroundColor: '#F9FAFB',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  townBtnText:  { fontSize: 14, color: '#111' },
  townBtnArrow: { fontSize: 18, color: '#888' },
  saveBtn: {
    backgroundColor: '#1669ef', borderRadius: 14,
    marginHorizontal: 16, padding: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
