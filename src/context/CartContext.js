import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  // carts = { vendorId: { shop: { id, shop_name }, items: { productId: qty }, products: [] } }
  const [carts, setCarts]   = useState({});
  const [loading, setLoading] = useState(false);
  const inFlightRequest = useRef(null);
  const lastFetchTime = useRef(0);

  useEffect(() => { fetchCartFromDb(); }, []);

  const getHeaders = async () => {
    const token = await AsyncStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Serialize cart operations to avoid overlapping mutations and stale reads.
  const queue = useRef(Promise.resolve());

  const enqueue = (operation) => {
    const result = queue.current.catch(() => {}).then(operation);
    queue.current = result.catch(() => {});
    return result;
  };

  const loadCart = async () => {
    const headers = await getHeaders();
    if (!headers.Authorization) return;

    const res = await client.get('/orders/cart/', { headers });
    const grouped = {};

    for (const item of (res.data.items || [])) {
      const vid = item.vendor_id;
      if (!grouped[vid]) {
        grouped[vid] = {
          shop: {
            id: vid,
            shop_name: item.vendor_name,
            min_order_value: item.vendor_mov || 0,
            latitude: item.vendor_lat,
            longitude: item.vendor_lng,
            gstin: item.vendor_gstin,
          },
          items: {},
          products: [],
          dbItems: [],
        };
      }

      const key = item.variant_id
        ? `${item.product_id}_${item.variant_id}`
        : item.product_id;

      grouped[vid].items[key] = item.quantity;
      grouped[vid].dbItems.push(item);
      grouped[vid].products.push({
        id: key,
        name: item.product_name,
        price: item.product_price,
        mrp: item.product_mrp || null,
        image: item.product_image,
        gst_percentage: item.product_gst || 0,
        gst_pricing_mode: item.product_gst_pricing_mode || 'exclusive',
        variant_id: item.variant_id || null,
        base_product_id: item.product_id,
      });
    }

    setCarts(grouped);
  };

  const fetchCartFromDb = () => enqueue(async () => {
    setLoading(true);
    try {
      await loadCart();
    } catch (err) {
      console.log('fetchCartFromDb error:', err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  });

  const addToCart = (product, shopData) => enqueue(async () => {
    try {
      const headers = await getHeaders();
      if (!headers.Authorization) return;

      await client.post('/orders/cart/add/', {
        product_id: product.base_product_id || product.id,
        variant_id: product.variant_id || null,
        vendor_id: shopData.id,
        quantity: 1,
        price: product.price,
      }, { headers });

      await loadCart();
    } catch (err) {
      console.log('addToCart error:', err?.response?.data || err.message);
      await loadCart().catch(() => {});
    }
  });

  const removeFromCart = (product, vendorId) => enqueue(async () => {
    try {
      const headers = await getHeaders();
      if (!headers.Authorization) return;

      // Fetch current DB cart to obtain the authoritative item UUID.
      const res = await client.get('/orders/cart/', { headers });
      const baseId = String(product.base_product_id || product.id);
      const variantId = product.variant_id ? String(product.variant_id) : null;
      const vid = vendorId ? String(vendorId) : null;

      const item = (res.data.items || []).find(i => {
        const key = i.variant_id
          ? `${i.product_id}_${i.variant_id}`
          : String(i.product_id);

        return (
          (String(i.product_id) === baseId || key === String(product.id)) &&
          (!vid || String(i.vendor_id) === vid) &&
          (variantId === null || String(i.variant_id) === variantId)
        );
      });

      if (!item) {
        await loadCart();
        return;
      }

      if (Number(item.quantity) <= 1) {
        await client.delete(`/orders/cart/remove/${item.id}/`, { headers });
      } else {
        await client.patch(
          `/orders/cart/update/${item.id}/`,
          { quantity: Number(item.quantity) - 1 },
          { headers }
        );
      }

      await loadCart();
    } catch (err) {
      console.log('removeFromCart error:', err?.response?.data || err.message);
      await loadCart().catch(() => {});
    }
  });

  const clearShopCart = (vendorId) => enqueue(async () => {
    try {
      const headers = await getHeaders();
      if (!headers.Authorization) return;
      await client.delete(
        `/orders/cart/clear/?vendor_id=${encodeURIComponent(vendorId)}`,
        { headers }
      );
      await loadCart();
    } catch (err) {
      console.log('clearShopCart error:', err?.response?.data || err.message);
      await loadCart().catch(() => {});
    }
  });

  const clearCart = () => enqueue(async () => {
    try {
      const headers = await getHeaders();
      if (!headers.Authorization) return;
      await client.delete('/orders/cart/clear/', { headers });
      await loadCart();
    } catch (err) {
      console.log('clearCart error:', err?.response?.data || err.message);
      await loadCart().catch(() => {});
    }
  });

  // ── Computed values ───────────────────────────────────────────────────────
  const cartCount = Object.values(carts).reduce((total, shopCart) => {
    return total + Object.values(shopCart.items).reduce((a, b) => a + b, 0);
  }, 0);

  const shopCount = Object.keys(carts).length;

  const cartTotal = Object.values(carts).reduce((total, shopCart) => {
    return total + shopCart.products.reduce((sum, p) => {
      return sum + (shopCart.items[p.id] || 0) * parseFloat(p.price);
    }, 0);
  }, 0);

  // Legacy support — single shop
  const shop     = Object.values(carts)[0]?.shop || null;
  const cart     = Object.values(carts)[0]?.items || {};
  const products = Object.values(carts)[0]?.products || [];

  return (
    <CartContext.Provider value={{
      carts,
      cart,
      shop,
      products,
      loading,
      addToCart,
      removeFromCart,
      clearShopCart,
      clearCart,
      fetchCartFromDb,
      cartCount,
      cartTotal,
      shopCount,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);