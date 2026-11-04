import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Image,
  Dimensions, FlatList, Alert, Platform, Linking,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import client from '../../api/client';
import { globalStore } from '../../utils/globalStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
const DEFAULT_PRODUCT_IMG = require('../../../assets/default_product.png');
import { ShopCardSkeleton } from '../../components/Skeleton';
import ProductDetailModal from '../../components/ProductDetailModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEFAULT_RADIUS = 20;
const TEAL       = '#1669ef';
const TEAL_LIGHT = '#eff6ff';
const GRAY       = '#9CA3AF';
const DARK       = '#111827';

const CATEGORIES = [
  { id: 'all',         label: 'All',          icon: 'grid',        color: '#1669ef', bg: '#eff6ff' },
  { id: 'restaurant',  label: 'Restaurant',   icon: 'restaurant',  color: '#dc2626', bg: '#FEF2F2' },
  { id: 'supermarket', label: 'Supermarket',  icon: 'storefront',  color: '#7c3aed', bg: '#F5F3FF' },
  { id: 'bakery',      label: 'Bakery',       icon: 'cafe',        color: '#d97706', bg: '#FFFBEB' },
  { id: 'veg_fruits',  label: 'Veg & Fruits', icon: 'leaf',        color: '#16a34a', bg: '#F0FDF4' },
];

// ── Subcategories shown below main categories ─────────────────────────────────
const SUBCATEGORIES = {
  vegetables: [
    { id: 'all',           label: 'All Items',    emoji: '🥦' },
    { id: 'fresh_leafies', label: 'Fresh Leafies',emoji: '🥬' },
    { id: 'fresh_veggies', label: 'Fresh Veggies',emoji: '🥕' },
  ],

  supermarket: [
    { id: 'all',            label: 'All Items',           emoji: '🛒' },
    { id: 'staples',        label: 'Staples',             emoji: '🌾' },
    { id: 'dal_pulses',     label: 'Dal & Pulses',        emoji: '🫘' },
    { id: 'oils',           label: 'Oils & Ghee',         emoji: '🫙' },
    { id: 'spices',         label: 'Spices',              emoji: '🌶' },
    { id: 'masala_powders', label: 'Masala & Powders',    emoji: '🌶' },
    { id: 'dry_fruits',     label: 'Dry Fruits & Nuts',   emoji: '🥜' },
    { id: 'snacks',         label: 'Snacks',              emoji: '🍿' },
    { id: 'beverages',      label: 'Beverages',           emoji: '🧃' },
    { id: 'dairy_eggs',     label: 'Dairy & Eggs',        emoji: '🥛' },
    { id: 'cleaning',       label: 'Cleaning',            emoji: '🧹' },
    { id: 'personal_care',  label: 'Personal Care',       emoji: '🧴' },
  ],
  restaurant: [
    { id: 'all',              label: 'All Items',       emoji: '🍽' },
    { id: 'breakfast',        label: 'Breakfast',       emoji: '🍳' },
    { id: 'lunch',            label: 'Lunch',           emoji: '🍛' },
    { id: 'dinner',           label: 'Dinner',          emoji: '🌙' },
    { id: 'vegetarian',       label: 'Veg',             emoji: '🥗' },
    { id: 'non_vegetarian',   label: 'Non-Veg',         emoji: '🍗' },
    { id: 'tiffins_snacks',   label: 'Tiffins',         emoji: '🥙' },
    { id: 'desserts_sweets',  label: 'Desserts',        emoji: '🍮' },
  ],
  bakery: [
    { id: 'all',              label: 'All Items',       emoji: '🎂' },
    { id: 'cakes',            label: 'Cakes',           emoji: '🎂' },
    { id: 'breads',           label: 'Breads',          emoji: '🍞' },
    { id: 'biscuits_cookies', label: 'Biscuits',        emoji: '🍪' },
    { id: 'puffs',            label: 'Puffs',           emoji: '🥐' },
    { id: 'sweets_mithais',   label: 'Sweets',          emoji: '🍬' },
    { id: 'pastries',         label: 'Pastries',        emoji: '🧁' },
  ],
  fast_food: [
    { id: 'all',         label: 'All Items',         emoji: '🍔' },
    { id: 'burgers',     label: 'Burgers',           emoji: '🍔' },
    { id: 'wine-outline',       label: 'Pizza',             emoji: '🍕' },
    { id: 'wraps_rolls', label: 'Wraps & Rolls',     emoji: '🌯' },
    { id: 'fries_sides', label: 'Fries & Sides',     emoji: '🍟' },
    { id: 'fried_chicken',label: 'Fried Chicken',   emoji: '🍗' },
    { id: 'combos',      label: 'Combos',            emoji: '🍱' },
  ],
  chinese: [
    { id: 'all',          label: 'All Items',         emoji: '🥡' },
    { id: 'chinese_rice', label: 'Rice',              emoji: '🍚' },
    { id: 'noodles',      label: 'Noodles',           emoji: '🍜' },
    { id: 'manchurian',   label: 'Manchurian',        emoji: '🥢' },
    { id: 'momos',        label: 'Momos',             emoji: '🥟' },
    { id: 'soups',        label: 'Soups',             emoji: '🍲' },
    { id: 'chilli_dishes',label: 'Chilli Dishes',    emoji: '🌶' },
  ],
  ice_cream: [
    { id: 'all',         label: 'All Items',          emoji: '🍦' },
    { id: 'scoops',      label: 'Scoops',             emoji: '🍨' },
    { id: 'shakes',      label: 'Shakes',             emoji: '🥤' },
    { id: 'sundaes',     label: 'Sundaes',            emoji: '🍧' },
    { id: 'kulfi',       label: 'Kulfi & Indian',     emoji: '🍡' },
    { id: 'waffles',     label: 'Waffles',            emoji: '🧇' },
    { id: 'bulk_packs',  label: 'Party Packs',        emoji: '📦' },
  ],
};

