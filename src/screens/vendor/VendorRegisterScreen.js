import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, Image, Linking
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';

const CATEGORIES = [
  { id: 'restaurant',  label: 'Restaurant',  icon: 'restaurant', color: '#dc2626', bg: '#FEF2F2', commission: 20, mov: 499 },
  { id: 'supermarket', label: 'Supermarket', icon: 'storefront', color: '#7c3aed', bg: '#F5F3FF', commission: 8,  mov: 699 },
  { id: 'bakery',      label: 'Bakery',      icon: 'cafe',       color: '#d97706', bg: '#FFFBEB', commission: 20, mov: 399 },
  { id: 'veg_fruits',  label: 'Veg & Fruits',icon: 'leaf',       color: '#16a34a', bg: '#F0FDF4', commission: 8,  mov: 199 },
];

const WEEKLY_OFF = ['None','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ── Delivery radius options ───────────────────────────────────────────────────
const RADIUS_OPTIONS = ['1', '2', '3', '4', '5', '6', '10', '15', '20'];

export default function VendorRegisterScreen({ navigation }) {
  const { login, loginWithTokens } = useAuth();
  const [step, setStep]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [shopName,  setShopName]  = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone,     setPhone]     = useState('');
  const [town,      setTown]      = useState('');
  const [state,     setState]     = useState('Andhra Pradesh');
  const [address,   setAddress]   = useState('');
  const [gstin,     setGstin]     = useState('');
  const [gstRegistered, setGstRegistered] = useState(false);
  const [pan,       setPan]       = useState('');
  const [fssai,     setFssai]     = useState('');
  const [fssaiCert, setFssaiCert] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [vendorLat, setVendorLat] = useState(null);
  const [vendorLng, setVendorLng] = useState(null);
  const [otpConfirm, setOtpConfirm] = useState(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [vendorOtp, setVendorOtp] = useState(['','','','','','']);
  const registrationBusy = useRef(false);
  const otpVerified = useRef(false);

  const [category,        setCategory]        = useState('restaurant');
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [timingsConfirmed, setTimingsConfirmed] = useState(false);
  // MOV auto-set based on category
  const [deliveryType,    setDeliveryType]    = useState('delivery');
  const [minOrder,        setMinOrder]        = useState('499');
  const [deliveryTime,    setDeliveryTime]    = useState('30');
  const [deliveryRadius,  setDeliveryRadius]  = useState('6');

  const [accountName, setAccountName] = useState('');
  const [bankName,    setBankName]    = useState('');
  const [accountNo,   setAccountNo]   = useState('');
  const [ifsc,        setIfsc]        = useState('');

  const [openTime,  setOpenTime]  = useState('9:00 AM');
  const [closeTime, setCloseTime] = useState('9:00 PM');
  const [weeklyOff, setWeeklyOff] = useState('None');

  const getCommission = () => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat ? cat.commission : 20;
  };
  const getMOV = () => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat ? cat.mov : 199;
  };

  const handleDetectLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location access to auto-detect your town.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const geocode = await Location.reverseGeocodeAsync({
        latitude:  location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (geocode.length > 0) {
        const place = geocode[0];
        const detectedTown    = place.city || place.subregion || place.district || place.region || '';
        const detectedState   = place.region || '';
        const detectedAddress = [
          place.streetNumber,
          place.street,
          place.subLocality || place.district,
          place.postalCode,
        ].filter(Boolean).join(', ');
        if (detectedTown)    setTown(detectedTown);
        if (detectedState)   setState(detectedState);
        if (detectedAddress) setAddress(detectedAddress);
        setVendorLat(location.coords.latitude);
        setVendorLng(location.coords.longitude);
        Alert.alert(
          '📍 Location Detected!',
          `Town: ${detectedTown}\nState: ${detectedState}\nAddress: ${detectedAddress}`
        );
      } else {
        Alert.alert('Could not detect', 'Please enter your address manually.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not detect location. Please enter manually.');
    } finally {
      setGpsLoading(false);
    }
  };

  // Form readiness for the five registration steps
  const basicInfoValid =
    shopName.trim().length > 0 &&
    ownerName.trim().length > 0 &&
    /^[0-9]{10}$/.test(phone) &&
    town.trim().length > 0 &&
    state.trim().length > 0 &&
    vendorLat !== null &&
    vendorLng !== null &&
    (!gstRegistered || /^[0-9A-Z]{15}$/.test(gstin.trim().toUpperCase())) &&
    (pan.trim() === '' || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase())) &&
    /^[0-9]{14}$/.test(fssai) &&
    Boolean(fssaiCert);

  const shopDetailsValid =
    CATEGORIES.some(item => item.id === category) &&
    /^[0-9]{1,3}$/.test(deliveryTime) &&
    Number(deliveryTime) >= 1 &&
    Number(deliveryTime) <= 180;

  const timingsValid =
    openTime.trim().length > 0 &&
    closeTime.trim().length > 0 &&
    WEEKLY_OFF.includes(weeklyOff);

  const bankDetailsValid =
    accountName.trim().length > 0 &&
    bankName.trim().length > 0 &&
    /^[0-9]{9,18}$/.test(accountNo.trim()) &&
    /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase());

  const canGoNext =
    !loading &&
    !gpsLoading &&
    (step === 1 ? basicInfoValid :
     step === 2 ? shopDetailsValid :
     step === 3 ? bankDetailsValid :
     step === 4 ? timingsValid : false);

  const canSubmit =
    !loading &&
    basicInfoValid &&
    shopDetailsValid &&
    timingsValid &&
    agreedToTerms;

  // ── Validation on Next ──
  const goNext = () => {
    if (!canGoNext) return;
    if (step === 1) {
      if (!shopName.trim())  return Alert.alert('Error', 'Please enter shop name');
      if (!ownerName.trim()) return Alert.alert('Error', 'Please enter owner name');
      if (!phone.trim() || phone.length !== 10) return Alert.alert('Error', 'Enter valid 10-digit phone number');
      if (!town.trim())      return Alert.alert('Error', 'Please enter your town');
      if (!vendorLat || !vendorLng) return Alert.alert('📍 Location Required', 'Please set your shop location using the GPS button. This helps customers find your shop nearby.');

    }
    setStep(prev => prev + 1);
  };

  const goBack = () => {
    if (step === 1) navigation.goBack();
    else setStep(prev => prev - 1);
  };

  // ── Submit ──
  const pickFssaiCert = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required', 'Please allow access to photos'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled) setFssaiCert(result.assets[0]);
    } catch (err) { Alert.alert('Error', 'Could not pick image'); }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!shopName.trim()) return Alert.alert('Error', 'Shop name is required');
    if (!town.trim())     return Alert.alert('Error', 'Town is required');
    if (!fssai.trim())    return Alert.alert('FSSAI Number Required', 'Please enter your FSSAI license number to register your shop. This is mandatory for selling food/grocery items.');
    if (!fssaiCert)       return Alert.alert('FSSAI Certificate Required', 'Please upload a photo of your FSSAI certificate to register your shop. This is mandatory for selling food/grocery items.');
    if (!agreedToTerms)   return Alert.alert('Agreement Required', 'Please read and agree to the Seller Agreement before registering.');

    setLoading(true);
    try {
      await client.post('/users/send-register-otp/', {
        phone_number: phone,
        full_name: ownerName,
        user_type: 'vendor',
      });
      setLoading(false);
      setShowOtpModal(true);
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to send OTP. Please try again.';
      Alert.alert('Error', msg);
      setLoading(false);
    }
  };

  const handleVerifyAndRegisterShop = async () => {
    if (registrationBusy.current) return;

    const otpCode = vendorOtp.join('');
    if (!otpVerified.current && otpCode.length !== 6) {
      return Alert.alert('Error', 'Please enter complete OTP');
    }

    registrationBusy.current = true;
    setLoading(true);

    const checkExistingShop = async () => {
      try {
        await client.get('/vendors/myshop/');
        return 'exists';
      } catch (error) {
        if (error.response?.status === 404) return 'missing';
        return 'unknown';
      }
    };

    try {
      if (!otpVerified.current) {
        const verifyResponse = await client.post('/users/verify-register-otp/', {
          phone_number: phone,
          otp: otpCode,
          full_name: ownerName,
          user_type: 'vendor',
        });

        const { user, tokens } = verifyResponse.data;

        if (!user || !tokens?.access || !tokens?.refresh) {
          throw new Error('Authentication data missing after OTP verification.');
        }

        await loginWithTokens(tokens, user);
        otpVerified.current = true;
      }

      const existing = await checkExistingShop();

      if (existing === 'unknown') {
        Alert.alert('Connection Error', 'Unable to check your shop status. Please try again.');
        return;
      }

      if (existing === 'exists') {
        setShowOtpModal(false);
        Alert.alert(
          'Shop Already Registered',
          'Your shop is already registered. You can continue to your seller dashboard.',
          [{ text: 'Continue', onPress: () => navigation.replace('VendorHome') }]
        );
        return;
      }

      let response;

      try {
        response = await client.post('/vendors/register/', {
          shop_name: shopName,
          category,
          town,
          state,
          gstin: gstin || '',
          pan: pan || '',
          fssai_number: fssai || '',
          phone_number: phone,
          address: address || town,
          latitude: vendorLat ?? null,
          longitude: vendorLng ?? null,
          delivery_type: deliveryType,
          estimated_delivery_time: parseInt(deliveryTime, 10),
          delivery_radius: parseFloat(deliveryRadius) || 5.0,
        });
      } catch (error) {
        const shopStatus = await checkExistingShop();

        if (shopStatus === 'exists') {
          setShowOtpModal(false);
          Alert.alert(
            'Shop Registered',
            'Your shop has been registered. You can continue to your seller dashboard.',
            [{ text: 'Continue', onPress: () => navigation.replace('VendorHome') }]
          );
          return;
        }

        if (shopStatus === 'unknown') {
          Alert.alert(
            'Registration Status Unclear',
            'We could not confirm whether your shop was created. Please check your connection and try again.'
          );
          return;
        }

        throw error;
      }

      console.log('Vendor registered:', response.data);
      setShowOtpModal(false);

      Alert.alert(
        'Registration Submitted',
        'Your shop registration was successful. Please check your seller dashboard for its approval status.',
        [{ text: 'Continue', onPress: () => navigation.replace('VendorHome') }]
      );
    } catch (error) {
      console.log('Vendor registration error:', error.response?.data || error.message);

      const msg =
        error.response?.data?.phone_number?.[0] ||
        error.response?.data?.error ||
        error.response?.data?.detail ||
        error.response?.data?.shop_name?.[0] ||
        error.response?.data?.address?.[0] ||
        error.message ||
        'Registration failed. Please try again.';

      Alert.alert('Registration Error', String(msg));
    } finally {
      registrationBusy.current = false;
      setLoading(false);
    }
  };

  // ── Progress Bar ──
  const Progress = () => (
    <View style={styles.progressRow}>
      {[1,2,3,4,5].map(i => (
        <View
          key={i}
          style={[
            styles.progressDot,
            { backgroundColor: i <= step ? '#1669ef' : '#E0E0E0', flex: 1 },
          ]}
        />
      ))}
    </View>
  );

  // ── Step 1 — Basic Info ──
  const renderStep1 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Basic Information</Text>
      <Text style={styles.stepSubtitle}>Step 1 of 5 — Shop & Owner Details</Text>
      <Progress />

      <Text style={styles.label}>Shop Name *</Text>
      <TextInput style={styles.input} placeholder="Business Name"
        placeholderTextColor="#9CA3AF" value={shopName} onChangeText={setShopName} />

      <Text style={styles.label}>Owner Name *</Text>
      <TextInput style={styles.input} placeholder="Your full name"
        placeholderTextColor="#9CA3AF" value={ownerName} onChangeText={setOwnerName} />

      <TouchableOpacity style={styles.gpsBtn} onPress={handleDetectLocation} disabled={gpsLoading}>
        {gpsLoading
          ? <ActivityIndicator color="#1669ef" size="small" />
          : <Text style={styles.gpsBtnText}>📍 Auto-detect my location</Text>
        }
      </TouchableOpacity>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Town/City *</Text>
          <TextInput
            style={[styles.input, town ? styles.inputFilled : null]}
            placeholder="Your town"
            placeholderTextColor="#9CA3AF"
            value={town}
            onChangeText={text => {
              setTown(text);
              if (!text) { setVendorLat(null); setVendorLng(null); }
            }}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>State *</Text>
          <TextInput style={styles.input} placeholder="e.g. Andhra Pradesh"
            placeholderTextColor="#9CA3AF" value={state} onChangeText={setState} />
        </View>
      </View>

      <Text style={styles.label}>Mobile *</Text>
      <TextInput style={styles.input} placeholder="10-digit"
        placeholderTextColor="#9CA3AF" value={phone} onChangeText={setPhone}
        keyboardType="phone-pad" maxLength={10} />

      <View style={styles.fieldRow}>
        <View style={styles.halfField}>
          <Text style={styles.label}>GST Registered?</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity onPress={() => setGstRegistered(true)}
              style={{ flex:1, padding:10, borderRadius:8, borderWidth:1, borderColor: gstRegistered ? '#1669ef':'#D1D5DB', backgroundColor: gstRegistered ? '#eff6ff':'#fff', alignItems:'center' }}>
              <Text style={{ color: gstRegistered ? '#1669ef':'#555', fontWeight:'600' }}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setGstRegistered(false); setGstin(''); }}
              style={{ flex:1, padding:10, borderRadius:8, borderWidth:1, borderColor: !gstRegistered ? '#1669ef':'#D1D5DB', backgroundColor: !gstRegistered ? '#eff6ff':'#fff', alignItems:'center' }}>
              <Text style={{ color: !gstRegistered ? '#1669ef':'#555', fontWeight:'600' }}>No</Text>
            </TouchableOpacity>
          </View>
          {gstRegistered && (
            <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="15-digit GSTIN"
              placeholderTextColor="#9CA3AF" value={gstin} onChangeText={setGstin}
              autoCapitalize="characters" maxLength={15} />
          )}
        </View>
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.halfField}>
          <Text style={styles.label}>PAN (optional)</Text>
          <TextInput style={styles.input} placeholder="10-digit PAN"
            placeholderTextColor="#9CA3AF" value={pan} onChangeText={setPan}
            autoCapitalize="characters" maxLength={10} />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>FSSAI Number *</Text>
          <TextInput style={styles.input} placeholder="14-digit FSSAI (required)"
            placeholderTextColor="#9CA3AF" value={fssai} onChangeText={setFssai}
            keyboardType="numeric" maxLength={14} />
        </View>
      </View>
      <View style={styles.fieldRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>FSSAI Certificate *</Text>
          <TouchableOpacity onPress={pickFssaiCert}
            style={{ borderWidth: 1, borderColor: fssaiCert ? '#16a34a' : '#D1D5DB', borderRadius: 8, padding: 12, alignItems: 'center', backgroundColor: fssaiCert ? '#f0fdf4' : '#fff' }}>
            <Text style={{ color: fssaiCert ? '#16a34a' : '#9CA3AF', fontWeight: '500' }}>
              {fssaiCert ? '✅ Certificate selected' : '📎 Upload FSSAI Certificate'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>


      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // ── Step 2 — Shop Details + Delivery Radius ──
  const renderStep2 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Shop Details</Text>
      <Text style={styles.stepSubtitle}>Step 2 of 5 — Category & Delivery</Text>
      <Progress />

      <Text style={styles.label}>Category *</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity key={cat.id}
            style={[styles.categoryCard, category === cat.id && styles.categoryCardActive]}
            onPress={() => {
              setCategory(cat.id);
              setCategoryConfirmed(true);
              setMinOrder(String(cat.mov));
            }}>
            <View style={[styles.categoryIconBox, { backgroundColor: category === cat.id ? cat.color : cat.bg }]}>
              <Ionicons name={cat.icon} size={24} color={category === cat.id ? '#fff' : cat.color} />
            </View>
            <Text style={[styles.categoryLabel, category === cat.id && styles.categoryLabelActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.feeInfo}>
        <Text style={styles.feeInfoText}>
          Commission: <Text style={{ fontWeight: 'bold' }}>{getCommission()}% per order</Text> • MOV: <Text style={{ fontWeight: 'bold' }}>₹{getMOV()}</Text>
        </Text>
      </View>

      <Text style={styles.label}>Delivery Time (mins)</Text>
          <TextInput style={[styles.input, { color: '#1669ef', fontWeight: 'bold' }]} placeholder="30" placeholderTextColor="#9CA3AF"
            value={deliveryTime}
            onChangeText={(value) => setDeliveryTime(value.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3} />


      {/* ── Delivery Radius ── */}
      <Text style={styles.label}>Delivery Radius</Text>
      <View style={styles.radiusInfo}>
        <Text style={styles.radiusInfoText}>
          📡 Platform default delivery radius is <Text style={{ fontWeight: 'bold', color: '#1669ef' }}>6 km</Text>. Buyers within this range will see your shop.
        </Text>
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // ── Step 3 — Bank Details ──
  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Bank Details</Text>
      <Text style={styles.stepSubtitle}>Step 3 of 5 — For weekly settlement</Text>
      <Progress />

      <View style={styles.feeInfo}>
        <Text style={styles.feeInfoText}>Bank details are used by admin to settle earnings weekly</Text>
      </View>

      <Text style={styles.label}>Account Holder Name</Text>
      <TextInput style={styles.input} placeholder="Name as per bank"
        placeholderTextColor="#9CA3AF" value={accountName} onChangeText={setAccountName} />

      <Text style={styles.label}>Bank Name</Text>
      <TextInput style={styles.input} placeholder="e.g. SBI, HDFC"
        placeholderTextColor="#9CA3AF" value={bankName} onChangeText={setBankName} />

      <Text style={styles.label}>Account Number</Text>
      <TextInput style={styles.input} placeholder="Account number"
        placeholderTextColor="#9CA3AF" value={accountNo}
        onChangeText={setAccountNo} keyboardType="numeric" />

      <Text style={styles.label}>IFSC Code</Text>
      <TextInput style={styles.input} placeholder="e.g. SBIN0001234"
        placeholderTextColor="#9CA3AF" value={ifsc}
        onChangeText={setIfsc} autoCapitalize="characters" />

      <View style={styles.optionalNote}>
        <Text style={styles.optionalNoteText}>
          ℹ️ Bank details can be added later from your profile settings
        </Text>
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // ── Step 4 — Timings ──
  const renderStep4 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Shop Timings</Text>
      <Text style={styles.stepSubtitle}>Step 4 of 5 — When are you open?</Text>
      <Progress />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Opening Time</Text>
          <TextInput style={styles.input} placeholder="e.g. 9:00 AM"
            placeholderTextColor="#9CA3AF" value={openTime} onChangeText={setOpenTime} />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Closing Time</Text>
          <TextInput style={styles.input} placeholder="e.g. 9:00 PM"
            placeholderTextColor="#9CA3AF" value={closeTime} onChangeText={setCloseTime} />
        </View>
      </View>

      <Text style={styles.label}>Weekly Off</Text>
      <View style={styles.weeklyGrid}>
        {WEEKLY_OFF.map(day => (
          <TouchableOpacity key={day}
            style={[styles.dayBtn, weeklyOff === day && styles.dayBtnActive]}
            onPress={() => { setWeeklyOff(day); setTimingsConfirmed(true); }}>
            <Text style={[styles.dayBtnText, weeklyOff === day && styles.dayBtnTextActive]}>
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // ── Step 5 — Review ──
  const renderStep5 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Review & Submit</Text>
      <Text style={styles.stepSubtitle}>Step 5 of 5 — Check your details</Text>
      <Progress />

      <View style={styles.reviewCard}>
        <Text style={styles.reviewSection}>🏪 Shop Info</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Shop: </Text>{shopName}</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Owner: </Text>{ownerName}</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Phone: </Text>{phone}</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Town: </Text>{town}</Text>
        {vendorLat && (
          <Text style={styles.reviewRow}>
            <Text style={styles.reviewKey}>GPS: </Text>
            {vendorLat?.toFixed(4)}, {vendorLng?.toFixed(4)} ✅
          </Text>
        )}
      </View>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewSection}>📦 Shop Details</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Category: </Text>{category}</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Delivery: </Text>{deliveryType}</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Delivery Radius: </Text>{deliveryRadius} km 📡</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Min Order: </Text>Rs.{minOrder}</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Commission: </Text>{getCommission()}% • MOV: ₹{getMOV()}</Text>
      </View>

      {(accountName || bankName) && (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewSection}>🏦 Bank Details</Text>
          <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Account: </Text>{accountName}</Text>
          <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Bank: </Text>{bankName}</Text>
          <Text style={styles.reviewRow}><Text style={styles.reviewKey}>IFSC: </Text>{ifsc}</Text>
        </View>
      )}

      <View style={styles.reviewCard}>
        <Text style={styles.reviewSection}>🕐 Timings</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Hours: </Text>{openTime} - {closeTime}</Text>
        <Text style={styles.reviewRow}><Text style={styles.reviewKey}>Weekly Off: </Text>{weeklyOff}</Text>
      </View>

      <View style={styles.approvalNote}>
        <Text style={styles.approvalText}>✅ Your shop will go live immediately on Univerin!</Text>
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Image
            source={require('../../../assets/app-logo-full.png')}
            style={styles.logoIconBox}
            resizeMode="contain"
          />
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={styles.tabInactive} onPress={() => navigation.navigate('Register')}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name="cart-outline" size={16} color="#888" /><Text style={styles.tabInactiveText}>Buyer</Text></View>
        </TouchableOpacity>
        <View style={styles.tabActive}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name="storefront" size={16} color="#1669ef" /><Text style={styles.tabActiveText}>Seller</Text></View>
        </View>
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}

      <View style={styles.footer}>
        {step < 5 ? (
          <View>
            <TouchableOpacity
              style={[styles.nextBtn, !canGoNext && styles.nextBtnDisabled]}
              onPress={goNext}
              disabled={!canGoNext}
            >
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>

            {step === 3 && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => setStep(4)}
                disabled={loading}
              >
                <Text style={styles.skipBtnText}>Skip for Now</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, paddingHorizontal: 4 }}>
            <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)}
              style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: agreedToTerms ? '#1669ef' : '#D1D5DB', backgroundColor: agreedToTerms ? '#1669ef' : '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 2, marginRight: 10 }}>
              {agreedToTerms && <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>✓</Text>}
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 12, color: '#444', lineHeight: 18 }}>
              I have read and agree to the{' '}
              <Text style={{ color: '#1669ef', fontWeight: '600' }} onPress={() => Linking.openURL('https://www.univerin.in/seller-agreement')}>Seller Agreement</Text>
              {' '}including FSSAI compliance obligations, listing accuracy requirements, and joint liability acknowledgment.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit} disabled={!canSubmit}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.nextBtnText}>Join as Seller 🎉</Text>
            }
          </TouchableOpacity>
          </>
        )}
      </View>

      {/* OTP Verification Modal */}
      <Modal
        visible={showOtpModal}
        animationType="slide"
        transparent
        statusBarTranslucent={false}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end'
          }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 6 }}>Verify Phone Number</Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Enter the 6-digit OTP sent to +91 {phone}</Text>
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                {vendorOtp.map((digit, index) => (
                  <View
                    key={index}
                    pointerEvents="none"
                    style={{
                      flex: 1,
                      height: 56,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: digit ? '#1669ef' : '#E5E7EB',
                      backgroundColor: digit ? '#eff6ff' : '#F9FAFB',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 22, fontWeight: '700', color: '#111' }}>
                      {digit}
                    </Text>
                  </View>
                ))}
              </View>
              <TextInput
                value={vendorOtp.join('')}
                onChangeText={val => {
                  const digits = val.replace(/[^0-9]/g, '').slice(0, 6);
                  setVendorOtp(Array.from({ length: 6 }, (_, i) => digits[i] || ''));
                }}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                caretHidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 56,
                  opacity: 0.01,
                }}
                accessibilityLabel="Enter six digit verification code"
              />
            </View>
            <TouchableOpacity
              style={{ backgroundColor: '#1669ef', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12 }}
              onPress={handleVerifyAndRegisterShop}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Verify & Register Shop</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowOtpModal(false)}>
              <Text style={{ textAlign: 'center', color: '#888', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff6ff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#dbeafe', backgroundColor: '#eff6ff',
  },
  backBtn:  { padding: 4, width: 60 },
  backText: { color: '#1669ef', fontSize: 15, fontWeight: '600' },
  logoIconBox: { width: 160, height: 40 },
  tabRow: {
    flexDirection: 'row', margin: 16, borderRadius: 14,
    backgroundColor: '#E5E7EB', padding: 4,
  },
  tabActive: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  tabActiveText:   { fontWeight: '700', color: '#1669ef', fontSize: 14 },
  tabInactive:     { flex: 1, padding: 10, alignItems: 'center' },
  tabInactiveText: { color: '#888', fontSize: 14, fontWeight: '500' },
  stepContent:  { flex: 1, paddingHorizontal: 16 },
  stepTitle:    { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: 16, marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: '#888', marginBottom: 12 },
  progressRow:  { flexDirection: 'row', gap: 6, marginBottom: 20, height: 5 },
  progressDot:  { height: 5, borderRadius: 3 },
  label: { fontSize: 13, color: '#444', fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 13, fontSize: 15, marginBottom: 12, backgroundColor: '#F9FAFB', color: '#111',
  },
  inputFilled: { borderColor: '#1669ef', backgroundColor: '#eff6ff' },
  row:         { flexDirection: 'row', gap: 12 },
  halfField:   { flex: 1 },
  passwordWrapper: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
    borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#F9FAFB',
    marginBottom: 12, overflow: 'hidden',
  },
  passwordInput: { flex: 1, padding: 13, fontSize: 15, color: '#111' },
  eyeButton:     { paddingHorizontal: 14, paddingVertical: 13 },
  eyeText:       { fontSize: 13, color: '#1669ef', fontWeight: '600' },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1.5,
    borderColor: '#1669ef', padding: 12, marginBottom: 10,
  },
  gpsBtnText:       { fontSize: 14, color: '#1669ef', fontWeight: '600' },
  townDetected: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#dcfce7', borderRadius: 10, padding: 10, marginBottom: 12,
  },
  townDetectedText: { fontSize: 13, color: '#16A34A', fontWeight: '600' },
  townDetectedSub:  { fontSize: 11, color: '#16A34A', marginTop: 2 },
  townClear:        { fontSize: 18, color: '#EF4444', fontWeight: '700', paddingHorizontal: 8 },
  townManual: {
    backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10,
    marginBottom: 12, borderWidth: 1, borderColor: '#FED7AA',
  },
  townManualText:  { fontSize: 13, color: '#EA580C', fontWeight: '500' },
  categoryGrid:    { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, marginBottom: 12 },
  categoryCard: {
    flex: 1,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 10, alignItems: 'center', backgroundColor: '#F9FAFB',
  },
  categoryCardActive:  { borderColor: '#1669ef', backgroundColor: '#eff6ff' },
  categoryIconBox:     { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  categoryLabel:       { fontSize: 11, color: '#555', fontWeight: '600', textAlign: 'center' },
  categoryLabelActive: { color: '#1669ef' },
  feeInfo: {
    backgroundColor: '#eff6ff', borderRadius: 10, padding: 10,
    marginBottom: 12, borderWidth: 1, borderColor: '#bfdbfe',
  },
  feeInfoText:  { fontSize: 13, color: '#1669ef' },
  optionalNote: {
    backgroundColor: '#fefce8', borderRadius: 10, padding: 10,
    marginTop: 4, borderWidth: 1, borderColor: '#fde68a',
  },
  optionalNoteText: { fontSize: 12, color: '#854d0e' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 10, padding: 10, alignItems: 'center', backgroundColor: '#F9FAFB',
  },
  toggleBtnActive:     { borderColor: '#1669ef', backgroundColor: '#1669ef' },
  toggleBtnText:       { fontSize: 12, color: '#555', fontWeight: '600' },
  toggleBtnTextActive: { color: '#fff' },

  // ── Delivery Radius ──────────────────────────────────────────────────────────
  radiusSubLabel: { fontSize: 12, color: '#888', marginBottom: 10, marginTop: -4 },
  radiusRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  radiusChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  radiusChipActive:     { borderColor: '#1669ef', backgroundColor: '#1669ef' },
  radiusChipText:       { fontSize: 13, fontWeight: '700', color: '#555' },
  radiusChipTextActive: { color: '#fff' },
  radiusInfo: {
    backgroundColor: '#eff6ff', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#bfdbfe',
  },
  radiusInfoText: { fontSize: 13, color: '#1669ef', lineHeight: 18 },
  // ────────────────────────────────────────────────────────────────────────────

  weeklyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  dayBtn: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F9FAFB',
  },
  dayBtnActive:     { backgroundColor: '#1669ef', borderColor: '#1669ef' },
  dayBtnText:       { fontSize: 13, color: '#555' },
  dayBtnTextActive: { color: '#fff', fontWeight: '600' },
  reviewCard: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0',
  },
  reviewSection: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 8 },
  reviewRow:     { fontSize: 13, color: '#555', marginBottom: 4 },
  reviewKey:     { fontWeight: '600', color: '#333' },
  approvalNote:  { backgroundColor: '#dcfce7', borderRadius: 12, padding: 14, marginBottom: 20 },
  approvalText:  { fontSize: 13, color: '#16A34A', lineHeight: 18, fontWeight: '500' },
  footer: {
    padding: 16, paddingBottom: 30,
    borderTopWidth: 1, borderTopColor: '#dbeafe', backgroundColor: '#eff6ff',
  },
  nextBtn:           { backgroundColor: '#1669ef', padding: 16, borderRadius: 14, alignItems: 'center' },
  submitBtn:         { backgroundColor: '#16A34A', padding: 16, borderRadius: 14, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#93c5fd' },
  submitBtnDisabled: { backgroundColor: '#93c5fd' },
  nextBtnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { paddingVertical: 12, alignItems: 'center' },
  skipBtnText: { color: '#1669ef', fontSize: 14, fontWeight: '600' },
});