import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import client from './src/api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (e) {
    console.log('Push token error:', e.message);
    return null;
  }
}
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import DPRegisterScreen from './src/screens/deliveryPartner/DPRegisterScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';

import HomeScreen from './src/screens/buyer/HomeScreen';
import ShopDetailScreen from './src/screens/buyer/ShopDetailScreen';
import CheckoutScreen from './src/screens/buyer/CheckoutScreen';
import MyOrdersScreen from './src/screens/buyer/MyOrdersScreen';
import OrderSuccessScreen from './src/screens/buyer/OrderSuccessScreen';
import ProfileScreen from './src/screens/buyer/ProfileScreen';
import EditProfileScreen from './src/screens/buyer/EditProfileScreen';
import NotificationsScreen from './src/screens/buyer/NotificationsScreen';
import WishlistScreen from './src/screens/buyer/WishlistScreen';
import AddressScreen from './src/screens/buyer/AddressScreen';
import HelpSupportScreen from './src/screens/buyer/HelpSupportScreen';
import SearchScreen from './src/screens/buyer/SearchScreen';
import OrderDetailScreen from './src/screens/buyer/OrderDetailScreen';
import TownSelectionScreen from './src/screens/buyer/TownSelectionScreen';
import CartScreen from './src/screens/buyer/CartScreen';
import PrivacyPolicyScreen from './src/screens/buyer/PrivacyPolicyScreen';
import AdminScreen from './src/screens/buyer/AdminScreen';
import AdminFSSAIScreen from './src/screens/buyer/AdminFSSAIScreen';
import TermsAndConditionsScreen from './src/screens/buyer/TermsAndConditionsScreen';
import RefundPolicyScreen from './src/screens/buyer/RefundPolicyScreen';
import ContactUsScreen from './src/screens/buyer/ContactUsScreen';
import RateOrderScreen from './src/screens/buyer/RateOrderScreen';
import MapPickerScreen from './src/screens/buyer/MapPickerScreen';
import VendorMapPickerScreen from './src/screens/vendor/VendorMapPickerScreen';
import ReturnOrderScreen from './src/screens/buyer/ReturnOrderScreen';

