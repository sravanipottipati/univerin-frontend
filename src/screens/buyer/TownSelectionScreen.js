import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { globalStore } from '../../utils/globalStore';

export default function TownSelectionScreen({ navigation }) {
  const [detecting, setDetecting]     = useState(false);
  const [detected, setDetected]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const { user, setUser }             = useAuth();

  useEffect(() => { detectLocation(); }, []);

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const enabled = await Location.hasServicesEnabledAsync();

      if (!enabled) {
        Alert.alert(
          'Turn On Location',
          'Please enable location services in your phone settings, then tap Re-detect My Location.'
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDetecting(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const town = place.city || place.subregion || place.region || '';
        const addressParts = [place.name, place.street, place.city, place.region].filter(Boolean);
        const address = addressParts.join(', ') || (latitude + ', ' + longitude);
        setDetected({ lat: latitude, lng: longitude, address, town, source: 'gps' });
      }
    } catch (e) {
      console.log('Location detection error:', e.message);
    } finally {
      setDetecting(false);
    }
  };

  const openMapPicker = () => {
    navigation.navigate('MapPicker', {
      isHomeScreen: false,
      isCheckout: false,
      isTownSelection: true,
    });
  };

  useEffect(() => {
    const checkPickedLocation = () => {
      if (globalStore.townSelectionLocation) {
        const loc = globalStore.townSelectionLocation;
        globalStore.townSelectionLocation = null;
        setDetected({ lat: loc.lat, lng: loc.lng, address: loc.address, town: loc.town || '', source: 'manual' });
      }
    };
    const unsubscribe = navigation.addListener('focus', checkPickedLocation);
    return unsubscribe;
  }, [navigation]);

  const handleConfirm = async () => {
    if (!detected) {
      Alert.alert('Location Required', 'Please allow location access or pick your location on the map.');
      return;
    }
    setLoading(true);
    try {
      const town = detected.town || 'Unknown';
      await client.patch('/users/profile/', { town });
      const updatedUser = { ...user, town };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      globalStore.homeLocation = {
        lat: detected.lat,
        lng: detected.lng,
        address: detected.address,
        source: detected.source || 'manual',
      };
      globalStore.hasCustomLocation = detected.source === 'manual';
      globalStore.lastPickedLocation = {
        lat: detected.lat,
        lng: detected.lng,
        address: detected.address,
        source: detected.source || 'manual',
      };
      await AsyncStorage.setItem(
        'lastPickedLocation',
        JSON.stringify(globalStore.lastPickedLocation)
      );
      navigation.replace('Home');
    } catch (e) {
      console.log('Town update error:', e.message);
      const town = detected.town || 'Unknown';
      const updatedUser = { ...user, town };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      globalStore.homeLocation = {
        lat: detected.lat,
        lng: detected.lng,
        address: detected.address,
        source: detected.source || 'manual',
      };
      globalStore.hasCustomLocation = detected.source === 'manual';
      globalStore.lastPickedLocation = {
        lat: detected.lat,
        lng: detected.lng,
        address: detected.address,
        source: detected.source || 'manual',
      };
      await AsyncStorage.setItem(
        'lastPickedLocation',
        JSON.stringify(globalStore.lastPickedLocation)
      );
      navigation.replace('Home');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📍</Text>
        <Text style={styles.headerTitle}>Set Your Location</Text>
        <Text style={styles.headerSubtitle}>
          We will find shops near your exact location for the most accurate delivery
        </Text>
      </View>

      <View style={styles.content}>
        {detecting ? (
          <View style={styles.detectingBox}>
            <ActivityIndicator size="large" color="#1669ef" />
            <Text style={styles.detectingText}>Detecting your location...</Text>
          </View>
        ) : detected ? (
          <View style={styles.detectedBox}>
            <Ionicons name="location" size={32} color="#16A34A" />
            <Text style={styles.detectedTitle}>Location Found</Text>
            <Text style={styles.detectedAddress}>{detected.address}</Text>
          </View>
        ) : (
          <View style={styles.detectingBox}>
            <Ionicons name="location-outline" size={40} color="#9CA3AF" />
            <Text style={styles.detectingText}>Location access needed</Text>
          </View>
        )}

        <TouchableOpacity style={styles.secondaryBtn} onPress={detectLocation} disabled={detecting}>
          <Ionicons name="refresh" size={16} color="#1669ef" />
          <Text style={styles.secondaryBtnText}>Re-detect My Location</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={openMapPicker}>
          <Ionicons name="map-outline" size={16} color="#1669ef" />
          <Text style={styles.secondaryBtnText}>Pick Exact Location on Map</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !detected && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={loading || !detected}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.confirmBtnText}>{detected ? 'Confirm This Location' : 'Detect location to continue'}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    alignItems: 'center', paddingTop: 60,
    paddingBottom: 24, paddingHorizontal: 24,
    backgroundColor: '#eff6ff',
  },
  headerEmoji:    { fontSize: 48, marginBottom: 12 },
  headerTitle:    { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  detectingBox: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 16, padding: 32,
    borderWidth: 1.5, borderColor: '#F3F4F6', marginBottom: 16,
  },
  detectingText: { fontSize: 14, color: '#888', marginTop: 12, fontWeight: '500' },
  detectedBox: {
    alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 16,
    padding: 24, borderWidth: 1.5, borderColor: '#BBF7D0', marginBottom: 16,
  },
  detectedTitle:   { fontSize: 16, fontWeight: '700', color: '#16A34A', marginTop: 8, marginBottom: 6 },
  detectedAddress: { fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 19 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#BFDBFE', marginBottom: 12,
  },
  secondaryBtnText: { fontSize: 14, color: '#1669ef', fontWeight: '600' },
  footer: {
    padding: 16, paddingBottom: 36,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  confirmBtn: {
    backgroundColor: '#1669ef', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#93c5fd' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
