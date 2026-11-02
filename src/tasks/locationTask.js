import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

export const DP_LOCATION_TASK = 'dp-background-location-task';

TaskManager.defineTask(DP_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.log('[DP Location Task] Error:', error.message);
    return;
  }
  if (data) {
    const { locations } = data;
    const latest = Array.isArray(locations)
      ? locations.reduce(
          (newest, location) =>
            !newest || location.timestamp > newest.timestamp
              ? location
              : newest,
          null
        )
      : null;
    if (!latest) return;

    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return; // not logged in, skip silently

      await client.post(
        '/dp/location/update/',
        {
          latitude: latest.coords.latitude,
          longitude: latest.coords.longitude,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('[DP Location Task] Sent:', latest.coords.latitude, latest.coords.longitude);
    } catch (e) {
      console.log('[DP Location Task] Failed to send location:', e.message);
    }
  }
});