import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../../api/client';
import { useCart } from '../../context/CartContext';
import { globalStore } from '../../utils/globalStore';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import {
  prepareCodCheckout,
  checkCodCheckoutStatus,
  clearCodCheckout,
} from '../../utils/codCheckout';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 10) / 10;
};

const getDeliveryInfo = (distanceKm, subtotal, mov) => {
  const distanceUnknown = distanceKm === null || distanceKm === undefined || isNaN(parseFloat(distanceKm));
  const dist = parseFloat(distanceKm) || 0;
  const minOrderValue = parseFloat(mov) || 0;
  let fee = 0, slab = '', outOfRange = false;
  if (distanceUnknown) {
    // Don't assume safe distance when we genuinely don't know it yet
    slab = 'calculating'; outOfRange = false;
  } else if (dist <= 2)      { fee = 25; slab = '0-2 km'; }
  else if (dist <= 4) { fee = 35; slab = '2-4 km'; }
  else if (dist <= 6) { fee = 45; slab = '4-6 km'; }
  else                { fee = 0; slab = '>6 km'; outOfRange = true; }
  const isFree = !outOfRange && minOrderValue > 0 && subtotal >= minOrderValue;
  if (isFree) fee = 0;
  const amountLeft = minOrderValue > 0 ? Math.max(0, minOrderValue - subtotal) : 0;
  return { fee, slab, outOfRange, distanceUnknown, deliveryFee: fee, isFree, amountLeft, mov: minOrderValue };
};

