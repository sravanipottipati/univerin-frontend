import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, Alert, Switch, Image, TextInput,
} from 'react-native';
import client from '../../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VendorProductsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [products, setProducts]   = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [shop, setShop] = useState(null);

  const fetchProducts = async () => {
    try {
      const shopRes = await client.get('/vendors/myshop/');
      const shopData = shopRes.data;
      setShop(shopData);
      await AsyncStorage.setItem('shop_category', shopData.category || '');
      const res     = await client.get(`/vendors/${shopData.id}/products/`);
      const data    = Array.isArray(res.data) ? res.data : res.data.products || [];
      setProducts(data);
    } catch (e) {
      console.log('Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchProducts(); };

  const handlePublish = async (productId, productName) => {
    try {
      await client.patch(`/vendors/products/${productId}/`, { is_draft: false });
      Alert.alert('Published! ✅', `"${productName}" is now live for buyers.`);
      fetchProducts();
    } catch (e) {
      Alert.alert('Error', 'Failed to publish product. Please try again.');
    }
  };

  const handleToggleAvailable = async (product) => {
    // Update UI immediately
    setProducts(prev => prev.map(p =>
      p.id === product.id ? { ...p, is_available: !p.is_available } : p
    ));
    try {
      await client.patch(`/vendors/products/${product.id}/`, {
        is_available: !product.is_available,
      });
    } catch (e) {
      // Revert on error
      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, is_available: product.is_available } : p
      ));
      Alert.alert('Error', 'Could not update product status');
    }
  };

  const handleDelete = (productId, productName) => {
    Alert.alert('Delete Product', `Delete "${productName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/vendors/products/${productId}/`);
            fetchProducts();
          } catch (e) {
            Alert.alert('Error', 'Could not delete product');
          }
        },
      },
    ]);
  };

  const filteredProducts = search
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Products</Text>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('VendorNotifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#444" />
        </TouchableOpacity>
      </View>

      {/* Add Button + Count */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('VendorAddProduct', { onGoBack: fetchProducts, shopCategory: shop?.category })}
        >
          <Text style={styles.addBtnText}>+ Add New Product</Text>
        </TouchableOpacity>
        <View style={styles.countBox}>
          <Text style={styles.countLabel}>Total Products</Text>
          <Text style={styles.countValue}>{products.length}</Text>
        </View>
      </View>


      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, gap: 8 }}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: '#111' }}
            placeholder="Search products..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
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
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyTitle}>No products yet</Text>
              <Text style={styles.emptySubtitle}>Add your first product!</Text>
              <TouchableOpacity
                style={styles.addFirstBtn}
                onPress={() => navigation.navigate('VendorAddProduct', { onGoBack: fetchProducts, shopCategory: shop?.category })}
              >
                <Text style={styles.addFirstBtnText}>+ Add Product</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredProducts.map(product => (
              <View key={product.id} style={styles.productCard}>
                {/* Product Image */}
                <View style={styles.productInfo}>
                  {(product.image_url || product.image) ? (
                    <Image
                      source={{ uri: product.image_url || product.image }}
                      style={{ width: '100%', height: 100, borderRadius: 10, marginBottom: 8, resizeMode: 'cover' }}
                    />
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    {product.is_draft && (
                      <View style={{ backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#FDE68A' }}>
                        <Text style={{ fontSize: 10, color: '#D97706', fontWeight: '700' }}>DRAFT</Text>
                      </View>
                    )}
                  </View>
                  {product.variants && product.variants.length > 0 ? (
                    <Text style={{ fontSize: 11, color: '#1669ef', fontWeight: '600', marginBottom: 4 }}>
                      {product.variants.length} variant{product.variants.length > 1 ? 's' : ''}: {product.variants.map(v => v.name).join(', ')}
                    </Text>
                  ) : null}
                  {product.description ? (
                    <Text style={styles.productDesc} numberOfLines={1}>
                      {product.description}
                    </Text>
                  ) : null}
                  <View style={styles.stockRow}>
                    <Switch
                      value={product.is_available}
                      onValueChange={() => handleToggleAvailable(product)}
                      trackColor={{ false: '#fecaca', true: '#bbf7d0' }}
                      thumbColor={product.is_available ? '#16A34A' : '#EF4444'}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <Text style={[styles.stockText, { color: product.is_available ? '#16A34A' : '#EF4444' }]}>
                      {product.is_available ? 'In Stock' : 'Out of Stock'}
                    </Text>
                  </View>
                </View>
                <View style={styles.productRight}>
                  <Text style={styles.productPrice}>
                    ₹{product.variants && product.variants.length > 0
                      ? Math.min(...product.variants.map(v => parseFloat(v.price))).toFixed(2)
                      : parseFloat(product.price).toFixed(2)}
                  </Text>
                  {product.is_draft && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 }}
                      onPress={() => handlePublish(product.id, product.name)}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Publish</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => navigation.navigate('VendorEditProduct', {
                        product,
                        onGoBack: fetchProducts,
                      })}
                    >
                      <Text style={styles.editBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(product.id, product.name)}
                    >
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Bottom Tab */}
      <View style={[styles.bottomTab, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorHome')}>
          <Ionicons name="grid-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorOrders')}>
          <Ionicons name="receipt-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="cube" size={22} color="#1669ef" />
          <Text style={styles.tabLabelActive}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('VendorProfile')}>
          <Ionicons name="person-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  bellBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  bellIcon: { fontSize: 22 },

  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  addBtn: {
    backgroundColor: '#1669ef', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  countBox: { alignItems: 'flex-end' },
  countLabel: { fontSize: 11, color: '#888' },
  countValue: { fontSize: 24, fontWeight: 'bold', color: '#111' },

  productCard: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14,
    marginBottom: 10, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  productInfo: { flex: 1, paddingRight: 12 },
  productName: { fontSize: 15, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  productDesc: { fontSize: 12, color: '#888', marginBottom: 6 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  stockText: { fontSize: 12, fontWeight: '600' },
  availableBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  availableText: { fontSize: 11, fontWeight: '600' },
  productRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  productPrice: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  actionBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  editBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  editBtnText: { fontSize: 16 },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center',
  },
  deleteBtnText: { fontSize: 16 },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#888', marginBottom: 20 },
  addFirstBtn: {
    backgroundColor: '#1669ef', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  addFirstBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  bottomTab: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 24, paddingTop: 10,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 22, marginBottom: 2, color: '#9CA3AF' },
  tabLabel: { fontSize: 11, color: '#9CA3AF' },
  tabLabelActive: { fontSize: 11, color: '#1669ef', fontWeight: 'bold' },
});