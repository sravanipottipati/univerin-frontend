
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import client from '../../api/client';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep]                       = useState(1);
  const [phone, setPhone]                     = useState('');
  const [otp, setOtp]                         = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [resendTimer, setResendTimer]         = useState(30);
  const [canResend, setCanResend]             = useState(false);
  const otpInputRef = useRef(null);

  // Resend timer
  useEffect(() => {
    if (step === 2) {
      setResendTimer(30);
      setCanResend(false);
      const interval = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleSendOTP = async () => {
    if (!phone.trim() || phone.length !== 10) {
      return alert('Please enter a valid 10-digit phone number');
    }
    setLoading(true);
    try {
      await client.post('/users/forgot-password/', { phone_number: phone });
      setStep(2);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (e) {
      const msg = e.response?.data?.error || 'Phone number not found. Please check and try again.';
      alert(msg);
    } finally { setLoading(false); }
  };

  const handleOtpChange = (value) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtp(Array.from({ length: 6 }, (_, i) => digits[i] || ''));
  };

  const handleResendOTP = async () => {
    if (!canResend) return;
    setLoading(true);
    try {
      await client.post('/users/forgot-password/', { phone_number: phone });
      setOtp(['', '', '', '', '', '']);
      setResendTimer(30);
      setCanResend(false);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (e) {
      alert('Could not resend OTP. Please try again.');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) return alert('Please enter the complete OTP');
    if (!newPassword.trim() || newPassword.length < 6) return alert('Password must be at least 6 characters');
    if (newPassword !== confirmPassword) return alert('Passwords do not match');
    setLoading(true);
    try {
      await client.post('/users/reset-password/', {
        phone_number: phone, otp: otpCode, new_password: newPassword,
      });
      alert('Password Reset Successful! Please login with your new password.');
      navigation.replace('Login');
    } catch (e) {
      const msg = e.response?.data?.error || 'Reset failed. Please try again.';
      alert(msg);
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step === 1 ? navigation.goBack() : setStep(step - 1)} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Logo */}
        <View style={styles.logoSection}>
          <Image source={require('../../../assets/app-logo-full.png')} style={styles.logoImage} resizeMode="contain" />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
            <Text style={[styles.stepNum, step >= 1 && styles.stepNumActive]}>1</Text>
          </View>
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
            <Text style={[styles.stepNum, step >= 2 && styles.stepNumActive]}>2</Text>
          </View>
          <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]}>
            <Text style={[styles.stepNum, step >= 3 && styles.stepNumActive]}>3</Text>
          </View>
        </View>
        <View style={styles.stepLabels}>
          <Text style={styles.stepLabel}>Phone</Text>
          <Text style={styles.stepLabel}>OTP</Text>
          <Text style={styles.stepLabel}>Password</Text>
        </View>

        {/* ── Step 1 — Phone Number ── */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>Enter your registered phone number to receive an OTP.</Text>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit phone number"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSendOTP} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Remember password? <Text style={styles.linkBold}>Login</Text></Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 2 — OTP Input ── */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.title}>Enter OTP</Text>
            <Text style={styles.subtitle}>We sent a 6-digit OTP to{'\n'}+91 {phone}</Text>

            {/* Six visual OTP boxes backed by one autofill input */}
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
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={async () => {
                const otpCode = otp.join('').trim().replace(/[^0-9]/g, '');
                const phoneTrimmed = phone.trim();
                if (otpCode.length !== 6) return alert('Please enter complete OTP');
                setLoading(true);
                try {
                  await client.post('/users/verify-otp/', { phone_number: phoneTrimmed, otp: otpCode });
                  alert('OTP verified successfully!');
                  setStep(3);
                } catch (e) {
                  const backendMsg = e.response?.data?.error;
                  if (!e.response) {
                    // Network error - could be slow mobile data. Give helpful message.
                    alert('Connection issue. Please check your mobile data and tap Verify OTP again. If the problem continues, tap Resend OTP.');
                  } else if (backendMsg && backendMsg.toLowerCase().includes('expired')) {
                    alert('Your OTP expired. Please tap Resend OTP to get a new one.');
                  } else if (backendMsg && backendMsg.toLowerCase().includes('invalid')) {
                    alert('Incorrect OTP. Please check the SMS and try again, or tap Resend OTP.');
                  } else {
                    alert(backendMsg || 'Something went wrong. Please tap Verify OTP again.');
                  }
                } finally { setLoading(false); }
              }}
              disabled={loading || otp.join('').length !== 6}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
            </TouchableOpacity>

            {/* Resend Timer */}
            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn't receive OTP? </Text>
              {canResend ? (
                <TouchableOpacity onPress={handleResendOTP}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.resendTimer}>Resend in {resendTimer}s</Text>
              )}
            </View>

            <TouchableOpacity onPress={() => setStep(1)}>
              <Text style={styles.link}>Wrong number? <Text style={styles.linkBold}>Go Back</Text></Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 3 — New Password ── */}
        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>Create a strong password for your account.</Text>

            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Min 6 characters"
                placeholderTextColor="#9CA3AF"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirm(!showConfirm)}>
                <Text style={styles.eyeText}>{showConfirm ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.footer}>Univerin — Your local shops, delivered 🛒</Text>
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
  inner:     { flexGrow: 1, alignItems: 'center', padding: 24, paddingTop: 20 },
  header:    { width: '100%', marginBottom: 16 },
  backBtn:   { padding: 4 },
  backText:  { color: '#1669ef', fontSize: 15, fontWeight: '600' },
  logoSection: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: 24,
    alignItems: 'center', justifyContent: 'center',
    width: '100%', marginBottom: 24,
    borderWidth: 1.5, borderColor: '#dbeafe',
    shadowColor: '#1669ef', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  logoImage: { width: 220, height: 70 },
  stepRow:       { flexDirection: 'row', alignItems: 'center', width: '70%', marginBottom: 6 },
  stepDot:       { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: '#1669ef' },
  stepNum:       { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  stepNumActive: { color: 'white' },
  stepLine:      { flex: 1, height: 3, backgroundColor: '#E5E7EB', marginHorizontal: 6 },
  stepLineActive:{ backgroundColor: '#1669ef' },
  stepLabels:    { flexDirection: 'row', justifyContent: 'space-between', width: '70%', marginBottom: 20 },
  stepLabel:     { fontSize: 11, color: '#9CA3AF' },
  card:     { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  title:    { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 22, lineHeight: 20 },
  label:    { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#F9FAFB', marginBottom: 20, overflow: 'hidden' },
  inputPrefix:  { paddingHorizontal: 12, fontSize: 14, color: '#555', borderRightWidth: 1, borderRightColor: '#E5E7EB', paddingVertical: 14 },
  input:        { flex: 1, padding: 14, fontSize: 15, color: '#111' },

  // OTP boxes
  otpRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
  otpBox:     { width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', fontSize: 22, fontWeight: '700', color: '#111', textAlign: 'center' },
  otpBoxFilled: { borderColor: '#1669ef', backgroundColor: '#eff6ff' },

  // Resend
  resendRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  resendText:  { fontSize: 13, color: '#888' },
  resendLink:  { fontSize: 13, color: '#1669ef', fontWeight: '700' },
  resendTimer: { fontSize: 13, color: '#9CA3AF' },

  passwordWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#F9FAFB', marginBottom: 16, overflow: 'hidden' },
  passwordInput:   { flex: 1, padding: 14, fontSize: 15, color: '#111' },
  eyeButton:       { paddingHorizontal: 14, paddingVertical: 14 },
  eyeText:         { fontSize: 13, color: '#1669ef', fontWeight: '600' },
  button:         { backgroundColor: '#1669ef', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 16 },
  buttonDisabled: { backgroundColor: '#bfdbfe' },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  link:           { textAlign: 'center', color: '#555', fontSize: 14 },
  linkBold:       { color: '#1669ef', fontWeight: '700' },
  footer:         { fontSize: 11, color: '#9CA3AF', marginTop: 24, textAlign: 'center' },
});