import VendorHomeScreen from './src/screens/vendor/VendorHomeScreen';
import DPHomeScreen from './src/screens/deliveryPartner/DPHomeScreen';
import DPVehicleDetailsScreen from './src/screens/deliveryPartner/DPVehicleDetailsScreen';
import DPDocumentUploadScreen from './src/screens/deliveryPartner/DPDocumentUploadScreen';
import DPPendingVerificationScreen from './src/screens/deliveryPartner/DPPendingVerificationScreen';
import DPOrderOfferScreen from './src/screens/deliveryPartner/DPOrderOfferScreen';
import DPActiveOrderScreen from './src/screens/deliveryPartner/DPActiveOrderScreen';
import DPDeliveryOtpScreen from './src/screens/deliveryPartner/DPDeliveryOtpScreen';
import DPProfileScreen from './src/screens/deliveryPartner/DPProfileScreen';
import DPHelpScreen from './src/screens/deliveryPartner/DPHelpScreen';
import DPEarningsScreen from './src/screens/deliveryPartner/DPEarningsScreen';
import DPNotificationsScreen from './src/screens/deliveryPartner/DPNotificationsScreen';
import VendorOrdersScreen from './src/screens/vendor/VendorOrdersScreen';
import VendorOrderDetailScreen from './src/screens/vendor/VendorOrderDetailScreen';
import VendorProductsScreen from './src/screens/vendor/VendorProductsScreen';
import VendorAddProductScreen from './src/screens/vendor/VendorAddProductScreen';
import VendorEditProductScreen from './src/screens/vendor/VendorEditProductScreen';
import VendorWalletScreen from './src/screens/vendor/VendorWalletScreen';
import VendorProfileScreen from './src/screens/vendor/VendorProfileScreen';
import VendorRegisterScreen from './src/screens/vendor/VendorRegisterScreen';
import VendorNotificationsScreen from './src/screens/vendor/VendorNotificationsScreen';
import VendorEditShopScreen from './src/screens/vendor/VendorEditShopScreen';
import VendorHelpScreen from './src/screens/vendor/VendorHelpScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useAuth();
  console.log('[NAV] Current user:', user?.user_type ?? 'GUEST');

  useEffect(() => {
    if (!user) return;
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        client.post('/users/save-push-token/', { push_token: token })
          .catch(e => console.log('Save push token error:', e.message));
      }
    });
  }, [user?.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  const getInitialRoute = () => {
    if (!user) return 'Login';
    if (user.user_type === 'vendor') return 'VendorHome';
    if (user.user_type === 'delivery_partner') return 'DPHome';
    if (user.user_type === 'buyer' && !user.town) return 'TownSelection';
    return 'Home';
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={getInitialRoute()}
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        {/* ── Auth ── */}
        <Stack.Screen name="Login"          component={LoginScreen} />
        <Stack.Screen name="Register"       component={RegisterScreen} />
        <Stack.Screen name="DPRegister"     component={DPRegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

        {/* ── Buyer ── */}
        <Stack.Screen name="Home"          component={HomeScreen} />
        <Stack.Screen name="ShopDetail"    component={ShopDetailScreen} />
        <Stack.Screen name="Checkout"      component={CheckoutScreen} />
        <Stack.Screen name="MyOrders"      component={MyOrdersScreen} />
        <Stack.Screen name="OrderSuccess"  component={OrderSuccessScreen} />
        <Stack.Screen name="Profile"       component={ProfileScreen} />
        <Stack.Screen name="EditProfile"   component={EditProfileScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Wishlist"      component={WishlistScreen} />
        <Stack.Screen name="Address"       component={AddressScreen} options={{ animation: "slide_from_right", tabBarVisible: false }} />
        <Stack.Screen name="HelpSupport"   component={HelpSupportScreen} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Search"        component={SearchScreen} />
        <Stack.Screen name="OrderDetail"   component={OrderDetailScreen} />
        <Stack.Screen name="TownSelection" component={TownSelectionScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="AdminFSSAI" component={AdminFSSAIScreen} />
        <Stack.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} />
        <Stack.Screen name="VendorMapPicker" component={VendorMapPickerScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MapPicker" component={MapPickerScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="RateOrder"        component={RateOrderScreen} />
        <Stack.Screen name="ReturnOrder"      component={ReturnOrderScreen} />
        <Stack.Screen name="RefundPolicy" component={RefundPolicyScreen} />
        <Stack.Screen name="ContactUs" component={ContactUsScreen} />

        {/* ── Vendor ── */}
        <Stack.Screen name="VendorHome"          component={VendorHomeScreen} />
        <Stack.Screen name="DPHome"               component={DPHomeScreen} />
        <Stack.Screen name="DPVehicleDetails"      component={DPVehicleDetailsScreen} />
        <Stack.Screen name="DPDocumentUpload"      component={DPDocumentUploadScreen} />
        <Stack.Screen name="DPPendingVerification" component={DPPendingVerificationScreen} />
        <Stack.Screen name="DPOrderOffer"  component={DPOrderOfferScreen} />
        <Stack.Screen name="DPActiveOrder" component={DPActiveOrderScreen} />
        <Stack.Screen name="DPDeliveryOtp" component={DPDeliveryOtpScreen} />
        <Stack.Screen name="DPProfile" component={DPProfileScreen} />
        <Stack.Screen name="DPHelp"    component={DPHelpScreen} />
        <Stack.Screen name="DPEarnings" component={DPEarningsScreen} />
        <Stack.Screen name="DPNotifications" component={DPNotificationsScreen} />
        <Stack.Screen name="VendorOrders"        component={VendorOrdersScreen} />
        <Stack.Screen name="VendorOrderDetail"   component={VendorOrderDetailScreen} />
        <Stack.Screen name="VendorProducts"      component={VendorProductsScreen} />
        <Stack.Screen name="VendorAddProduct"    component={VendorAddProductScreen} />
        <Stack.Screen name="VendorEditProduct"   component={VendorEditProductScreen} />
        <Stack.Screen name="VendorWallet"        component={VendorWalletScreen} />
        <Stack.Screen name="VendorProfile"       component={VendorProfileScreen} />
        <Stack.Screen name="VendorRegister"      component={VendorRegisterScreen} />
        <Stack.Screen name="VendorNotifications" component={VendorNotificationsScreen} />
        <Stack.Screen name="VendorHelp"          component={VendorHelpScreen} />
        <Stack.Screen name="VendorEditShop"      component={VendorEditShopScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppNavigator />
      </CartProvider>
    </AuthProvider>
  );
}