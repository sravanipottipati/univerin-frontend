import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '../context/CartContext';
import HomeScreen from '../screens/buyer/HomeScreen';
import CartScreen from '../screens/buyer/CartScreen';
import MyOrdersScreen from '../screens/buyer/MyOrdersScreen';
import ProfileScreen from '../screens/buyer/ProfileScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Home', label: 'Home', icon: 'home' },
  { name: 'Cart', label: 'Cart', icon: 'cart' },
  { name: 'MyOrders', label: 'Orders', icon: 'receipt' },
  { name: 'Profile', label: 'Profile', icon: 'person' },
];

function BuyerTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { cartCount } = useCart();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      {TABS.map((tab, index) => {
        const active = state.routes[state.index]?.name === tab.name;
        const badge = tab.name === 'Cart' ? cartCount : 0;

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[index].key,
                canPreventDefault: true,
              });

              if (!active && !event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            }}
          >
            <View>
              <Ionicons
                name={active ? tab.icon : `${tab.icon}-outline`}
                size={25}
                color={active ? '#1669ef' : '#9CA3AF'}
              />
              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badge > 99 ? '99+' : badge}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, active && styles.activeLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function BuyerTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <BuyerTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        sceneStyle: { backgroundColor: '#F8F9FA' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="MyOrders" component={MyOrdersScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: 4,
  },
  label: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  activeLabel: {
    color: '#1669ef',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
