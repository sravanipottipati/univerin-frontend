import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const canSendOTP = /^[0-9]{10}$/.test(phone) && !loading;
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
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\s/g, '');
    if (cleanPhone.length !== 10) return Alert.alert('Error', 'Enter a valid 10-digit number');
    setLoading(true);
    try {
      await client.post('/users/send-login-otp/', { phone_number: cleanPhone });
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

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) return Alert.alert('Error', 'Please enter the complete OTP');
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/^\+91/, '').replace(/\s/g, '');
      const res = await client.post('/users/verify-login-otp/', {
        phone_number: cleanPhone,
        otp: otpCode,
      });
      await loginWithTokens(res.data.tokens, res.data.user);
      if (res.data.user.user_type === 'vendor') {
        navigation.replace('VendorHome');
      } else if (res.data.user.user_type === 'delivery_partner') {
        try {
          const statusRes = await client.get('/dp/onboarding/status/', {
            headers: { Authorization: `Bearer ${res.data.tokens.access}` },
          });
          const dpStatus = statusRes.data.status;
          if (dpStatus === 'approved') {
            navigation.replace('DPHome');
          } else if (dpStatus === 'pending_verification') {
            navigation.replace('DPPendingVerification');
          } else {
            navigation.replace('DPVehicleDetails');
          }
        } catch (e) {
          navigation.replace('DPVehicleDetails');
        }
      } else if (!res.data.user.town) {
        navigation.replace('TownSelection');
      } else {
        navigation.replace('Home');
      }
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
      const cleanPhone = phone.replace(/^\+91/, '').replace(/\s/g, '');
      await client.post('/users/send-login-otp/', { phone_number: cleanPhone });
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <View style={styles.logoSection}>
          <Image source={require('../../../assets/app-logo-full.png')} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={styles.card}>
          {step === 1 ? (
            <>
              <Text style={styles.title}>Welcome Back 👋</Text>
              <Text style={styles.subtitle}>Login with your phone number</Text>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputPrefix}>+91</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 10-digit phone number"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={(value) => setPhone(value.replace(/[^0-9]/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              <TouchableOpacity
                style={[styles.button, !canSendOTP && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={!canSendOTP}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.link}>New to Univerin? <Text style={styles.linkBold}>Create Account</Text></Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Enter OTP</Text>
              <Text style={styles.subtitle}>We sent a 6-digit OTP to{'\n'}+91 {phone}</Text>
              <View style={styles.otpRow}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={ref => otpRefs.current[index] = ref}
                    style={[styles.otpBox, digit && styles.otpBoxFilled]}
                    value={digit}
                    onChangeText={val => handleOtpChange(val, index)}
                    onKeyPress={e => handleOtpKeyPress(e, index)}
                    keyboardType="numeric"
                    maxLength={1}
                    textAlign="center"
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.button, (loading || otp.join('').length !== 6) && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading || otp.join('').length !== 6}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
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
  inner: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 65, paddingBottom: 24 },
  logoSection: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: 20,
    alignItems: 'center', justifyContent: 'center',
    width: '100%', marginBottom: 22,
    borderWidth: 1.5, borderColor: '#dbeafe',
    shadowColor: '#1669ef', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  logoImage: { width: 260, height: 76, maxWidth: '100%' },
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  title:    { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
  label:    { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#F9FAFB', marginBottom: 16, overflow: 'hidden',
  },
  inputPrefix: {
    paddingHorizontal: 12, fontSize: 14, color: '#555',
    borderRightWidth: 1, borderRightColor: '#E5E7EB', paddingVertical: 14,
  },
  input: { flex: 1, padding: 14, fontSize: 15, color: '#111' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
  otpBox: { width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', fontSize: 22, fontWeight: '700', color: '#111', textAlign: 'center' },
  otpBoxFilled: { borderColor: '#1669ef', backgroundColor: '#eff6ff' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  resendText: { fontSize: 13, color: '#888' },
  resendLink: { fontSize: 13, color: '#1669ef', fontWeight: '700' },
  resendTimer: { fontSize: 13, color: '#9CA3AF' },
  button: { backgroundColor: '#1669ef', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 16 },
  buttonDisabled: { backgroundColor: '#93c5fd' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link:     { textAlign: 'center', color: '#555', fontSize: 14 },
  linkBold: { color: '#1669ef', fontWeight: '700' },
});
