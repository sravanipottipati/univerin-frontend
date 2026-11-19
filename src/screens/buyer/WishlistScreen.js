import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useCart } from '../../context/CartContext';

export default function WishlistScreen({ navigation }) {
  const [wishlist, setWishlist]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addToCart } = useCart();

  const fetchWishlist = async () => {
    try {
      const res = await client.get('/vendors/wishlist/');
      setWishlist(res.data.wishlist || []);
    } catch (e) {
      console.log('Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchWishlist(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchWishlist(); };

  const handleRemove = async (productId, name) => {
    Alert.alert('Remove', `Remove "${name}" from wishlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          // Remove from UI instantly
          setWishlist(prev => prev.filter(item => item.product_id !== productId));
          // Sync with backend in background
          client.post('/vendors/wishlist/', { product_id: productId }).catch((e) => {
            console.log('Wishlist remove error:', e.message);
          });
        },
      },
    ]);
  };

  const handleAddToCart = (item) => {
    if (!item.is_available) {
      Alert.alert('Out of Stock', 'This item is currently not available');
      return;
    }
    const product = {
      id:        item.product_id,
      name:      item.name,
      price:     item.price,
      image_url: item.image_url || null,
      category:  item.category || 'other',
    };
    const shop = {
      id:        item.shop_id,
      shop_name: item.shop_name,
      town:      item.town,
    };
    addToCart(product, shop);
    Alert.alert('Added! 🛒', `${item.name} added to cart`, [
      { text: 'View Cart', onPress: () => navigation.navigate('BuyerTabs', { screen: 'Cart' }) },
      { text: 'OK', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={{ width: 36 }} />
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{wishlist.length}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1669ef" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16 }}
        >
          {wishlist.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>❤️</Text>
              <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
              <Text style={styles.emptySubtitle}>
                Save products you love by tapping ♡ on any product
              </Text>
              <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Home' })}>
                <Text style={styles.shopBtnText}>Browse Shops</Text>
              </TouchableOpacity>
            </View>
          ) : (
            wishlist.map(item => (
              <View key={item.id} style={styles.productCard}>

                {/* Top row */}
                <TouchableOpacity
                  style={styles.productTop}
                  onPress={() => navigation.navigate('ShopDetail', { vendorId: item.shop_id })}
                >
                  {/* Image */}
                  <View style={styles.productImageBox}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.productImage}
                        resizeMode="cover"
                        onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                      />
                    ) : (
                      <View style={[styles.productImage, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 28 }}>🛍️</Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.shopName}>🏪 {item.shop_name}</Text>
                    <Text style={styles.townName}>📍 {item.town}</Text>
                    <View style={[styles.availBadge, { backgroundColor: item.is_available ? '#DCFCE7' : '#F3F4F6' }]}>
                      <Text style={[styles.availText, { color: item.is_available ? '#16A34A' : '#9CA3AF' }]}>
                        {item.is_available ? '● In Stock' : '● Out of Stock'}
                      </Text>
                    </View>
                  </View>

                  {/* Price + Remove */}
                  <View style={styles.productRight}>
                    <Text style={styles.productPrice}>₹{item.price}</Text>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemove(item.product_id, item.name)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {/* Add to Cart Button */}
                <TouchableOpacity
                  style={[
                    styles.addToCartBtn,
                    !item.is_available && styles.addToCartBtnDisabled,
                  ]}
                  onPress={() => handleAddToCart(item)}
                  disabled={!item.is_available}
                >
                  <Ionicons
                    name="cart-outline"
                    size={16}
                    color={item.is_available ? '#1669ef' : '#9CA3AF'}
                  />
                  <Text style={[
                    styles.addToCartBtnText,
                    !item.is_available && { color: '#9CA3AF' },
                  ]}>
                    {item.is_available ? 'Add to Cart' : 'Out of Stock'}
                  </Text>
                </TouchableOpacity>

              </View>
            ))
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
      {/* Bottom Tab */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: 20, paddingTop: 10, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Home' })}>
          <Ionicons name="home-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Cart' })}>
          <Ionicons name="cart-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'MyOrders' })}>
          <Ionicons name="receipt-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Profile' })}>
          <Ionicons name="person-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  countBadge:  { backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText:   { fontSize: 13, color: '#1669ef', fontWeight: 'bold' },

  emptyState:    { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyEmoji:    { fontSize: 52, marginBottom: 12 },
  emptyTitle:    { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  shopBtn:       { backgroundColor: '#1669ef', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  shopBtnText:   { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  productCard: {
    backgroundColor: '#fff', borderRadius: 14,
    marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  productTop:      { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  productImageBox: {
    width: 60, height: 60, borderRadius: 12,
    backgroundColor: '#eff6ff', justifyContent: 'center',
    alignItems: 'center', overflow: 'hidden',
  },
  productImage:  { width: 60, height: 60 },
  productInfo:   { flex: 1 },
  productName:   { fontSize: 14, fontWeight: 'bold', color: '#111', marginBottom: 3 },
  shopName:      { fontSize: 12, color: '#555', marginBottom: 2 },
  townName:      { fontSize: 11, color: '#888', marginBottom: 6 },
  availBadge:    { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  availText:     { fontSize: 11, fontWeight: '600' },
  productRight:  { alignItems: 'flex-end', gap: 10 },
  productPrice:  { fontSize: 16, fontWeight: 'bold', color: '#1669ef' },
  removeBtn:     { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },

  addToCartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    backgroundColor: '#F8FAFF',
  },
  addToCartBtnDisabled: { backgroundColor: '#F9FAFB' },
  addToCartBtnText:     { fontSize: 14, color: '#1669ef', fontWeight: '700' },
});