export default function CheckoutScreen({ navigation, route }) {
  const { cart, products, shop, distance } = route.params;
  const { clearShopCart } = useCart();
  const { user } = useAuth();

  const [address, setAddress]           = useState('');
  const [calcDistance, setCalcDistance] = useState(null);
  const [note, setNote]                 = useState('');
  const [loading, setLoading]           = useState(false);
  const [locatingCurrent, setLocatingCurrent] = useState(false);
  const [payment, setPayment]           = useState('cod');
  const [addresses, setAddresses]       = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const locationRequestId = useRef(0);
  const geocodeTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, []);

  const setDeliveryLocation = (newAddress, coords = null) => {
    if (geocodeTimer.current) {
      clearTimeout(geocodeTimer.current);
      geocodeTimer.current = null;
    }
    locationRequestId.current += 1;
    setAddress(newAddress);
    setDeliveryCoords(coords);
    setCalcDistance(null);
    setSelectedAddr(null);
    globalStore.checkoutAddress = null;
    globalStore.checkoutCoords = null;
    if (coords && shop?.latitude && shop?.longitude) {
      setCalcDistance(calculateDistance(
        coords.lat, coords.lng,
        Number(shop.latitude), Number(shop.longitude)
      ));
    }
  };
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayData, setRazorpayData] = useState(null);
  const [placedOrder, setPlacedOrder]   = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);
  const confirmingPaymentRef = useRef(false);
  const processingRazorpayCallbackRef = useRef(false);
  const placingOrderRef = useRef(false);
  const codRecoveryInProgressRef = useRef(false);
  const pendingPaymentStorageKey = user?.id
    ? `univerin_pending_payment_${user.id}`
    : null;

  // Automatic COD checkout recovery
  useFocusEffect(useCallback(() => {
    if (!user?.id || codRecoveryInProgressRef.current) {
      return undefined;
    }

    let active = true;

    const recoverCodCheckout = async () => {
      codRecoveryInProgressRef.current = true;
      setLoading(true);

      try {
        const result = await checkCodCheckoutStatus(user.id, client);

        if (!active || result.status === 'none') return;

        let order = result.order;

        // If no order exists yet, safely retry the original request.
        // The original UUID prevents duplicate orders.
        if (result.status === 'not_found') {
          const response = await client.post(
            '/orders/place/',
            result.pending.payload
          );

          order = response.data?.order;
        }

        if (!order?.id) {
          throw new Error('COD recovery did not return a confirmed order.');
        }

        if (!active) return;

        try {
          await clearCodCheckout(
            user.id,
            result.pending.client_request_id
          );
        } catch (storageError) {
          console.log('COD recovery cleanup failed:', storageError.message);
        }

        try {
          await clearShopCart(
            result.pending.payload.vendor_id
          );
        } catch (cartError) {
          console.log('Recovered COD order: cart cleanup failed:', cartError.message);
        }

        if (!active) return;

        navigation.replace('OrderSuccess', {
          order,
          calculatedTotal: Number(order.total_amount),
        });

      } catch (error) {
        console.log(
          'COD recovery failed:',
          error.response?.status,
          error.response?.data || error.message
        );

        if (active) {
          Alert.alert(
            'COD Order Recovery Pending',
            'We could not verify your previous order. Your saved checkout has been preserved. Please check again before placing another order.'
          );
        }
      } finally {
        codRecoveryInProgressRef.current = false;

        if (active) {
          setLoading(false);
        }
      }
    };

    recoverCodCheckout();

    return () => {
      active = false;
    };
  }, [user?.id, clearShopCart, navigation]));





  const savePendingPayment = async (paymentData, orderData) => {
    if (!pendingPaymentStorageKey) {
      throw new Error('Buyer account information is unavailable.');
    }

    const pending = {
      razorpay_order_id: paymentData.razorpay_order_id,
      razorpay_payment_id: paymentData.razorpay_payment_id,
      razorpay_signature: paymentData.razorpay_signature,
      order_data: orderData,
      saved_at: new Date().toISOString(),
    };

    // Keep an in-memory recovery copy even if device storage fails.
    setPendingPayment(pending);

    await AsyncStorage.setItem(
      pendingPaymentStorageKey,
      JSON.stringify(pending)
    );

    return pending;
  };

  const recoverPendingPayment = async (pending, fromConfirmation = false) => {
    if (confirmingPaymentRef.current && !fromConfirmation) return;

    if (!pending?.razorpay_order_id) {
      Alert.alert(
        'Payment Recovery Unavailable',
        'The saved checkout reference is missing. Please contact support before paying again.'
      );
      return;
    }

    if (!fromConfirmation) {
      confirmingPaymentRef.current = true;
    }
    setLoading(true);

    try {
      const res = await client.post(
        '/orders/payment/recover-checkout/',
        { razorpay_order_id: pending.razorpay_order_id }
      );

      if (!res.data?.order) {
        throw new Error('Recovery response does not contain an order.');
      }

      if (pendingPaymentStorageKey) {
        try {
          await AsyncStorage.removeItem(pendingPaymentStorageKey);
        } catch (storageError) {
          console.log('Recovery cleanup failed:', storageError.message);
        }
      }

      setPendingPayment(null);
      setShowRazorpay(false);
      clearShopCart(pending.order_data?.vendor_id || pending.vendor_id);

      navigation.replace('OrderSuccess', {
        order: res.data.order,
        calculatedTotal: Number(res.data.order.total_amount),
      });
    } catch (error) {
      console.log(
        'Payment recovery unsuccessful:',
        error.response?.status,
        error.response?.data || error.message
      );

      Alert.alert(
        'Payment Status Not Yet Resolved',
        'We could not safely confirm your previous payment. Please do not pay again. Your checkout information has been preserved. Try checking again later or contact support.'
      );
    } finally {
      if (!fromConfirmation) {
        confirmingPaymentRef.current = false;
      }
      setLoading(false);
    }
  };

  const confirmPendingPayment = async (pending) => {
    if (confirmingPaymentRef.current) return;
    confirmingPaymentRef.current = true;

    try {
      const res = await client.post(
        '/orders/payment/place-after-payment/',
        {
          razorpay_order_id: pending.razorpay_order_id,
          razorpay_payment_id: pending.razorpay_payment_id,
          razorpay_signature: pending.razorpay_signature,
          order_data: pending.order_data,
        }
      );

      if (!res.data?.order) {
        throw new Error('Order confirmation response is incomplete.');
      }

      // Django has confirmed the order. Storage cleanup must not
      // turn a successful order into a reported payment failure.
      if (pendingPaymentStorageKey) {
        try {
          await AsyncStorage.removeItem(pendingPaymentStorageKey);
        } catch (storageError) {
          console.log(
            'Confirmed order: pending payment cleanup failed:',
            storageError.message
          );
          // Keep the saved record for a safe idempotent retry later.
        }
      }

      setPendingPayment(null);
      setShowRazorpay(false);
      clearShopCart(pending.order_data.vendor_id);

      navigation.replace('OrderSuccess', {
        order: res.data.order,
        calculatedTotal: Number(res.data.order.total_amount),
      });
    } catch (error) {
      console.log('Order confirmation failed:', error.message);
      setShowRazorpay(false);

      // Keep the shared guard throughout both confirmation attempts.
      await recoverPendingPayment(pending, true);
    } finally {
      confirmingPaymentRef.current = false;
    }
  };

  useEffect(() => {
    if (!pendingPaymentStorageKey) return;

    let active = true;

    const restorePendingPayment = async () => {
      try {
        const saved = await AsyncStorage.getItem(pendingPaymentStorageKey);
        if (!active || !saved) return;

        const pending = JSON.parse(saved);

        const awaitingResult =
          pending?.status === 'awaiting_payment_result' &&
          typeof pending.razorpay_order_id === 'string' &&
          pending.razorpay_order_id.length > 0;

        const awaitingConfirmation =
          pending?.razorpay_order_id &&
          pending?.razorpay_payment_id &&
          pending?.razorpay_signature &&
          pending?.order_data;

        if (awaitingResult || awaitingConfirmation) {
          setPendingPayment(pending);
        } else {
          Alert.alert(
            'Payment Recovery Required',
            'Saved payment information is incomplete. Please contact support before making another payment.'
          );
        }
      } catch (error) {
        console.log('Unable to restore pending payment:', error.message);
        Alert.alert(
          'Payment Recovery Unavailable',
          'Unable to check for a previous payment. Please do not make another payment until your payment status is confirmed.'
        );
      }
    };

    restorePendingPayment();

    return () => {
      active = false;
    };
  }, [pendingPaymentStorageKey]);

  const shopHasGST = !!(shop?.gstin && shop.gstin.trim());
  const cartItems = products.filter(p => cart[p.id] > 0).map(p => {
    const qty = cart[p.id];
    const price = parseFloat(p.price) || 0;
    const gstRate = parseFloat(p.gst_percentage) || 0;
    const pricingMode = p.gst_pricing_mode || 'exclusive';

    const baseTotal = Math.round(price * qty * 100) / 100;
    const total = shopHasGST && pricingMode !== 'inclusive'
      ? Math.round(baseTotal * (1 + gstRate / 100) * 100) / 100
      : baseTotal;

    return { ...p, qty, total };
  });

  const subtotal      = cartItems.reduce((sum, item) => sum + item.total, 0);
  const totalMrp      = cartItems.reduce((sum, item) => {
    const mrp = parseFloat(item.mrp) || 0;
    const price = parseFloat(item.price) || 0;
    return sum + (mrp > price ? mrp * item.qty : price * item.qty);
  }, 0);
  const totalSavings  = Math.round(totalMrp - subtotal);
  const deliveryInfo  = getDeliveryInfo(calcDistance, subtotal, shop?.min_order_value);
  const platformFee   = 10;
  const platformFeeGST = parseFloat((platformFee * 1.18).toFixed(1));
  const deliveryFeeGST = deliveryInfo.deliveryFee;
  const total          = Math.round(subtotal + deliveryFeeGST + platformFeeGST);

  useFocusEffect(useCallback(() => {
    if (globalStore.checkoutAddress) {
      const selectedAddress = globalStore.checkoutAddress;
      const coords = globalStore.checkoutCoords;
      setDeliveryLocation(selectedAddress, coords || null);
      if (coords && shop?.latitude && shop?.longitude) {
        const dist = calculateDistance(
          coords.lat, coords.lng,
          parseFloat(shop.latitude), parseFloat(shop.longitude)
        );
        setCalcDistance(dist);
      }
      // Keep map-selected location available when returning to checkout.
      return;
    }
    // Refresh saved addresses on focus, but preserve any existing selection.
    const initialRequestId = locationRequestId.current;
    let cancelled = false;

    const fetchAddresses = async () => {
      try {
        const res = await client.get('/users/addresses/');
        const data = Array.isArray(res.data) ? res.data : [];
        if (cancelled) return;
        setAddresses(data);
        if (initialRequestId !== locationRequestId.current ||
            globalStore.checkoutAddress) return;
        // Only initialize the default address on the first selection.
        if (locationRequestId.current !== 0) return;

        const defaultAddr = data.find(a => a.is_default);
        if (defaultAddr) {
          setDeliveryLocation(defaultAddr.full_address);
          setSelectedAddr(defaultAddr);
          geocodeAndSetDistance(defaultAddr.full_address);
        } else if (globalStore.lastPickedLocation) {
          // No saved address - fall back to last location picked on Home/Map Picker
          setDeliveryLocation(
            globalStore.lastPickedLocation.address,
            {
              lat: globalStore.lastPickedLocation.lat,
              lng: globalStore.lastPickedLocation.lng,
            }
          );
          if (globalStore.lastPickedLocation.lat && shop?.latitude) {
            const dist = calculateDistance(
              globalStore.lastPickedLocation.lat, globalStore.lastPickedLocation.lng,
              parseFloat(shop.latitude), parseFloat(shop.longitude)
            );
            setCalcDistance(dist);
          }
        }
      } catch (e) { console.log('Address fetch error:', e.message); }
    };
    fetchAddresses();
    return () => { cancelled = true; };
  }, []));

  // Delivery distance is calculated only from the selected delivery address.

  const useCurrentLocation = async () => {
    if (geocodeTimer.current) {
      clearTimeout(geocodeTimer.current);
      geocodeTimer.current = null;
    }
    const requestId = ++locationRequestId.current;
    setLocatingCurrent(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const { latitude, longitude } = loc.coords;
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyCS_YRu6O61LCZn_QlypzjcjSdeRqbQaDI`);
      const data = await res.json();
      if (data.results?.[0] &&
          requestId === locationRequestId.current) {
        setDeliveryLocation(
          data.results[0].formatted_address,
          { lat: latitude, lng: longitude }
        );
        if (shop?.latitude && shop?.longitude) {
          const dist = calculateDistance(latitude, longitude, parseFloat(shop.latitude), parseFloat(shop.longitude));
          setCalcDistance(dist);
        }
      }
    } catch (e) { Alert.alert('Error', 'Could not get location'); }
    finally { setLocatingCurrent(false); }
  };

  const geocodeAndSetDistance = async (addressText) => {
    const requestId = ++locationRequestId.current;
    setDeliveryCoords(null);
    setCalcDistance(null);
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressText)}&key=AIzaSyCS_YRu6O61LCZn_QlypzjcjSdeRqbQaDI`);
      const data = await res.json();
      if (data.results?.[0]) {
        const { lat, lng } = data.results[0].geometry.location;
        if (requestId !== locationRequestId.current) return;
        setDeliveryCoords({ lat, lng });
        if (shop?.latitude && shop?.longitude) {
          const dist = calculateDistance(lat, lng, parseFloat(shop.latitude), parseFloat(shop.longitude));
          setCalcDistance(dist);
        }
      }
    } catch (e) { console.log('Geocode error:', e.message); }
  };

  const handlePlaceOrder = async () => {
    if (placingOrderRef.current) return;
    placingOrderRef.current = true;

    try {
    if (payment === 'online') {
      if (!pendingPaymentStorageKey) {
        Alert.alert(
          'Payment Unavailable',
          'Unable to identify your account. Please sign in again.'
        );
        return;
      }

      try {
        const saved = await AsyncStorage.getItem(pendingPaymentStorageKey);

        if (saved || pendingPayment || confirmingPaymentRef.current) {
          Alert.alert(
            'Previous Payment Pending',
            'A previous payment may already have succeeded. Please confirm that payment before making another payment.'
          );
          return;
        }
      } catch (error) {
        Alert.alert(
          'Payment Status Unavailable',
          'Unable to check for a previous payment. Please try again later rather than risk paying twice.'
        );
        return;
      }
    }

    if (deliveryInfo.outOfRange) {
      Alert.alert('Outside Delivery Area', 'Sorry, this shop does not deliver to your location. Maximum delivery range is 6 km.');
      return;
    }
    if (deliveryInfo.distanceUnknown) {
      // Button is already visually disabled in this state - no need for a popup
      return;
    }
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter delivery address');
      return;
    }
    const lat = Number(deliveryCoords?.lat);
    const lng = Number(deliveryCoords?.lng);
    if (
      !deliveryCoords ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      Alert.alert(
        'Delivery Location Required',
        'Please select a valid delivery location before placing your order.'
      );
      return;
    }
    setLoading(true);
    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.base_product_id || item.id,
        variant_id: item.variant_id || null,
        quantity:   item.qty,
        price:      parseFloat(item.price).toFixed(2),
      }));

      if (payment === 'online') {
        // For online payment: Create Razorpay order FIRST, no Univerin order yet
        const payRes = await client.post('/orders/payment/create-razorpay/', {
          vendor_id: shop.id,
          items: orderItems.map(({ product_id, variant_id, quantity }) => ({
            product_id,
            variant_id,
            quantity,
          })),
          delivery_address: address,
          delivery_latitude: lat,
          delivery_longitude: lng,
          notes: note,
        });
        // Verify the server-confirmed amount before opening Razorpay.
        const backendAmountPaise = Number(payRes.data?.amount);
        const displayedAmountPaise = Math.round(total) * 100;

        if (
          !Number.isSafeInteger(backendAmountPaise) ||
          backendAmountPaise <= 0
        ) {
          Alert.alert(
            'Payment Amount Unavailable',
            'Unable to verify the payment amount. Please try again.'
          );
          return;
        }

        if (backendAmountPaise !== displayedAmountPaise) {
          Alert.alert(
            'Order Total Changed',
            `Your displayed total is ₹${Math.round(total)}, but the verified total is ₹${(backendAmountPaise / 100).toFixed(2)}. Please refresh your cart and review the prices before paying.`
          );
          return;
        }

        // Persist the checkout before opening Razorpay.
        // A payment may succeed even if the app closes before its callback.
        if (!pendingPaymentStorageKey) {
          Alert.alert(
            'Payment Unavailable',
            'Unable to save payment recovery information. Please sign in again.'
          );
          return;
        }

        const awaitingPayment = {
          status: 'awaiting_payment_result',
          razorpay_order_id: payRes.data.razorpay_order_id,
          vendor_id: shop.id,
          amount_paise: backendAmountPaise,
          saved_at: new Date().toISOString(),
        };

        try {
          await AsyncStorage.setItem(
            pendingPaymentStorageKey,
            JSON.stringify(awaitingPayment)
          );
          setPendingPayment(awaitingPayment);
        } catch (storageError) {
          console.log('Unable to save checkout recovery:', storageError.message);
          Alert.alert(
            'Payment Unavailable',
            'Unable to save payment recovery information. Razorpay will not open. Please try again.'
          );
          return;
        }

        // Store order data to use after payment
        setPlacedOrder({
          orderItems,
          vendor_id: shop.id,
          delivery_address: address,
          delivery_latitude: lat,
          delivery_longitude: lng,
          notes: note,
          delivery_fee: deliveryFeeGST,
          total: Math.round(total),
        });
        console.log('USER OBJECT:', JSON.stringify(user));
        console.log('PREFILL CONTACT:', user?.phone_number);
        setRazorpayData({
          ...payRes.data,
          prefill_contact: user?.phone_number || '',
          prefill_name: user?.full_name || '',
        });
        setShowRazorpay(true);
      } else {
        // COD: Persist the exact checkout request before submission.
        if (!user?.id) {
          throw new Error('Buyer account information is unavailable.');
        }

        const codPayload = {
          vendor_id: shop.id,
          items: orderItems,
          delivery_address: address,
          delivery_latitude: lat,
          delivery_longitude: lng,
          payment_mode: 'cod',
          instructions: note,
          delivery_fee: deliveryFeeGST,
          total: Math.round(total),
        };

        const pending = await prepareCodCheckout(user.id, codPayload);

        const res = await client.post(
          '/orders/place/',
          pending.payload
        );

        if (!res.data?.order?.id) {
          throw new Error('Order confirmation is incomplete.');
        }

        try {
          await clearCodCheckout(user.id, pending.client_request_id);
        } catch (storageError) {
          console.log('Confirmed COD order: pending cleanup failed:', storageError.message);
        }

        try {
          await clearShopCart(shop.id);
        } catch (cartError) {
          console.log('Confirmed COD order: cart cleanup failed:', cartError.message);
        }

        navigation.replace('OrderSuccess', {
          order: res.data.order,
          calculatedTotal: Number(res.data.order.total_amount),
        });
      }
    } catch (e) {
      console.log('ORDER ERROR:', JSON.stringify(e.response?.data), e.message);
      const msg = e.response?.data?.error || 'Failed to place order. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
    } finally {
      placingOrderRef.current = false;
    }
  };

  const handleRazorpayResponse = async (data) => {
    if (
      processingRazorpayCallbackRef.current ||
      confirmingPaymentRef.current
    ) return;

    // Accept callbacks only for the checkout opened in this session.
    // A previously saved payment must never be overwritten.
    if (
      !pendingPayment ||
      pendingPayment.status !== 'awaiting_payment_result' ||
      !razorpayData?.razorpay_order_id ||
      pendingPayment.razorpay_order_id !== razorpayData.razorpay_order_id
    ) {
      setShowRazorpay(false);
      Alert.alert(
        'Payment Status Uncertain',
        'Unable to match this payment to the active checkout. Please do not pay again until its status is verified.'
      );
      return;
    }

    if (
      data.razorpay_order_id &&
      data.razorpay_order_id !== pendingPayment.razorpay_order_id
    ) {
      setShowRazorpay(false);
      Alert.alert(
        'Payment Verification Required',
        'The payment reference does not match this checkout. Please contact support before trying again.'
      );
      return;
    }

    if (data.razorpay_payment_id) {
      processingRazorpayCallbackRef.current = true;
    }

    if (!data.razorpay_payment_id) {
      setShowRazorpay(false);
      Alert.alert(
        'Payment Not Confirmed',
        'Payment was not confirmed. Please check your payment status before trying again.'
      );
      return;
    }

    if (!placedOrder) {
      setShowRazorpay(false);
      Alert.alert(
        'Payment Confirmation Pending',
        'Payment details were received, but checkout information is unavailable. Please do not pay again. Contact support.'
      );
      return;
    }

    try {
      const orderData = {
        vendor_id: placedOrder.vendor_id,
        items: placedOrder.orderItems,
        delivery_address: placedOrder.delivery_address,
        delivery_latitude: placedOrder.delivery_latitude,
        delivery_longitude: placedOrder.delivery_longitude,
        notes: placedOrder.notes,
        delivery_fee: placedOrder.delivery_fee,
        total: placedOrder.total,
      };

      let pending;

      try {
        pending = await savePendingPayment(data, orderData);
      } catch (storageError) {
        console.log('Pending payment storage failed:', storageError.message);

        // Preserve confirmation details for the current app session.
        pending = {
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          order_data: orderData,
        };

        setPendingPayment(pending);
      }

      await confirmPendingPayment(pending);
    } catch (error) {
      console.log('Payment callback processing error:', error.message);
      setShowRazorpay(false);
      Alert.alert(
        'Payment Confirmation Pending',
        'Your payment may have succeeded. Please do not pay again. Retry confirmation or contact support.'
      );
    }
  };

  const getRazorpayHTML = () => {
    if (!razorpayData) return '';
    console.log('RAZORPAY DATA:', JSON.stringify(razorpayData));
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f8f9fa; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; }
    .loader { text-align: center; padding: 20px; }
    .loader p { color: #666; font-size: 16px; margin-top: 10px; }
    .spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #1669ef; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Opening payment...</p>
  </div>
  <script>
    function loadRazorpay() {
      var script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = function() {
        var options = {
          key: '${razorpayData.key_id}',
          amount: ${razorpayData.amount},
          currency: '${razorpayData.currency}',
          name: 'Univerin',
          description: 'Order from ${razorpayData.shop_name}',
          order_id: '${razorpayData.razorpay_order_id}',
          theme: { color: '#1669ef' },
          prefill: {
            contact: '${razorpayData.prefill_contact || ""}',
            name: '${razorpayData.prefill_name || ""}',
          },
          handler: function(response) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }));
          },
          modal: {
            ondismiss: function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ cancelled: true }));
            }
          }
        };
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ failed: true, error: response.error.description }));
        });
        rzp.open();
      };
      script.onerror = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Failed to load Razorpay' }));
      };
      document.head.appendChild(script);
    }
    window.onload = loadRazorpay;
  </script>
