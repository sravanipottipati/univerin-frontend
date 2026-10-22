import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, ScrollView, Platform
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { globalStore } from '../../utils/globalStore';
import { Ionicons } from '@expo/vector-icons';

const GOOGLE_API_KEY = 'AIzaSyCS_YRu6O61LCZn_QlypzjcjSdeRqbQaDI';

export default function MapPickerScreen({ navigation, route }) {
  const { onLocationSelected } = route.params || {};
  const mapRef = useRef(null);

  const [region, setRegion] = useState({
    latitude: 14.4426, longitude: 79.9865,
    latitudeDelta: 0.01, longitudeDelta: 0.01,
  });
  const [marker, setMarker]       = useState(null);
  const [address, setAddress]     = useState('');
  const [houseNo, setHouseNo]     = useState('');
  const [landmark, setLandmark]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [locating, setLocating]   = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching]   = useState(false);

  useEffect(() => { getCurrentLocation(); }, []);

  const getCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const newRegion = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(newRegion);
      setMarker({ latitude, longitude });
      mapRef.current?.animateToRegion(newRegion, 500);
      await reverseGeocode(latitude, longitude);
    } catch (e) {
      Alert.alert('Error', 'Could not get location');
    } finally { setLocating(false); }
  };

  const reverseGeocode = async (lat, lng) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`
      );
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setAddress(data.results[0].formatted_address);
      }
    } catch (e) {
    } finally { setLoading(false); }
  };

  const handleSearchAddress = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchText)}&key=${GOOGLE_API_KEY}`
      );
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        const newRegion = { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setRegion(newRegion);
        setMarker({ latitude: lat, longitude: lng });
        mapRef.current?.animateToRegion(newRegion, 500);
        setAddress(data.results[0].formatted_address);
      } else {
        Alert.alert('Not Found', 'Could not find that location. Try a different search.');
      }
    } catch (e) {
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally { setSearching(false); }
  };

  const handleMapPress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarker({ latitude, longitude });
    await reverseGeocode(latitude, longitude);
  };

  const handleConfirm = async () => {
    if (!marker) { Alert.alert('Error', 'Please select a location on map first'); return; }
    const { isHomeScreen } = route.params || {};
    if (isHomeScreen) {
      globalStore.homeLocation = {
        lat: marker.latitude,
        lng: marker.longitude,
        address: address,
      };
      navigation.goBack();
      return;
    }
    const { isCheckout } = route.params || {};
    if (isCheckout) {
      globalStore.checkoutAddress = address;
      globalStore.checkoutCoords = { lat: marker.latitude, lng: marker.longitude };
      navigation.goBack();
      return;
    }
    const { isTownSelection } = route.params || {};
    if (isTownSelection) {
      const townGuess = address.split(',').slice(-3, -2)[0]?.trim() || address.split(',')[0]?.trim() || '';
      globalStore.townSelectionLocation = {
        lat: marker.latitude,
        lng: marker.longitude,
        address: address,
        town: townGuess,
      };
      navigation.goBack();
      return;
    }
    if (!houseNo.trim()) { Alert.alert('Error', 'Please enter house/flat number'); return; }
    const fullAddress = `${houseNo}${landmark ? ', ' + landmark : ''}, ${address}`;
    navigation.navigate('Address', {
      selectedLocation: {
        lat: marker.latitude,
        lng: marker.longitude,
        full_address: fullAddress,
        town: address.split(',').slice(-3, -2)[0]?.trim() || '',
        pincode: address.match(/\d{6}/)?.[0] || '',
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Location</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {marker && <Marker coordinate={marker} />}
      </MapView>

      {/* Search Bar */}
      <View style={styles.searchBarWrapper}>
        <TouchableOpacity onPress={handleSearchAddress} disabled={searching}>
          <Ionicons name="search-outline" size={22} color="#1669ef" />
        </TouchableOpacity>
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search for area, street name..."
          placeholderTextColor="#9CA3AF"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearchAddress}
          returnKeyType="search"
        />
        {searching ? (
          <ActivityIndicator size="small" color="#1669ef" />
        ) : searchText.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Current Location Button */}
      <TouchableOpacity style={styles.locationBtn} onPress={getCurrentLocation} disabled={locating}>
        {locating
          ? <ActivityIndicator size="small" color="#1669ef" />
          : <Ionicons name="locate" size={22} color="#1669ef" />
        }
      </TouchableOpacity>

      {/* Address Card */}
      <ScrollView style={styles.card} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps='handled'>
        {loading
          ? <ActivityIndicator size="small" color="#1669ef" style={{ marginBottom: 8 }} />
          : <Text style={styles.addressText} numberOfLines={2}>{address || 'Tap on map to select location'}</Text>
        }
        {!route.params?.isHomeScreen && !route.params?.isCheckout && !route.params?.isTownSelection && (
          <>
            <TextInput
              style={styles.input}
              placeholder="House / Flat / Floor No *"
              placeholderTextColor="#9CA3AF"
              value={houseNo}
              onChangeText={setHouseNo}
            />
            <TextInput
              style={styles.input}
              placeholder="Landmark (optional)"
              placeholderTextColor="#9CA3AF"
              value={landmark}
              onChangeText={setLandmark}
            />
          </>
        )}
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmBtnText}>{route.params?.isHomeScreen ? 'Set Location' : route.params?.isCheckout ? 'Use This Address' : route.params?.isTownSelection ? 'Confirm This Location' : 'Confirm Location'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#fff' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn:      { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  map:          { position: 'absolute', top: 90, left: 0, right: 0, bottom: 0 },
  locationBtn:  { position: 'absolute', right: 16, top: 170, backgroundColor: '#fff', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  searchBarWrapper: {
    position: 'absolute', top: 102, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
  },
  searchBarInput: { flex: 1, fontSize: 14, color: '#111' },
  card:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, paddingBottom: 34, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  addressText:  { fontSize: 14, color: '#111', marginBottom: 12, fontWeight: '500' },
  input:        { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 14, color: '#111', marginBottom: 10 },
  confirmBtn:   { backgroundColor: '#1669ef', borderRadius: 12, padding: 16, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
