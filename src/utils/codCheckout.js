import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const codStorageKey = (buyerId) =>
  `univerin_pending_cod_${buyerId}`;

const canonicalPayload = (payload) => ({
  vendor_id: String(payload.vendor_id).toLowerCase(),
  payment_mode: 'cod',
  delivery_address: payload.delivery_address,
  delivery_latitude: payload.delivery_latitude,
  delivery_longitude: payload.delivery_longitude,
  instructions: payload.instructions || '',
  items: payload.items.map(item => ({
    product_id: String(item.product_id).toLowerCase(),
    variant_id: item.variant_id
      ? String(item.variant_id).toLowerCase()
      : null,
    quantity: Number(item.quantity),
  })).sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  ),
});

export const getPendingCodCheckout = async (buyerId) => {
  if (!buyerId) {
    throw new Error('Buyer account information is unavailable.');
  }

  const saved = await AsyncStorage.getItem(codStorageKey(buyerId));
  if (!saved) return null;

  let pending;
  try {
    pending = JSON.parse(saved);
  } catch {
    throw new Error(
      'Saved COD checkout information could not be read. Please contact support before placing another order.'
    );
  }

  if (
    !pending ||
    typeof pending.client_request_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pending.client_request_id
    ) ||
    !pending.payload ||
    typeof pending.payload !== 'object' ||
    Array.isArray(pending.payload) ||
    pending.payload.payment_mode !== 'cod' ||
    pending.payload.client_request_id !== pending.client_request_id ||
    typeof pending.intent !== 'string'
  ) {
    throw new Error(
      'Saved COD checkout information needs review. Please contact support before placing another order.'
    );
  }

  return pending;
};

export const prepareCodCheckout = async (buyerId, payload) => {
  if (!buyerId) {
    throw new Error('Buyer account information is unavailable.');
  }

  const key = codStorageKey(buyerId);
  const intent = JSON.stringify(canonicalPayload(payload));
  const saved = await AsyncStorage.getItem(key);

  if (saved) {
    let pending;
    try {
      pending = JSON.parse(saved);
    } catch {
      throw new Error(
        'A previous COD checkout could not be read. Please contact support before placing another order.'
      );
    }

    if (
      !pending ||
      typeof pending.client_request_id !== 'string' ||
      !pending.payload ||
      typeof pending.intent !== 'string'
    ) {
      throw new Error(
        'A previous COD checkout needs review before another order can be placed.'
      );
    }

    if (pending.intent !== intent) {
      throw new Error(
        'A previous COD checkout may already have succeeded. Restore the original checkout or check your orders before changing it.'
      );
    }

    return pending;
  }

  const pending = {
    client_request_id: Crypto.randomUUID(),
    intent,
    payload: {
      ...payload,
      client_request_id: null,
    },
    saved_at: new Date().toISOString(),
  };

  pending.payload.client_request_id = pending.client_request_id;

  await AsyncStorage.setItem(key, JSON.stringify(pending));
  return pending;
};

export const checkCodCheckoutStatus = async (
  buyerId,
  client
) => {
  const pending = await getPendingCodCheckout(buyerId);

  if (!pending) {
    return { status: 'none', pending: null, order: null };
  }

  try {
    const response = await client.get(
      '/orders/cod/checkout-status/',
      {
        params: {
          client_request_id: pending.client_request_id,
        },
      }
    );

    if (
      response.status !== 200 ||
      response.data?.found !== true ||
      !response.data?.order?.id
    ) {
      throw new Error(
        'COD checkout status response was incomplete.'
      );
    }

    return {
      status: 'confirmed',
      pending,
      order: response.data.order,
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return {
        status: 'not_found',
        pending,
        order: null,
      };
    }

    throw error;
  }
};

export const clearCodCheckout = async (buyerId, requestId) => {
  const key = codStorageKey(buyerId);
  const saved = await AsyncStorage.getItem(key);

  if (!saved) return;

  const pending = JSON.parse(saved);
  if (pending.client_request_id !== requestId) {
    throw new Error('Pending COD request changed; cleanup cancelled.');
  }

  await AsyncStorage.removeItem(key);
};
