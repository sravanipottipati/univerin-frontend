import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import { DP_LOCATION_TASK } from '../../tasks/locationTask';

export default function DPHomeScreen({ navigation }) {
  const { logout } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [activeOrder, setActiveOrder] = useState(null);
  const [availableOrderCount, setAvailableOrderCount] = useState(0);

  useEffect(() => {
    (async () => {
      const running = await TaskManager.isTaskRegisteredAsync(DP_LOCATION_TASK);
      setIsOnline(running);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          const res = await client.get('/dp/orders/active/', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setActiveOrder(res.data);
        } catch (e) {
          setActiveOrder(null);
        }
      })();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let fetching = false;

      const checkAvailableOrders = async () => {
        if (!active || fetching || !isOnline || AppState.currentState !== 'active') return;

        fetching = true;
        try {
          const res = await client.get('/dp/orders/available/');
          if (active) {
            setAvailableOrderCount(Array.isArray(res.data) ? res.data.length : 0);
          }
        } catch (error) {
          console.warn('Could not refresh DP offers:', error.message);
        } finally {
          fetching = false;
        }
      };

      if (isOnline) checkAvailableOrders();
      else setAvailableOrderCount(0);

      const interval = setInterval(checkAvailableOrders, 10000);
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') checkAvailableOrders();
      });

      return () => {
        active = false;
        clearInterval(interval);
        subscription.remove();
      };
    }, [isOnline])
  );

  // DP foreground GPS heartbeat: keep stationary online partners eligible.
  useFocusEffect(
    useCallback(() => {
      if (!isOnline) return undefined;

      let active = true;
      let updating = false;

      const refreshLocation = async () => {
        if (!active || updating || AppState.currentState !== 'active') return;

        updating = true;
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          if (!active || permission.status !== 'granted') return;

          const cachedPosition = await Location.getLastKnownPositionAsync({
            maxAge: 60000,
            requiredAccuracy: 100,
          });

          const position = cachedPosition || await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          if (!active || AppState.currentState !== 'active') return;

          await client.post('/dp/location/update/', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } catch (error) {
          console.warn('DP foreground GPS heartbeat failed:', error.message);
        } finally {
          updating = false;
        }
      };

      refreshLocation();

      const interval = setInterval(refreshLocation, 90000);
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') refreshLocation();
      });

      return () => {
        active = false;
        clearInterval(interval);
        subscription.remove();
      };
    }, [isOnline])
  );

  const startLocationTracking = async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      Alert.alert('Permission needed', 'Location access is required to go online');
      return false;
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      Alert.alert(
        'Background location needed',
        'Please allow "Always" location access in your device settings so we can match you with nearby orders even when the app is in the background.'
      );
      return false;
    }

    await Location.startLocationUpdatesAsync(DP_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15000, // every 15 seconds
      distanceInterval: 30, // or every 30 meters, whichever comes first
      foregroundService: {
        notificationTitle: 'Univerin — You are Online',
        notificationBody: 'Sharing your location to receive delivery orders',
      },
      showsBackgroundLocationIndicator: true,
    });
    return true;
  };

  const stopLocationTracking = async () => {
    const running = await TaskManager.isTaskRegisteredAsync(DP_LOCATION_TASK);
    if (running) {
      await Location.stopLocationUpdatesAsync(DP_LOCATION_TASK);
    }
  };

  const handleToggle = async (value) => {
    setToggling(true);
    try {
      if (value) {
        const started = await startLocationTracking();
        if (!started) {
          setToggling(false);
          return; // permission denied, don't flip the switch or call backend
        }
      }

      const token = await AsyncStorage.getItem('access_token');

      // Send a fresh GPS position before going online.
      if (value) {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        await client.post(
          '/dp/location/update/',
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      await client.post(
        '/dp/duty/toggle/',
        { is_online: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsOnline(value);

      // Stop tracking only after the backend confirms Offline.
      if (!value) {
        try {
          await stopLocationTracking();
        } catch (stopError) {
          console.warn('Offline confirmed, but GPS tracking could not stop:', stopError.message);
        }
      }
    } catch (e) {
      if (value) {
        try {
          await stopLocationTracking();
        } catch (stopError) {
          console.warn('Could not stop GPS tracking:', stopError.message);
        }
      }
      console.warn('Delivery partner status update failed:', e.message);
      Alert.alert('Error', 'Failed to update status. Please try again.');
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await stopLocationTracking();
          } catch (error) {
            console.warn('Could not stop location tracking during logout:', error);
          }
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          await logout();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Univerin</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => navigation.navigate('DPNotifications')}>
            <Ionicons name="notifications-outline" size={26} color="#1669ef" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('DPProfile')}>
            <Ionicons name="person-circle-outline" size={30} color="#1669ef" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusLabel}>{isOnline ? 'You are Online' : 'You are Offline'}</Text>
          <Text style={styles.statusSubtext}>
            {isOnline ? 'Sharing location — ready for orders' : 'Turn on to start receiving orders'}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={handleToggle}
          disabled={toggling}
          trackColor={{ false: '#D1D5DB', true: '#86efac' }}
          thumbColor={isOnline ? '#16a34a' : '#f4f3f4'}
        />
      </View>

      {activeOrder && (
        <TouchableOpacity
          style={styles.resumeBanner}
          onPress={() => navigation.navigate('DPActiveOrder', { orderId: activeOrder.id })}
        >
          <Ionicons name="time-outline" size={20} color="#92400E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.resumeTitle}>Order in progress</Text>
            <Text style={styles.resumeSubtext}>Order #{activeOrder.order_number} — tap to resume</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#92400E" />
        </TouchableOpacity>
      )}

      <View style={styles.placeholderArea}>
        <Ionicons name="bicycle-outline" size={48} color="#D1D5DB" />
        <Text style={styles.placeholderText}>
          {isOnline ? 'Waiting for orders...' : 'Go online to start receiving orders'}
        </Text>
        {isOnline && (
          <TouchableOpacity
            style={styles.checkOrdersBtn}
            onPress={() => navigation.navigate('DPOrderOffer')}
          >
            <Text style={styles.checkOrdersText}>
              {availableOrderCount > 0
                ? `Incoming Orders (${availableOrderCount})`
                : 'Check for Orders'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  dotOnline: { backgroundColor: '#16a34a' },
  dotOffline: { backgroundColor: '#9CA3AF' },
  statusLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statusSubtext: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  placeholderArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  placeholderText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },
  logoutBtn: {
    borderWidth: 1, borderColor: '#1669ef', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center', marginBottom: 20,
  },
  logoutText: { color: '#1669ef', fontSize: 15, fontWeight: '700' },
  checkOrdersBtn: {
    backgroundColor: '#1669ef', borderRadius: 10, paddingHorizontal: 24,
    paddingVertical: 12, marginTop: 16,
  },
  checkOrdersText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resumeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, marginTop: 12,
  },
  resumeTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  resumeSubtext: { fontSize: 12, color: '#92400E', marginTop: 2 },
});