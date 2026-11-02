import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName]           = useState('');
  const [phone, setPhone]                 = useState('');
  const [otp, setOtp]                     = useState(['', '', '', '', '', '']);
  const [step, setStep]                   = useState(1);
  const [loading, setLoading]             = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resendTimer, setResendTimer]     = useState(30);
  const [canResend, setCanResend]         = useState(false);
  const otpInputRef = useRef(null);
  const { loginWithTokens } = useAuth();

  const startTimer = () => {
    setResendTimer(30);
    setCanResend(false);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    if (!fullName.trim()) return Alert.alert('Error', 'Please enter your full name');
    if (phone.length !== 10) return Alert.alert('Error', 'Enter a valid 10-digit number');
    if (!agreedToTerms) return Alert.alert('Error', 'Please agree to Terms & Conditions');
    setLoading(true);
    try {
      await client.post('/users/send-register-otp/', {
        phone_number: phone,
        full_name: fullName,
        user_type: 'buyer',
      });
      setStep(2);
      startTimer();
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to send OTP. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtp(Array.from({ length: 6 }, (_, i) => digits[i] || ''));
  };

  const handleVerifyAndRegister = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) return Alert.alert('Error', 'Please enter the complete OTP');
    setLoading(true);
    try {
      const res = await client.post('/users/verify-register-otp/', {
        phone_number: phone,
        otp: otpCode,
        full_name: fullName,
        user_type: 'buyer',
      });
      await loginWithTokens(res.data.tokens, res.data.user);
      navigation.replace('TownSelection');
    } catch (e) {
      const msg = e.response?.data?.error || 'Incorrect OTP. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setLoading(true);
    try {
      await client.post('/users/send-register-otp/', { phone_number: phone, full_name: fullName, user_type: 'buyer' });
      setOtp(['', '', '', '', '', '']);
      startTimer();
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (e) {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.logoSection}>
          <Image source={require('../../../assets/app-logo-full.png')} style={styles.logoImage} resizeMode="contain" />
        </View>

        <View style={styles.toggleContainer}>
          <TouchableOpacity style={[styles.toggleBtn, styles.toggleBtnActiveBuyer]}>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <Ionicons name="cart-outline" size={16} color="#1669ef" />
              <Text style={[styles.toggleText, styles.toggleTextActiveBuyer]}>Buyer</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleBtn} onPress={() => navigation.navigate('VendorRegister')}>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <Ionicons name="storefront-outline" size={16} color="#6B7280" />
              <Text style={styles.toggleText}>Seller</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {step === 1 ? (
            <>
              <Text style={styles.title}>Create Buyer Account</Text>
              <Text style={styles.subtitle}>Order from local shops near you</Text>

              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.inputFull}
                placeholder="Enter your full name"
                placeholderTextColor="#9CA3AF"
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputPrefix}>+91</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10-digit number"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreedToTerms(!agreedToTerms)} activeOpacity={0.7}>
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                  {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxText}>
                  I agree to Univerin's <Text style={styles.checkboxLink} onPress={() => navigation.navigate('TermsAndConditions')}>Terms & Conditions</Text> and <Text style={styles.checkboxLink} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, (loading || !agreedToTerms) && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading || !agreedToTerms}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Login</Text></Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('DPRegister')} style={{ marginTop: 10 }}>
                <Text style={styles.link}>Want to deliver with Univerin? <Text style={styles.linkBold}>Register as a Delivery Partner</Text></Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Verify Phone</Text>
              <Text style={styles.subtitle}>We sent a 6-digit OTP to{String.fromCharCode(10)}+91 {phone}</Text>

              <View style={styles.otpRow}>
                {otp.map((digit, index) => (
                  <View
                    key={index}
                    style={[
                      styles.otpBox,
                      digit && styles.otpBoxFilled,
                      { alignItems: 'center', justifyContent: 'center' },
                    ]}
                    pointerEvents="none"
                  >
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#111' }}>
                      {digit}
                    </Text>
                  </View>
                ))}
                <TextInput
                  ref={otpInputRef}
                  style={styles.otpHiddenInput}
                  value={otp.join('')}
                  onChangeText={handleOtpChange}
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  caretHidden
                />
              </View>

              <TouchableOpacity
                style={[styles.button, (loading || otp.join('').length !== 6) && styles.buttonDisabled]}
                onPress={handleVerifyAndRegister}
                disabled={loading || otp.join('').length !== 6}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Create Account</Text>}
              </TouchableOpacity>

              <View style={styles.resendRow}>
                <Text style={styles.resendText}>Didn't receive OTP? </Text>
                {canResend ? (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.resendTimer}>Resend in {resendTimer}s</Text>
                )}
              </View>

              <TouchableOpacity onPress={() => { setStep(1); setOtp(['','','','','','']); }}>
                <Text style={styles.link}>Wrong number? <Text style={styles.linkBold}>Go Back</Text></Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff6ff' },
  otpHiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.01,
    color: 'transparent',
  },
  inner: { flexGrow: 1, alignItems: 'center', padding: 24, paddingTop: 60 },
  logoSection: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: 24,
    alignItems: 'center', justifyContent: 'center',
    width: '100%', marginBottom: 24,
    borderWidth: 1.5, borderColor: '#dbeafe',
    shadowColor: '#1669ef', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  logoImage: { width: 220, height: 70 },
  toggleContainer: {
    flexDirection: 'row', backgroundColor: '#E5E7EB',
    borderRadius: 14, padding: 4, width: '100%', marginBottom: 20,
  },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActiveBuyer: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
  toggleText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  toggleTextActiveBuyer: { color: '#1669ef', fontWeight: '700' },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    width: '100%', shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, backgroundColor: '#F9FAFB',
    marginBottom: 14, overflow: 'hidden',
  },
  inputPrefix: {
    paddingHorizontal: 12, fontSize: 14, color: '#555',
    borderRightWidth: 1, borderRightColor: '#E5E7EB', paddingVertical: 14,
  },
  input: { flex: 1, padding: 14, fontSize: 15, color: '#111' },
  inputFull: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, fontSize: 15, marginBottom: 14,
    backgroundColor: '#F9FAFB', color: '#111',
  },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
  otpBox: { width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', fontSize: 22, fontWeight: '700', color: '#111', textAlign: 'center' },
  otpBoxFilled: { borderColor: '#1669ef', backgroundColor: '#eff6ff' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  resendText: { fontSize: 13, color: '#888' },
  resendLink: { fontSize: 13, color: '#1669ef', fontWeight: '700' },
  resendTimer: { fontSize: 13, color: '#9CA3AF' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginTop: 1, flexShrink: 0 },
  checkboxChecked: { backgroundColor: '#1669ef', borderColor: '#1669ef' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  checkboxText: { flex: 1, fontSize: 13, color: '#555', lineHeight: 20 },
  checkboxLink: { color: '#1669ef', fontWeight: '600' },
  button: { backgroundColor: '#1669ef', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 16, marginTop: 4 },
  buttonDisabled: { backgroundColor: '#bfdbfe' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: '#555', fontSize: 14 },
  linkBold: { color: '#1669ef', fontWeight: '700' },
});
