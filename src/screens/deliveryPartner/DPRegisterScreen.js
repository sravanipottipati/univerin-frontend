import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DPRegisterScreen({ navigation }) {
  const [fullName, setFullName]           = useState('');
  const [phone, setPhone]                 = useState('');
  const [otp, setOtp]                     = useState(['', '', '', '', '', '']);
  const [step, setStep]                   = useState(1);
  const [loading, setLoading]             = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resendTimer, setResendTimer]     = useState(30);
  const [canResend, setCanResend]         = useState(false);
  const canSendOTP =
    fullName.trim().length > 0 &&
    /^[0-9]{10}$/.test(phone) &&
    agreedToTerms &&
    !loading;

  const otpRefs = useRef([]);
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
        user_type: 'delivery_partner',
      });
      setStep(2);
      startTimer();
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to send OTP. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val, index) => {
    const digitsOnly = val.replace(/[^0-9]/g, '');
    if (digitsOnly.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) newOtp[i] = digitsOnly[i] || '';
      setOtp(newOtp);
      otpRefs.current[Math.min(digitsOnly.length - 1, 5)]?.focus();
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = digitsOnly;
    setOtp(newOtp);
    if (digitsOnly && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0)
      otpRefs.current[index - 1]?.focus();
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
        user_type: 'delivery_partner',
      });
      await loginWithTokens(res.data.tokens, res.data.user);
      navigation.replace('DPVehicleDetails');
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
      await client.post('/users/send-register-otp/', {
        phone_number: phone,
        full_name: fullName,
        user_type: 'delivery_partner',
      });
      setOtp(['', '', '', '', '', '']);
      startTimer();
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (e) {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.logoSection}>
          <Image source={require('../../../assets/app-logo-full.png')} style={styles.logoImage} resizeMode="contain" />
        </View>

        <View style={styles.card}>
          {step === 1 ? (
            <>
              <Text style={styles.title}>Become a Delivery Partner</Text>
              <Text style={styles.subtitle}>Deliver orders and earn with Univerin</Text>

              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.phoneRow}>
                <Text style={styles.phonePrefix}>+91</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="10-digit mobile number"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
                />
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
              >
                <Ionicons
                  name={agreedToTerms ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={agreedToTerms ? '#1669ef' : '#9CA3AF'}
                />
                <Text style={styles.checkboxText}>
                  I agree to the Terms &amp; Conditions and Delivery Partner Agreement
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, !canSendOTP && styles.btnDisabled]}
                onPress={handleSendOTP}
                disabled={!canSendOTP}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send OTP</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Already have an account? Login</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Verify OTP</Text>
              <Text style={styles.subtitle}>Enter the 6-digit code sent to +91 {phone}</Text>

              <View style={styles.otpRow}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (otpRefs.current[index] = ref)}
                    style={styles.otpBox}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(val) => handleOtpChange(val, index)}
                    onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleVerifyAndRegister}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify &amp; Continue</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleResend} disabled={!canResend}>
                <Text style={styles.resendText}>
                  {canResend ? 'Resend OTP' : `Resend OTP in ${resendTimer}s`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep(1)}>
                <Text style={styles.backLink}>Wrong number? Go Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff6ff' },
  keyboardContainer: { flex: 1 },
  inner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, justifyContent: 'flex-start' },
  logoSection: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 22,
    borderWidth: 1.5,
    borderColor: '#dbeafe',
    shadowColor: '#1669ef',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  logoImage: { width: 260, height: 76, maxWidth: '100%' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 5, marginTop: 10 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827',
  },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14,
  },
  phonePrefix: { fontSize: 15, color: '#6B7280', marginRight: 8 },
  phoneInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#111827' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 },
  checkboxText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  primaryBtn: {
    backgroundColor: '#1669ef', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  loginLink: { textAlign: 'center', color: '#1669ef', fontSize: 13, marginTop: 12, fontWeight: '600' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  otpBox: {
    width: 44, height: 52, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#111827',
  },
  resendText: { textAlign: 'center', color: '#1669ef', fontSize: 13, marginTop: 16, fontWeight: '600' },
  backLink: { textAlign: 'center', color: '#6B7280', fontSize: 13, marginTop: 12 },
});