</body>
</html>`;
  };

  if (showRazorpay && razorpayData) {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            setShowRazorpay(false);
            Alert.alert(
              'Payment Status Uncertain',
              'The payment window was closed, but payment may still have succeeded. Use Check Payment / Recover Order before trying another online payment.'
            );
          }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pay Rs.{total.toFixed(0)}</Text>
          <View style={{ width: 36 }} />
        </View>
        <WebView
          source={{ html: getRazorpayHTML() }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.cancelled) {
                setShowRazorpay(false);
                Alert.alert(
                  'Payment Status Uncertain',
                  'Razorpay was closed without a confirmed result. Check your existing payment before attempting another online payment.'
                );
              } else {
                handleRazorpayResponse(data);
              }
            } catch(e) { console.log('WebView message error:', e); }
          }}
          onError={(e) => console.log('WebView error:', e.nativeEvent)}
          onLoadEnd={() => console.log('WebView loaded!')}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          mixedContentMode="always"
          originWhitelist={['*']}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          userAgent="Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile Safari/537.36"
          renderLoading={() => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#1669ef" />
              <Text style={{ marginTop: 12, color: '#888' }}>Loading payment...</Text>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      {pendingPayment && (
        <View style={{
          padding: 16,
          margin: 12,
          backgroundColor: '#FFF4D6',
          borderRadius: 12,
        }}>
          <Text style={{
            fontSize: 15,
            fontWeight: '700',
            color: '#754C00',
            marginBottom: 8,
          }}>
            Payment Confirmation Pending
          </Text>
          <Text style={{
            fontSize: 13,
            color: '#754C00',
            marginBottom: 12,
          }}>
            Your payment may have succeeded. Please confirm your existing payment instead of paying again.
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (
                pendingPayment?.razorpay_payment_id &&
                pendingPayment?.razorpay_signature &&
                pendingPayment?.order_data
              ) {
                confirmPendingPayment(pendingPayment);
              } else {
                recoverPendingPayment(pendingPayment);
              }
            }}
            disabled={loading}
            style={{
              backgroundColor: '#1669ef',
              padding: 13,
              borderRadius: 9,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
              {loading
                ? 'Checking Previous Payment...'
                : pendingPayment?.razorpay_payment_id &&
                  pendingPayment?.razorpay_signature &&
                  pendingPayment?.order_data
                  ? 'Retry Order Confirmation'
                  : 'Check Payment / Recover Order'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={[styles.container, { flex: 1 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Deliver To</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Address')}>
                <Text style={styles.changeBtn}>+ Add Address</Text>
              </TouchableOpacity>
            </View>
            {addresses.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addrRow}>
                {addresses.map(addr => (
                  <TouchableOpacity
                    key={addr.id}
                    style={[styles.addrChip, selectedAddr?.id === addr.id && styles.addrChipActive]}
                    onPress={() => {
                      setDeliveryLocation(addr.full_address);
                      setSelectedAddr(addr);
                      geocodeAndSetDistance(addr.full_address);
                    }}
                  >
                    <Text style={styles.addrChipIcon}>
                      {addr.label === 'Home' ? '🏠' : addr.label === 'Work' ? '💼' : '📍'}
                    </Text>
                    <Text style={[styles.addrChipText, selectedAddr?.id === addr.id && styles.addrChipTextActive]}>
                      {addr.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TouchableOpacity style={styles.locationQuickBtn} onPress={useCurrentLocation} disabled={locatingCurrent}>
                {locatingCurrent
                  ? <ActivityIndicator size="small" color="#1669ef" />
                  : <Ionicons name="locate-outline" size={16} color="#1669ef" />
                }
                <Text style={styles.locationQuickText}>{locatingCurrent ? 'Locating...' : 'Current Location'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.locationQuickBtn} onPress={() => navigation.navigate('MapPicker', { isCheckout: true, onLocationSelected: null })}>
                <Ionicons name="map-outline" size={16} color="#1669ef" />
                <Text style={styles.locationQuickText}>Pick on Map</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.addressInput}
              placeholder="Enter your full delivery address"
              placeholderTextColor="#9CA3AF"
              value={address}
              onChangeText={(text) => {
                setDeliveryLocation(text);
                if (text.trim()) {
                  geocodeTimer.current = setTimeout(() => {
                    geocodeTimer.current = null;
                    geocodeAndSetDistance(text);
                  }, 700);
                }
              }}
              multiline
              numberOfLines={3}
            />
          </View>

          {deliveryInfo.outOfRange && (
            <View style={styles.outOfRangeBanner}>
              <Ionicons name="alert-circle" size={18} color="#dc2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.outOfRangeText}>
                  Outside delivery area — {calcDistance ? `${calcDistance} km` : 'too far'}. Max range is 6 km.
                </Text>
                <TouchableOpacity
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                  onPress={() => navigation.navigate('MapPicker', { isCheckout: true, onLocationSelected: null })}
                >
                  <Text style={{ color: '#1669ef', fontWeight: '700', fontSize: 13 }}>Change Delivery Location →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Summary</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Ionicons name="storefront-outline" size={16} color="#111" />
              <Text style={styles.shopName}>{shop?.shop_name}</Text>
            </View>
            <View style={styles.divider} />
            {cartItems.map(item => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.orderItemLeft}>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>{item.qty}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderItemName}>{item.name}</Text>
                    {item.mrp && parseFloat(item.mrp) > parseFloat(item.price) && (
                      <Text style={styles.orderItemMrp}>MRP: <Text style={{ textDecorationLine: 'line-through' }}>Rs.{parseFloat(item.mrp).toFixed(0)}</Text> • <Text style={{ color: '#16A34A' }}>{Math.round((1 - parseFloat(item.price) / parseFloat(item.mrp)) * 100)}% OFF</Text></Text>
                    )}
                  </View>
                </View>
                <Text style={styles.orderItemPrice}>Rs.{(parseFloat(item.price) * item.qty).toFixed(0)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bill Details</Text>
            {shopHasGST && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '600' }}>GST Registered Shop · GSTIN: {shop.gstin}</Text>
              </View>
            )}
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Items Total{shopHasGST ? ' (incl. GST)' : ''}</Text>
              <Text style={styles.billValue}>Rs.{subtotal % 1 === 0 ? subtotal.toFixed(0) : subtotal.toFixed(1)}</Text>
            </View>
            <View style={styles.billRow}>
              <View>
                <Text style={styles.billLabel}>Delivery Fee (incl. 18% GST)</Text>
                <Text style={styles.billLabelSub}>{calcDistance ? `📍 ${calcDistance} km away` : (distance ? `📍 ${distance} km away` : '')}</Text>
              </View>
              {deliveryInfo.isFree
                ? <Text style={styles.billValueFree}>FREE</Text>
                : <Text style={styles.billValue}>Rs.{deliveryFeeGST}</Text>
              }
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Platform Fee (incl. 18% GST)</Text>
              <Text style={styles.billValue}>Rs.{platformFeeGST}</Text>
            </View>
            <View style={styles.divider} />
            {totalSavings > 0 && (
              <View style={styles.savingsBanner}>
                <Text style={styles.savingsText}>🎉 You saved Rs.{totalSavings} on this order!</Text>
              </View>
            )}
            <View style={styles.billRow}>
              <Text style={styles.billTotalLabel}>Total Amount</Text>
              <Text style={styles.billTotalValue}>Rs.{total % 1 === 0 ? total.toFixed(0) : total.toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Method</Text>
            <TouchableOpacity style={[styles.paymentOption, payment === 'cod' && styles.paymentOptionActive]} onPress={() => setPayment('cod')}>
              <View style={styles.paymentLeft}>
                <Text style={styles.paymentEmoji}>💵</Text>
                <View>
                  <Text style={styles.paymentName}>Cash on Delivery</Text>
                  <Text style={styles.paymentDesc}>Pay when you receive</Text>
                </View>
              </View>
              <View style={[styles.radio, payment === 'cod' && styles.radioActive]}>
                {payment === 'cod' && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
            <View style={{ height: 10 }} />
            <TouchableOpacity style={[styles.paymentOption, payment === 'online' && styles.paymentOptionOnline]} onPress={() => setPayment('online')}>
              <View style={styles.paymentLeft}>
                <Text style={styles.paymentEmoji}>💳</Text>
                <View>
                  <Text style={styles.paymentName}>Online Payment</Text>
                  <Text style={styles.paymentDesc}>UPI, Cards, Net Banking</Text>
                </View>
              </View>
              <View style={[styles.radio, payment === 'online' && styles.radioActiveOnline]}>
                {payment === 'online' && <View style={styles.radioDotOnline} />}
              </View>
            </TouchableOpacity>
            {payment === 'online' && (
              <View style={styles.onlineBadge}>
                <Text style={styles.onlineBadgeText}>Powered by Razorpay - Safe & Secure</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Special Instructions <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput style={styles.noteInput} placeholder="e.g. Please pack carefully" placeholderTextColor="#9CA3AF" value={note} onChangeText={setNote} multiline numberOfLines={2} />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerTop}>
            <Text style={styles.footerTotal}>Rs.{total.toFixed(0)}</Text>
            <Text style={styles.footerTotalLabel}>Total</Text>
          </View>
          <TouchableOpacity
            style={styles.placeOrderBtn}
            onPress={handlePlaceOrder}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.placeOrderText}>{payment === 'online' ? '💳 Pay Rs.' : 'Place Order • Rs.'}{total.toFixed(0)}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, margin: 16, marginBottom: 0, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#111', marginBottom: 12 },
  changeBtn: { fontSize: 13, color: '#1669ef', fontWeight: '600' },
  addrRow: { marginBottom: 12 },
  addrChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#F9FAFB' },
  addrChipActive: { borderColor: '#1669ef', backgroundColor: '#eff6ff' },
  addrChipIcon: { fontSize: 14 },
  addrChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  addrChipTextActive: { color: '#1669ef', fontWeight: 'bold' },
  locationQuickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#1669ef', backgroundColor: '#EFF6FF' },
  locationQuickText: { fontSize: 12, fontWeight: '600', color: '#1669ef' },
  addressInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#111', minHeight: 80, textAlignVertical: 'top', backgroundColor: '#F9FAFB' },
  outOfRangeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca' },
  outOfRangeText: { fontSize: 13, color: '#dc2626', fontWeight: '600', flex: 1 },
  shopName: { fontSize: 14, fontWeight: '600', color: '#555' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  orderItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
  qtyBadge: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  qtyBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#1669ef' },
  orderItemMrp: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  orderItemName: { fontSize: 14, color: '#555', flex: 1 },
  orderItemPrice: { fontSize: 14, fontWeight: '600', color: '#111' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  billLabel: { fontSize: 14, color: '#888' },
  billLabelSub: { fontSize: 11, color: '#aaa', marginTop: 2 },
  billValue: { fontSize: 14, color: '#111' },
  billValueFree: { fontSize: 14, color: '#16A34A', fontWeight: '700' },
  billTotalLabel: { fontSize: 15, fontWeight: 'bold', color: '#111' },
  billTotalValue: { fontSize: 15, fontWeight: 'bold', color: '#1669ef' },
  savingsBanner: { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 8, marginBottom: 8 },
  savingsText: { fontSize: 13, color: '#16a34a', fontWeight: '600', textAlign: 'center' },
  paymentOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14 },
  paymentOptionActive: { borderColor: '#1669ef', backgroundColor: '#eff6ff' },
  paymentOptionOnline: { borderColor: '#1669ef', backgroundColor: '#eff6ff' },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentEmoji: { fontSize: 24 },
  paymentName: { fontSize: 14, fontWeight: '600', color: '#111' },
  paymentDesc: { fontSize: 12, color: '#888' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: '#1669ef' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1669ef' },
  radioActiveOnline: { borderColor: '#1669ef' },
  radioDotOnline: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1669ef' },
  onlineBadge: { backgroundColor: '#f5f3ff', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' },
  onlineBadgeText: { fontSize: 12, color: '#1669ef', fontWeight: '600' },
  optional: { fontSize: 12, color: '#9CA3AF', fontWeight: 'normal' },
  noteInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#111', minHeight: 60, textAlignVertical: 'top', backgroundColor: '#F9FAFB' },
  footer: { padding: 16, paddingBottom: 30, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  footerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  footerTotal: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  footerTotalLabel: { fontSize: 12, color: '#888' },
  placeOrderBtn: { backgroundColor: '#1669ef', borderRadius: 14, padding: 16, alignItems: 'center' },
  placeOrderBtnDisabled: { backgroundColor: '#9CA3AF' },
  placeOrderText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});