const SHOP_COLORS = ['#4CAF50', '#FF7043', '#FFA726', '#42A5F5', '#AB47BC', '#26A69A'];

const OFFERS = [
  { id: '1', tag: 'SUMMER SPECIAL',  title: 'Ice Cream',     title2: 'Every Day!',     subtitle: 'Summer Holidays = Ice Cream Delivered Daily',        icon: 'snow-outline',             bg: '#0284c7' },
  { id: '2', tag: 'BEAT THE HEAT',   title: 'Cold Drinks',   title2: 'Delivered Fast', subtitle: 'Fresh Juices & Cold Drinks from Local Shops',         icon: 'water-outline',            bg: '#0369a1' },
  { id: '3', tag: 'FARM FRESH',      title: 'Straight From', title2: 'Local Farms',    subtitle: 'Fresh Vegetables and Fruits Every Single Day',        icon: 'leaf-outline',             bg: '#14532d' },
  { id: '4', tag: 'TOO HOT TO COOK', title: 'Order Food',    title2: 'Stay Cool',      subtitle: 'Fresh Meals from Local Restaurants in Minutes',       icon: 'restaurant-outline',       bg: '#7c2d12' },
  { id: '5', tag: 'SUMMER STOCK UP', title: 'Groceries',     title2: 'Delivered Now',  subtitle: 'No More Market Trips in the Heat — Order Online',     icon: 'cart-outline',             bg: '#1254c4' },
  { id: '6', tag: 'DAILY FRESH',     title: 'Milk & Dairy',  title2: 'Every Morning',  subtitle: 'Fresh Milk, Curd & Paneer Delivered to Your Door',    icon: 'wine-outline',             bg: '#16a34a' },
  { id: '7', tag: 'SUPPORT LOCAL',   title: 'Every Order',   title2: 'Helps a Family', subtitle: 'Your Purchase Directly Supports Local Vendors',       icon: 'heart-outline',            bg: '#581c87' },
];

const TOWN_COORDS = {
  'nellore':   { lat: 14.4426, lng: 79.9865 },
  'warangal':  { lat: 17.9784, lng: 79.5941 },
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'vizag':     { lat: 17.6868, lng: 83.2185 },
  'tirupati':  { lat: 13.6288, lng: 79.4192 },
  'guntur':    { lat: 16.3067, lng: 80.4365 },
  'kadapa':    { lat: 14.4674, lng: 78.8241 },
  'default':   { lat: 14.4426, lng: 79.9865 },
};

const getTownCoords = (townName) => {
  const key = (townName || '').toLowerCase();
  return TOWN_COORDS[key] || TOWN_COORDS['default'];
};

const isCoordInIndia = (lat, lng) =>
  lat >= 6.0 && lat <= 37.0 && lng >= 68.0 && lng <= 97.0;

