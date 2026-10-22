import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import client from '../../api/client';
import * as Location from 'expo-location';

const LABELS = ['Home', 'Work', 'Other'];

export default function AddressScreen({ navigation, route }) {
  const [addresses, setAddresses]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalVisible, setModal]    = useState(false);
  const [editAddress, setEdit]      = useState(null);
  const [label, setLabel]           = useState('Home');
  const [fullAddress, setFullAddr]  = useState('');
  const [town, setTown]             = useState('');
  const [pincode, setPincode]       = useState('');
  const [state, setState]           = useState('Andhra Pradesh');
  const [saving, setSaving]         = useState(false);

  const [locating, setLocating] = useState(false);

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow location access');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const { latitude, longitude } = loc.coords;
      const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo && geo.length > 0) {
        const g = geo[0];
        const addr = [g.name, g.street, g.district, g.city, g.region].filter(Boolean).join(', ');
        setFullAddr(addr);
        setTown(g.city || g.district || g.region || '');
        setPincode(g.postalCode || '');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not get location. Please enter manually.');
    } finally {
      setLocating(false);
    }
  };



  // Get location from MapPicker
  useEffect(() => {
    if (route?.params?.selectedLocation) {
      const loc = route.params.selectedLocation;
      setFullAddr(loc.full_address);
      if (loc.town) setTown(loc.town);
      if (loc.pincode) setPincode(loc.pincode);
      // NOTE: do NOT reset editAddress here — if the user was editing an
      // existing address and used "pick on map" to refine the location,
      // this would wrongly clear the edit context and cause Save to
      // create a brand new address (POST) instead of updating (PATCH).
      setModal(true);
    }
  }, [route?.params?.selectedLocation]);

  const fetchAddresses = async () => {
    try {
      const res = await client.get('/users/addresses/');
      setAddresses(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.log('Error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchAddresses(); }, []));

  const openAdd = () => {
    setEdit(null);
    setLabel('Home');
    setFullAddr('');
    setTown('');
    setPincode('');
    setModal(true);
  };

  const openEdit = (addr) => {
    setEdit(addr);
    setLabel(addr.label);
    setFullAddr(addr.full_address);
    setTown(addr.town);
    setPincode(addr.pincode || '');
    setState(addr.state || 'Andhra Pradesh');
    setModal(true);
  };

  const handleSave = async () => {
    if (!fullAddress.trim()) { Alert.alert('Error', 'Please enter address'); return; }
    if (!town.trim())        { Alert.alert('Error', 'Please enter town'); return; }
    setSaving(true);
    try {
      if (editAddress) {
        await client.patch(`/users/addresses/${editAddress.id}/`, {
          label, full_address: fullAddress, town, pincode, state,
        });
      } else {
        await client.post('/users/addresses/', {
          label, full_address: fullAddress, town, pincode, state,
        });
      }
      setModal(false);
      fetchAddresses();
    } catch (e) {
      Alert.alert('Error', 'Could not save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addr) => {
    Alert.alert('Delete Address', `Delete "${addr.label}" address?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/users/addresses/${addr.id}/`);
            fetchAddresses();
          } catch (e) {
            Alert.alert('Error', 'Could not delete address');
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (addr) => {
    try {
      await client.post(`/users/addresses/${addr.id}/default/`);
      fetchAddresses();
    } catch (e) {
      Alert.alert('Error', 'Could not set default');
    }
  };

  const labelIcon = (l) => l === 'Home' ? '🏠' : l === 'Work' ? '💼' : '📍';

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Addresses</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1669ef" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>

          {addresses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📍</Text>
              <Text style={styles.emptyTitle}>No addresses saved</Text>
              <Text style={styles.emptySubtitle}>Add your delivery address</Text>
              <TouchableOpacity style={styles.addFirstBtn} onPress={openAdd}>
                <Text style={styles.addFirstBtnText}>+ Add Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            addresses.map(addr => (
              <View key={addr.id} style={[styles.addressCard, addr.is_default && styles.addressCardDefault]}>
                <View style={styles.cardTop}>
                  <View style={styles.labelRow}>
                    <Text style={styles.labelIcon}>{labelIcon(addr.label)}</Text>
                    <Text style={styles.labelText}>{addr.label}</Text>
                    {addr.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEdit(addr)} style={styles.editBtn}>
                      <Text style={styles.editBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(addr)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.addressText}>{addr.full_address}</Text>
                <Text style={styles.townText}>{addr.town}{addr.pincode ? ` - ${addr.pincode}` : ''}</Text>
                {!addr.is_default && (
                  <TouchableOpacity
                    style={styles.setDefaultBtn}
                    onPress={() => handleSetDefault(addr)}
                  >
                    <Text style={styles.setDefaultText}>Set as Default</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editAddress ? 'Edit Address' : 'Add New Address'}
              </Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Label Selector */}
            <Text style={styles.fieldLabel}>Label</Text>
            <View style={styles.labelSelector}>
              {LABELS.map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.labelChip, label === l && styles.labelChipActive]}
                  onPress={() => setLabel(l)}
                >
                  <Text style={[styles.labelChipText, label === l && styles.labelChipTextActive]}>
                    {labelIcon(l)} {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Location Buttons Row */}
            <View style={styles.locationRow}>
              <TouchableOpacity style={styles.locationBtn} onPress={() => navigation.navigate('MapPicker', {
                returnScreen: 'AddressScreen'
              })}>
                <Ionicons name="map-outline" size={18} color="#1669ef" />
                <Text style={styles.locationBtnText}>Pick from Map</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.locationBtn} onPress={useCurrentLocation} disabled={locating}>
                {locating
                  ? <ActivityIndicator size="small" color="#1669ef" />
                  : <Ionicons name="location-outline" size={18} color="#1669ef" />
                }
                <Text style={styles.locationBtnText}>{locating ? 'Detecting...' : 'Current Location'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Full Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="House no, Street, Area"
              placeholderTextColor="#9CA3AF"
              value={fullAddress}
              onChangeText={setFullAddr}
              multiline
              numberOfLines={3}
            />

            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Town</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Town"
                  placeholderTextColor="#9CA3AF"
                  value={town}
                  onChangeText={setTown}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Pincode</Text>
                <TextInput
                  style={styles.input}
                  placeholder="524001"
                  placeholderTextColor="#9CA3AF"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Andhra Pradesh"
                placeholderTextColor="#9CA3AF"
                value={state}
                onChangeText={setState}
              />
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>
                    {editAddress ? 'Save Changes' : 'Add Address'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>


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
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 24, color: '#111' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  addBtn: {
    backgroundColor: '#1669ef', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  addFirstBtn: {
    backgroundColor: '#1669ef', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  addFirstBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  addressCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  addressCardDefault: { borderWidth: 1.5, borderColor: '#1669ef' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelIcon: { fontSize: 18 },
  labelText: { fontSize: 14, fontWeight: 'bold', color: '#111' },
  defaultBadge: {
    backgroundColor: '#eff6ff', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  defaultBadgeText: { fontSize: 11, color: '#1669ef', fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8 },
  editBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  editBtnText: { fontSize: 14 },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14 },
  addressText: { fontSize: 14, color: '#111', lineHeight: 20, marginBottom: 4 },
  townText: { fontSize: 13, color: '#888', marginBottom: 10 },
  setDefaultBtn: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: '#1669ef',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
  },
  setDefaultText: { fontSize: 12, color: '#1669ef', fontWeight: '600' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  locationRow:     { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 12 },
  locationBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#1669ef', backgroundColor: '#EFF6FF' },
  locationBtnText: { fontSize: 14, fontWeight: '600', color: '#1669ef' },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#111' },
  modalClose: { fontSize: 20, color: '#9CA3AF' },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, fontSize: 14, color: '#111', backgroundColor: '#F9FAFB',
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },

  labelSelector: { flexDirection: 'row', gap: 8 },
  labelChip: {
    flex: 1, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, padding: 10, alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  labelChipActive: { borderColor: '#1669ef', backgroundColor: '#eff6ff' },
  labelChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  labelChipTextActive: { color: '#1669ef', fontWeight: 'bold' },

  saveBtn: {
    backgroundColor: '#1669ef', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});