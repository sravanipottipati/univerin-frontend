import React, { useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
const DEFAULT_PRODUCT_IMG = require('../../../assets/default_product.png');
import { useCart } from '../../context/CartContext';

const TEAL = '#1669ef';

export default function CartScreen({ navigation }) {
  const { carts, addToCart, removeFromCart, cartCount, fetchCartFromDb, clearShopCart } = useCart();

  useFocusEffect(
    useCallback(() => {
      fetchCartFromDb();
    }, [])
  );

  const shopIds = Object.keys(carts);
  console.log('CartScreen carts:', JSON.stringify(Object.keys(carts)));

  // ── Empty cart ────────────────────────────────────────────────────────────
  if (cartCount === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="cart-outline" size={60} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add items from a shop to get started</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="storefront-outline" size={18} color="#fff" />
            <Text style={styles.shopBtnText}>Browse Shops</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomTab}>
          <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home-outline" size={22} color="#9CA3AF" />
            <Text style={styles.tabLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="cart" size={22} color={TEAL} />
            <Text style={styles.tabLabelActive}>Cart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('MyOrders')}>
            <Ionicons name="receipt-outline" size={22} color="#9CA3AF" />
            <Text style={styles.tabLabel}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-outline" size={22} color="#9CA3AF" />
            <Text style={styles.tabLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const totalItems  = cartCount;
  const totalAmount = Object.values(carts).reduce((total, shopCart) => {
    return total + shopCart.products.reduce((sum, p) => {
      const qty = shopCart.items[p.id] || 0;
      const price = parseFloat(p.price) || 0;
      const gstRate = parseFloat(p.gst_percentage) || 0;
      const baseTotal = Math.round(price * qty * 100) / 100;
      const hasGST = !!shopCart.shop?.gstin?.trim();
      return sum + (hasGST && p.gst_pricing_mode !== 'inclusive'
        ? Math.round(baseTotal * (1 + gstRate / 100) * 100) / 100
        : baseTotal);
    }, 0);
  }, 0);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        {shopIds.length > 1 ? (
          <View style={styles.shopCountBadge}>
            <Text style={styles.shopCountText}>{shopIds.length} Shops</Text>
          </View>
        ) : <View style={{ width: 36 }} />}
      </View>

      {/* Multi-shop notice */}
      {shopIds.length > 1 && (
        <View style={styles.noticeBar}>
          <Ionicons name="information-circle-outline" size={16} color="#7B6000" />
          <Text style={styles.noticeText}>
            You have items from <Text style={styles.noticeBold}>{shopIds.length} shops</Text>. Place orders shop by shop!
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {shopIds.map(vid => {
          const shopCart  = carts[vid];
          const shop      = shopCart.shop;
          const items     = shopCart.items;
          const products  = shopCart.products;
          const itemCount = Object.values(items).reduce((a, b) => a + b, 0);
          const subtotal  = products.reduce((sum, p) => {
            const qty = items[p.id] || 0;
            const price = parseFloat(p.price) || 0;
            const gstRate = parseFloat(p.gst_percentage) || 0;
            const baseTotal = Math.round(price * qty * 100) / 100;
            const hasGST = !!shop?.gstin?.trim();
            return sum + (hasGST && p.gst_pricing_mode !== 'inclusive'
              ? Math.round(baseTotal * (1 + gstRate / 100) * 100) / 100
              : baseTotal);
          }, 0);
          const mov = parseFloat(shop?.min_order_value || 0);
          const isFreeDelivery = mov > 0 && subtotal >= mov;
          const amountLeft = mov > 0 ? Math.max(0, mov - subtotal) : 0;

          return (
            <View key={vid} style={styles.shopCard}>

              {/* Shop Header */}
              <View style={styles.shopHeader}>
                <Ionicons name="storefront-outline" size={22} color="#1669ef" />
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName}>{shop.shop_name}</Text>
                  <Text style={styles.shopMeta}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    Alert.alert(
                      'Clear Cart',
                      `Remove all items from ${shop.shop_name}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear', style: 'destructive', onPress: () => clearShopCart(vid) },
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {/* Items */}
              {products.map((product, i) => {
                const qty      = items[product.id] || 0;
                const imgUrl   = product.image
                  ? product.image.startsWith('http')
                    ? product.image
                    : `https://res.cloudinary.com/dxavm870k/image/upload/v1/${product.image}`
                  : null;
                if (qty === 0) return null;
                return (
                  <View key={product.id} style={[styles.itemRow, i < products.length - 1 && styles.itemRowBorder]}>
                    {/* Image */}
                    <View style={styles.itemImg}>
                      <Image source={imgUrl ? { uri: imgUrl } : DEFAULT_PRODUCT_IMG} style={styles.itemImgImg} resizeMode="contain" />
                    </View>

                    {/* Info */}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>{product.name}</Text>
                      {product.mrp && parseFloat(product.mrp) > parseFloat(product.price) && (
                        <Text style={styles.itemMrp}>MRP: <Text style={{textDecorationLine: 'line-through'}}>₹{parseFloat(product.mrp).toFixed(0)}</Text></Text>
                      )}
                      <Text style={styles.itemPrice}>₹{parseFloat(product.price).toFixed(0)}</Text>
                    </View>

                    {/* Qty control */}
                    <View style={styles.qtyControl}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(product, vid)}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyNum}>{qty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(product, shop)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {/* Shop Footer */}
              <View style={styles.shopFooter}>
                <View style={styles.shopSummary}>
                  <Text style={styles.summaryText}>
                    {itemCount} items · Subtotal <Text style={styles.summaryAmount}>₹{subtotal.toFixed(0)}</Text>
                  </Text>
                  {isFreeDelivery ? (
                    <View style={styles.deliveryTag}>
                      <Ionicons name="bicycle-outline" size={12} color="#16A34A" />
                      <Text style={styles.deliveryTagText}>🎉 FREE delivery!</Text>
                    </View>
                  ) : (
                    <View style={[styles.deliveryTag, {backgroundColor: '#FEF3C7'}]}>
                      <Ionicons name="bicycle-outline" size={12} color="#92400e" />
                      <Text style={[styles.deliveryTagText, {color: '#92400e'}]}>Add ₹{amountLeft.toFixed(0)} more for FREE delivery</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.orderBtn}
                  onPress={() => navigation.navigate('Checkout', {
                    cart: items,
                    products: products,
                    shop: shop,
                    cartTotal: subtotal,
                    distance: null,
                  })}
                >
                  <View style={styles.orderBtnLeft}>
                    <View style={styles.itemPill}>
                      <Text style={styles.itemPillText}>{itemCount} items</Text>
                    </View>
                    <Text style={styles.orderBtnText}>Place Order · ₹{subtotal.toFixed(0)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

            </View>
          );
        })}

      </ScrollView>

      {/* Bottom total bar */}
      {shopIds.length > 1 && (
        <View style={styles.totalBar}>
          <Text style={styles.totalBarText}>
            <Text style={styles.totalBarBold}>{shopIds.length} shops</Text> · {totalItems} items total
          </Text>
          <Text style={styles.totalBarAmount}>Est. ₹{totalAmount.toFixed(0)}</Text>
        </View>
      )}

      {/* Bottom Tab */}
      <View style={styles.bottomTab}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <View style={{ position: 'relative' }}>
            <Ionicons name="cart" size={22} color={TEAL} />
            {cartCount > 0 && (
              <View style={styles.cartTabBadge}>
                <Text style={styles.cartTabBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.tabLabelActive}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('MyOrders')}>
          <Ionicons name="receipt-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-outline" size={22} color="#9CA3AF" />
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  shopCountBadge: { backgroundColor: TEAL, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  shopCountText:  { color: '#fff', fontSize: 12, fontWeight: '700' },

  noticeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8E1', borderLeftWidth: 4, borderLeftColor: '#FFC107',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  noticeText: { fontSize: 12, color: '#7B6000', flex: 1 },
  noticeBold: { fontWeight: '800' },

  // Empty state
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#F3F4F6', justifyContent: 'center',
    alignItems: 'center', marginBottom: 24,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  emptyTitle:    { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 10, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  shopBtn: {
    backgroundColor: TEAL, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  shopBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Shop card
  shopCard: {
    backgroundColor: '#fff', borderRadius: 18,
    marginBottom: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#E8E8E8',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  shopHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  shopAvatar: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
  },
  shopAvatarText:  { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  shopInfo:        { flex: 1 },
  shopName:        { fontSize: 15, fontWeight: '800', color: '#111' },
  shopMeta:        { fontSize: 12, color: '#888', marginTop: 2 },
  itemCountBadge:  { backgroundColor: '#FFF0EB', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  itemCountText:   { color: '#FF6B35', fontSize: 12, fontWeight: '800' },

  // Item rows
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  itemImg: {
    width: 72, height: 72, borderRadius: 14,
    backgroundColor: '#F5F5F5', justifyContent: 'center',
    alignItems: 'center', borderWidth: 1, borderColor: '#E8E8E8',
    flexShrink: 0,
  },
  itemImgImg: { width: 72, height: 72 },
  itemInfo:   { flex: 1 },
  itemName:   { fontSize: 13, fontWeight: '600', color: '#111', marginBottom: 4, lineHeight: 18 },
  itemMrp: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  itemPrice:  { fontSize: 14, fontWeight: '800', color: '#111' },

  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: TEAL,
    borderRadius: 10, overflow: 'hidden', flexShrink: 0,
  },
  qtyBtn:     { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: TEAL, lineHeight: 22 },
  qtyNum:     { minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#111' },

  // Shop footer
  shopFooter: {
    backgroundColor: '#FAFAFA', borderTopWidth: 1,
    borderTopColor: '#F0F0F0', padding: 14,
  },
  shopSummary: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  summaryText:    { fontSize: 13, color: '#888' },
  summaryAmount:  { fontWeight: '800', fontSize: 15, color: '#111' },
  deliveryTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EAFAF1', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  deliveryTagText: { fontSize: 11, color: '#16A34A', fontWeight: '600' },

  orderBtn: {
    backgroundColor: TEAL, borderRadius: 12,
    padding: 13, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  orderBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  itemPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  orderBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Total bar
  totalBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    position: 'absolute', bottom: 70, left: 0, right: 0,
  },
  totalBarText:   { fontSize: 13, color: '#555' },
  totalBarBold:   { fontWeight: '800', color: '#111' },
  totalBarAmount: { fontSize: 15, fontWeight: '900', color: TEAL },

  // Bottom tab
  bottomTab: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 24, paddingTop: 10,
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 10,
  },
  tabItem:        { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel:       { fontSize: 11, color: '#9CA3AF' },
  tabLabelActive: { fontSize: 11, color: TEAL, fontWeight: 'bold' },
  cartTabBadge: {
    position: 'absolute', top: -5, right: -8,
    backgroundColor: '#EF4444', borderRadius: 9,
    minWidth: 16, height: 16, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#fff',
  },
  cartTabBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});