export default function HomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [shops, setShops]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [category, setCategory]       = useState('all');
  const [subcategory, setSubcategory] = useState('all');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [isOffline, setIsOffline]     = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [popularProducts, setPopularProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const bannerRef                     = useRef(null);
  const isFetchingRef                 = useRef(false);
  const shopRequestIdRef              = useRef(0);
  const lastFetchRef                  = useRef(null);
  const lastTownRef                   = useRef(null);
  const hasCustomLocationRef          = useRef(false);
  const [locationReady, setLocationReady] = useState(false);

  const { user }                                 = useAuth();
  const { shop: cartShop, cartCount, cartTotal, fetchCartFromDb, carts, addToCart, removeFromCart } = useCart();
  const [wishlistCount, setWishlistCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  useFocusEffect(
    React.useCallback(() => {
      client.get('/vendors/wishlist/').then(res => setWishlistCount((res.data.wishlist || []).length)).catch(() => {});
      client.get('/orders/notifications/').then(res => setUnreadCount(res.data.unread || 0)).catch(() => {});
    }, [])
  );
  const [town, setTown]                          = useState(globalStore.hasCustomLocation && globalStore.lastPickedLocation ? (globalStore.lastPickedLocation.address?.split(',').slice(0, 2).join(',') || 'Selected Location') : (user?.town || 'Nellore'));

  // Load saved location on app start
  useEffect(() => {
    AsyncStorage.getItem('lastPickedLocation').then(saved => {
      if (saved) {
        try {
          const loc = JSON.parse(saved);
          const lat = Number(loc?.lat);
          const lng = Number(loc?.lng);

          if (
            loc?.lat != null &&
            loc?.lng != null &&
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
          ) {
            const restoredLocation = { ...loc, lat, lng };
            const shortAddress =
              restoredLocation.address?.split(',').slice(0, 2).join(',') ||
              'Selected Location';

            if (restoredLocation.source === 'manual') {
              globalStore.lastPickedLocation = restoredLocation;
              globalStore.hasCustomLocation = true;
              hasCustomLocationRef.current = true;
              setTown(shortAddress);
            } else {
              globalStore.lastPickedLocation = null;
              globalStore.hasCustomLocation = false;
              hasCustomLocationRef.current = false;
            }
          } else {
            console.log('Saved location has invalid coordinates');
          }
        } catch (e) { console.log('Location parse error:', e); }
      }
    }).catch(e => {
      console.log('Location restore error:', e);
    }).finally(() => {
      setLocationReady(true);
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex(prev => {
        const next = (prev + 1) % OFFERS.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const fetchPopularProducts = async (t) => {
    try {
      const res = await client.get(`/vendors/popular-products/?town=${t || town}`);
      setPopularProducts(Array.isArray(res.data) ? res.data.slice(0, 12) : []);
    } catch (e) { console.log('Popular:', e.message); }
  };

  const fetchShops = useCallback(async (currentTown, overrideLat=null, overrideLng=null) => {
    const requestId = ++shopRequestIdRef.current;
    const isLatest = () => requestId === shopRequestIdRef.current;
    const t = currentTown || town;

    let coords = getTownCoords(t);
    const selected = globalStore.hasCustomLocation
      ? globalStore.lastPickedLocation
      : null;

    if (overrideLat != null && overrideLng != null) {
      coords = { lat: overrideLat, lng: overrideLng };
      if (isLatest()) setLocationDenied(false);
    } else if (selected?.lat != null && selected?.lng != null) {
      coords = { lat: selected.lat, lng: selected.lng };
      if (isLatest()) setLocationDenied(false);
    } else {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isLatest()) return;

        if (status !== 'granted') {
          setLocationDenied(true);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        setLocationDenied(false);

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
        if (!isLatest()) return;

        const { latitude, longitude } = loc.coords;
        if (!isCoordInIndia(latitude, longitude)) {
          console.log('GPS coordinates outside supported region');
          setLocationDenied(true);
          setShops([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        coords = { lat: latitude, lng: longitude };

        if (!globalStore.hasCustomLocation && !globalStore.lastPickedLocation) {
          try {
            const geoRes = await Location.reverseGeocodeAsync({
              latitude: coords.lat,
              longitude: coords.lng,
            });
            if (!isLatest()) return;

            const place = geoRes[0];
            const address = place
              ? [place.name, place.street, place.city, place.region, place.country]
                  .filter(Boolean).join(', ')
              : t;

            if (!globalStore.hasCustomLocation) {
              globalStore.lastPickedLocation = {
                lat: coords.lat, lng: coords.lng, address,
              };
            }
          } catch (geoErr) {
            if (isLatest() && !globalStore.hasCustomLocation) {
              globalStore.lastPickedLocation = {
                lat: coords.lat, lng: coords.lng, address: t,
              };
            }
          }
        }
      } catch (e) {
        if (!isLatest()) return;
        console.log('GPS location error:', e.message);
        setLocationDenied(true);
        setShops([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
    }

    if (!isLatest()) return;

    try {
      const params = new URLSearchParams({
        town: t,
        lat: String(coords.lat),
        lng: String(coords.lng),
        radius: String(DEFAULT_RADIUS),
      });

      const res = await client.get(`/vendors/nearby/?${params.toString()}`);
      if (!isLatest()) return;

      setIsOffline(false);
      if (Array.isArray(res.data)) setShops(res.data);
      else if (Array.isArray(res.data?.shops)) setShops(res.data.shops);
      else if (Array.isArray(res.data?.results)) setShops(res.data.results);
      else setShops([]);
    } catch (e) {
      if (!isLatest()) return;
      setShops([]);
      setIsOffline(e.message === 'Network Error' || !e.response);
    } finally {
      if (isLatest()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [town]);

  useFocusEffect(
    useCallback(() => {
      if (!locationReady) return;

      // Check device location services whenever Buyer Home opens.
      (async () => {
        try {
          const enabled = await Location.hasServicesEnabledAsync();

          if (!enabled) {
            Alert.alert(
              'Turn On Location',
              'Please enable your phone location services to find nearby shops accurately.',
              [
                { text: 'Not Now', style: 'cancel' },
                {
                  text: 'Turn On Location',
                  onPress: async () => {
                    try {
                      if (Platform.OS === 'android') {
                        await Location.enableNetworkProviderAsync();
                      } else {
                        await Linking.openURL('App-Prefs:Privacy&path=LOCATION');
                      }
                    } catch (error) {
                      Alert.alert(
                        'Location Settings',
                        'Please turn on Location Services in your phone settings.',
                        [
                          { text: 'OK' },
                          {
                            text: 'Select Manually',
                            onPress: () => navigation.navigate('TownSelection'),
                          },
                        ]
                      );
                    }
                  },
                },
              ]
            );
          }
        } catch (error) {
          console.log('Location services check:', error.message);
        }
      })();

      fetchCartFromDb();

      if (globalStore.homeLocation) {
        const loc = globalStore.homeLocation;
        globalStore.homeLocation = null;
        const shortAddress = loc.address?.split(',').slice(0, 2).join(',') || 'Selected Location';
        const isManual = loc.source === 'manual';
        hasCustomLocationRef.current = isManual;
        globalStore.hasCustomLocation = isManual;
        setLocationDenied(false);
        // Save persistently so Checkout can use it as a fallback address
        globalStore.lastPickedLocation = { lat: loc.lat, lng: loc.lng, address: loc.address };
        AsyncStorage.setItem('lastPickedLocation', JSON.stringify({ lat: loc.lat, lng: loc.lng, address: loc.address }));
        setTown(shortAddress);
        setLoading(true);
        lastTownRef.current = `${loc.lat},${loc.lng}`;
        lastFetchRef.current = Date.now();
        fetchShops(shortAddress, loc.lat, loc.lng);
        fetchPopularProducts(shortAddress);
        return;
      }

      if (globalStore.hasCustomLocation && globalStore.lastPickedLocation) {
        hasCustomLocationRef.current = true;

        const loc = globalStore.lastPickedLocation;
        const shortAddress =
          loc.address?.split(',').slice(0, 2).join(',') || 'Selected Location';

        const locationKey = `${loc.lat},${loc.lng}`;
        const now = Date.now();
        const locationChanged = lastTownRef.current !== locationKey;
        const cacheExpired =
          !lastFetchRef.current ||
          now - lastFetchRef.current > 5 * 60 * 1000;

        if (locationChanged || cacheExpired || shops.length === 0) {
          setTown(shortAddress);
          setLoading(true);

          lastTownRef.current = locationKey;
          lastFetchRef.current = now;

          fetchShops(shortAddress, loc.lat, loc.lng);
          fetchPopularProducts(shortAddress);
        }
        return;
      }

      const currentTown = user?.town || 'Nellore';
      if (currentTown !== town) setTown(currentTown);

      const now = Date.now();
      const townChanged = lastTownRef.current !== currentTown;
      const cacheExpired = !lastFetchRef.current || (now - lastFetchRef.current) > 5 * 60 * 1000;

      if (townChanged || cacheExpired || shops.length === 0) {
        if (shops.length === 0) setLoading(true);
        lastTownRef.current = currentTown;
        lastFetchRef.current = now;
        fetchShops(currentTown);
        fetchPopularProducts(currentTown);
      }
    }, [user?.town, locationReady])
  );

  const onRefresh = async () => {
    setRefreshing(true);

    const savedLocation = globalStore.hasCustomLocation
      ? globalStore.lastPickedLocation
      : null;

    if (savedLocation?.lat != null && savedLocation?.lng != null) {
      fetchShops(town, savedLocation.lat, savedLocation.lng);
    } else {
      fetchShops(town);
    }
  };

  // When category changes reset subcategory
  const handleCategorySelect = (cat) => {
    setCategory(cat);
    setSubcategory('all');
  };

  const filteredShops = shops.filter(shop =>
    category === 'all' || shop.category === category
  );

  const getShopColor = (index) => SHOP_COLORS[index % SHOP_COLORS.length];
  const activeCatColor = CATEGORIES.find(c => c.id === category)?.color || TEAL;

  const EmptyState = () => {
    if (isOffline) return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="wifi-outline" size={40} color="#9CA3AF" />
        </View>
        <Text style={styles.emptyTitle}>No Internet Connection</Text>
        <Text style={styles.emptySubtitle}>Please check your WiFi or mobile data and try again</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={16} color="#fff" />
          <Text style={styles.emptyBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="storefront-outline" size={40} color="#1669ef" />
        </View>
        <Text style={styles.emptyTitle}>No Shops Found</Text>
        <Text style={styles.emptySubtitle}>Change Location to find shops near you</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('TownSelection')}>
          <Ionicons name="location-outline" size={16} color="#fff" />
          <Text style={styles.emptyBtnText}>Change Location</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const ShopCard = ({ shop, index }) => (
    <TouchableOpacity
      style={styles.shopCard}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('ShopDetail', {
        vendorId: shop.id,
        shopName: shop.shop_name,
        distance: shop.distance,
      })}
    >
      <View style={[styles.shopThumb, { backgroundColor: getShopColor(index) }]}>
        <Ionicons
          name={CATEGORIES.find(c => c.id === shop.category)?.icon || 'storefront-outline'}
          size={32}
          color="rgba(255,255,255,0.92)"
        />
      </View>

      <View style={styles.shopCardBody}>
        <View style={styles.shopCardTop}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.shop_name}</Text>
          <View style={[styles.openBadge, { backgroundColor: shop.is_open ? '#DCFCE7' : '#FEF2F2' }]}>
            <View style={[styles.openDot, { backgroundColor: shop.is_open ? '#16A34A' : '#DC2626' }]} />
            <Text style={[styles.openBadgeText, { color: shop.is_open ? '#16A34A' : '#DC2626' }]}>
              {shop.is_open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>
        <Text style={styles.shopCategory}>
          {CATEGORIES.find(c => c.id === shop.category)?.label || shop.category}
        </Text>
        <View style={styles.shopMeta}>
          {shop.rating > 0 ? (
            <View style={styles.ratingBox}>
              <Text style={styles.ratingStars}>★</Text>
              <Text style={styles.ratingText}>{parseFloat(shop.rating).toFixed(1)}</Text>
              {shop.total_reviews > 0 && (
                <Text style={styles.reviewCount}>({shop.total_reviews})</Text>
              )}
            </View>
          ) : (
            <View style={styles.ratingBox}>
              <Text style={styles.ratingStars}>★</Text>
              <Text style={styles.ratingNew}>New</Text>
            </View>
          )}
          <Text style={styles.metaDot}>•</Text>
          <Ionicons name="location-outline" size={12} color={GRAY} />
          <Text style={styles.shopMetaText}>
            {(shop.distance === 0 || shop.distance == null) ? '0.1' : shop.distance} km
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Ionicons name="time-outline" size={12} color={GRAY} />
          <Text style={styles.shopMetaText}>
            {shop.estimated_delivery_time || 30} mins
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const TabItem = ({ iconOutline, iconFilled, label, active, onPress, badge }) => (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.tabIconWrap}>
        <Ionicons name={active ? iconFilled : iconOutline} size={25} color={active ? TEAL : GRAY} />
        {badge > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="wifi-outline" size={14} color="#fff" />
          <Text style={styles.offlineBannerText}>No internet connection</Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.deliverTo}>Deliver to</Text>
          <TouchableOpacity style={styles.locationRow} onPress={() => navigation.navigate('MapPicker', { isHomeScreen: true, onLocationSelected: null })}>
            <Ionicons name="location-sharp" size={16} color={TEAL} />
            <Text style={styles.locationText}>{town}</Text>
            <Ionicons name="chevron-down" size={16} color="#555" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Wishlist')}>
            <Ionicons name="heart-outline" size={18} color="#444" />
            {wishlistCount > 0 && (
              <View style={styles.wishlistDot} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={18} color="#444" />
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.tabBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Search')} activeOpacity={0.8}>
        <Ionicons name="search-outline" size={18} color={GRAY} />
        <Text style={styles.searchPlaceholder}>Search food, groceries & more...</Text>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} colors={[TEAL]} />}
      >
        {/* ── Banner Slider ── */}
        <FlatList
          ref={bannerRef}
          data={OFFERS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          onMomentumScrollEnd={e => {
            const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setBannerIndex(index);
          }}
          renderItem={({ item }) => (
            <View style={[styles.bannerCard, { backgroundColor: item.bg }]}>
              <View style={styles.bannerLeft}>
                <View style={styles.bannerTag}>
                  <Text style={styles.bannerTagText}>{item.tag}</Text>
                </View>
                <Text style={styles.bannerTitle}>{item.title}</Text>
                <Text style={styles.bannerTitle}>{item.title2}</Text>
                <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
              </View>
              <View style={styles.bannerIconBox}>
                <Ionicons name={item.icon} size={52} color="rgba(255,255,255,0.92)" />
              </View>
            </View>
          )}
          style={styles.bannerList}
          contentContainerStyle={{ paddingHorizontal: 0 }}
          snapToInterval={SCREEN_WIDTH}
          decelerationRate="fast"
        />

        <View style={styles.dotsRow}>
          {OFFERS.map((_, i) => (
            <View key={i} style={[styles.dot2, i === bannerIndex && styles.dotActive]} />
          ))}
        </View>

        {/* ── Main Categories ── */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat.id} style={styles.categoryItem} onPress={() => handleCategorySelect(cat.id)}>
              <View style={[
                styles.categoryCard,
                { backgroundColor: category === cat.id ? cat.color : cat.bg },
                category === cat.id && styles.categoryCardActive,
              ]}>
                <Ionicons name={cat.icon} size={28} color={category === cat.id ? '#fff' : cat.color} />
              </View>
              <Text style={[styles.categoryLabel, { color: category === cat.id ? cat.color : '#555' }, category === cat.id && { fontWeight: '700' }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>


        {popularProducts.length > 0 && (
  <View>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>⚡ Trending Now</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
      {popularProducts.map(product => (
        <TouchableOpacity key={product.id} style={styles.popularCard} onPress={() => navigation.navigate('ShopDetail', { vendorId: product.vendor_id })}>
          <View style={styles.trendingBadge}>
            <Text style={styles.trendingBadgeText}>🔥 Trending</Text>
          </View>
          <View style={styles.popularImgBox}>
            {product.image_url ? <Image source={{ uri: product.image_url }} style={styles.popularImg} resizeMode="cover" /> : <Image source={require("../../../assets/default_product.png")} style={styles.popularImg} resizeMode="contain" />}
          </View>
          <Text style={styles.popularName} numberOfLines={2}>{product.name}</Text>
          {product.variants && product.variants.length > 0 && (
            <Text style={{fontSize:10, color:'#888', marginBottom:2}}>{product.variants[0].name}</Text>
          )}
          <Text style={styles.popularShop} numberOfLines={1}>🏬 {product.shop_name}</Text>
          <View style={styles.popularBottom}>
            {(() => {
              const price = product.variants && product.variants.length > 0
                ? parseFloat(product.variants[0].price)
                : parseFloat(product.price);
              const mrp = product.variants && product.variants.length > 0
                ? parseFloat(product.variants[0].mrp || 0)
                : parseFloat(product.mrp || 0);
              const discountPct = mrp > price ? Math.round((1 - price/mrp) * 100) : 0;
              return (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.popularPrice}>From ₹{price.toFixed(0)}</Text>
                  {mrp > price && (
                    <View style={{flexDirection:'row', alignItems:'center', gap:4, marginTop: 2}}>
                      <Text style={{fontSize:11, color:'#9CA3AF', textDecorationLine:'line-through'}}>₹{mrp.toFixed(0)}</Text>
                      <Text style={{fontSize:11, color:'#16A34A', fontWeight:'700'}}>{discountPct}% OFF</Text>
                    </View>
                  )}
                </View>
              );
            })()}
            {(() => {
              const vendorId = product.vendor_id;
              const qty = carts[vendorId]?.items?.[product.id] || 0;
              if (qty > 0) {
                return (
                  <View style={styles.popularQtyControl}>
                    <TouchableOpacity style={styles.popularQtyBtn} onPress={() => removeFromCart(product, vendorId)}>
                      <Text style={styles.popularQtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.popularQtyText}>{qty}</Text>
                    <TouchableOpacity style={styles.popularQtyBtn} onPress={() => addToCart(product, { id: vendorId, shop_name: product.shop_name })}>
                      <Text style={styles.popularQtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  style={styles.popularAddBtnFull}
                  onPress={() => addToCart(product, { id: product.vendor_id, shop_name: product.shop_name })}
                >
                  <Text style={styles.popularAddBtnFullText}>ADD</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
)}

{/* ── Shops Section ── */}
        <View style={styles.sectionHeader}>
          <View style={{flexDirection:'row', alignItems:'center', gap:6, marginLeft:16}}>
            <Ionicons name="storefront-outline" size={18} color="#111" />
            <Text style={{fontSize:17, fontWeight:'bold', color:'#111'}}>Order from Local Shops</Text>
          </View>
          <Text style={styles.shopCount}>{filteredShops.length} shops</Text>
        </View>

        {locationDenied ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="location-outline" size={40} color="#1669ef" />
            </View>
            <Text style={styles.emptyTitle}>Turn On Location</Text>
            <Text style={styles.emptySubtitle}>We need your location to show nearby shops. Please allow location access or pick your location on the map.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('MapPicker', { isHomeScreen: true, onLocationSelected: null })}>
              <Ionicons name="map-outline" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Pick Location on Map</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <>{[1,2,3,4].map(i => <ShopCardSkeleton key={i} />)}</>
        ) : filteredShops.length === 0 ? (
          <EmptyState />
        ) : (
          filteredShops.map((shop, index) => (
            <ShopCard key={shop.id} shop={shop} index={index} />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>


      <ProductDetailModal product={selectedProduct} visible={showProductModal} onClose={() => setShowProductModal(false)} navigation={navigation} />

      {/* ── Bottom Tab Bar ── */}
      {isFocused && <View style={[styles.bottomTab, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TabItem iconOutline="home-outline"    iconFilled="home"    label="Home"    active={true}  onPress={() => {}} />
        <TabItem iconOutline="cart-outline"    iconFilled="cart"    label="Cart"    active={false} badge={cartCount}
          onPress={() => {
            navigation.navigate('Cart');
          }}
        />
        <TabItem iconOutline="receipt-outline" iconFilled="receipt" label="Orders"  active={false} onPress={() => navigation.navigate('MyOrders')} />
        <TabItem iconOutline="person-outline"  iconFilled="person"  label="Profile" active={false} onPress={() => navigation.navigate('Profile')} />
      </View>}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  offlineBanner: {
    backgroundColor: '#EF4444', paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  offlineBannerText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerLeft:   {},
  deliverTo:    { fontSize: 11, color: '#888', fontWeight: '500', marginBottom: 2 },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 16, fontWeight: '800', color: DARK },
  headerRight:  { flexDirection: 'row', gap: 8 },
  wishlistDot: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#EF4444', borderRadius: 5,
    width: 10, height: 10,
    borderWidth: 1.5, borderColor: '#fff',
  },
  iconBtn: { position: 'relative',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EFEFEF',
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3F4F6', borderRadius: 12,
    marginHorizontal: 16, marginVertical: 12, padding: 13,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchPlaceholder: { fontSize: 14, color: GRAY, flex: 1 },

  bannerList: { marginBottom: 8 },
  bannerCard: {
    width: SCREEN_WIDTH - 32, borderRadius: 16, padding: 20, marginHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginRight: 12, height: 110,
  },
  bannerLeft: { flex: 1 },
  bannerTag: {
    backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'flex-start',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  bannerTagText:  { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  bannerTitle:    { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4, lineHeight: 24 },
  bannerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  bannerIconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },

  dotsRow:   { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot2:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: TEAL, width: 20, borderRadius: 3 },

  categoriesRow: { paddingLeft: 16, marginBottom: 16 },
  categoryItem:  { alignItems: 'center', marginRight: 12, marginBottom: 8, width: 72 },
  categoryCard: {
    width: 64, height: 64, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  categoryCardActive: {
    shadowColor: '#1669ef', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  categoryLabel: { fontSize: 11, color: '#333', textAlign: 'center', fontWeight: '600', lineHeight: 14 },

  // ── Subcategory Chips ────────────────────────────────────────────────────────
  subCatRow: { marginBottom: 12 },
  subCatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    marginRight: 8,
  },
  subCatEmoji: { fontSize: 14 },
  subCatLabel: { fontSize: 12, color: '#555', fontWeight: '500' },

  sectionTitle: {
    fontSize: 17, fontWeight: 'bold', color: DARK,
    marginLeft: 16, marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginRight: 16, marginBottom: 12,
  },
  shopCount: { fontSize: 13, color: '#888', marginRight: 4 },

  shopCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16,
  },
  shopThumb: {
    width: 84, height: 84, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  shopCardBody:  { flex: 1 },
  shopCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 3,
  },
  shopName:      { fontSize: 15, fontWeight: 'bold', color: DARK, flex: 1, marginRight: 6 },
  openBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  openDot:       { width: 6, height: 6, borderRadius: 3 },
  openBadgeText: { fontSize: 11, fontWeight: '600' },
  shopCategory:  { fontSize: 12, color: '#888', marginBottom: 7 },
  shopMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  ratingBox:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingStars:   { fontSize: 13, color: '#F59E0B' },
  ratingText:    { fontSize: 12, fontWeight: 'bold', color: DARK },
  ratingNew:     { fontSize: 12, color: '#888' },
  reviewCount:   { fontSize: 11, color: '#888' },
  metaDot:       { fontSize: 10, color: '#D1D5DB' },
  shopMetaText:  { fontSize: 12, color: '#555' },
  shopDistance:  { fontSize: 12, color: TEAL, fontWeight: '600' },
  deliveryFree:  { fontSize: 12, color: '#16A34A', fontWeight: '600' },

  emptyState: {
    alignItems: 'center', marginTop: 60,
    paddingHorizontal: 32, paddingBottom: 20,
  },
  emptyIconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#F3F4F6', justifyContent: 'center',
    alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  emptyTitle:    { fontSize: 18, fontWeight: '800', color: DARK, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#888', marginBottom: 24, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: TEAL, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  cartBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: TEAL, marginHorizontal: 16, borderRadius: 14,
    padding: 14, position: 'absolute', bottom: 74, left: 0, right: 0,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  cartBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8,
    width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  cartBarItems:  { color: '#fff', fontSize: 13, fontWeight: '600' },
  cartBarRight:  { alignItems: 'flex-end' },
  cartBarShop:   { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 2 },
  cartBarTotal:  { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  bottomTab: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 24, paddingTop: 8,
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 10,
  },
  tabItem:        { flex: 1, alignItems: 'center', gap: 3, paddingTop: 4 },
  tabIconWrap:    { position: 'relative' },
  tabLabel:       { fontSize: 10.5, color: GRAY, fontWeight: '500' },
  tabLabelActive: { color: TEAL, fontWeight: '700' },
  headerBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#EF4444', borderRadius: 9,
    minWidth: 16, height: 16, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#fff',
  },
  tabBadge: {
    position: 'absolute', top: -5, right: -8,
    backgroundColor: '#EF4444', borderRadius: 9,
    minWidth: 16, height: 16, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#fff',
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  popularCard: { width: 140, backgroundColor: '#fff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  trendingBadge: { backgroundColor: '#ff6b35', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  trendingBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  popularImgBox: { width: '100%', height: 90, justifyContent: 'center', alignItems: 'center', marginBottom: 8, backgroundColor: '#F8F9FA', borderRadius: 10, overflow: 'hidden' },
  popularImg: { width: '100%', height: '100%' },
  popularName: { fontSize: 12, fontWeight: '600', color: '#111', marginBottom: 3, lineHeight: 16 },
  popularShop: { fontSize: 10, color: '#888', marginBottom: 6 },
  popularBottom: {},
  popularPrice: { fontSize: 14, fontWeight: '800', color: '#1669ef' },
  popularAddBtnFull: { backgroundColor: '#1669ef', borderRadius: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  popularAddBtnFullText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  popularQtyControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1669ef', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  popularQtyBtn: { paddingHorizontal: 4 },
  popularQtyBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  popularQtyText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});