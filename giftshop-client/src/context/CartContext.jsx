import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const EMPTY = { items: [], savedForLater: [], itemCount: 0, subtotal: 0, discount: 0, shippingFee: 0, total: 0, coupon: null };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  // Which user the cart in state belongs to. Comparing during render (not in an effect) means a page
  // never sees the previous user's or the guest's empty cart as "loaded" for one render.
  const [loadedFor, setLoadedFor] = useState(undefined);
  const owner = user?._id || 'guest';
  const loaded = loadedFor === owner;

  const refresh = useCallback(async () => {
    if (!user) { setCart(EMPTY); setLoadedFor('guest'); return; }
    setLoading(true);
    try {
      setCart((await api.get('/cart')).data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
      setLoadedFor(user._id);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Runs a cart request. `optimistic` changes the screen first; on failure the previous cart comes back.
  const run = useCallback(async (request, { optimistic, success } = {}) => {
    const previous = cart;
    if (optimistic) setCart((c) => optimistic(c));
    try {
      const { data } = await request();
      setCart(data);
      if (success) toast.success(success);
      return true;
    } catch (err) {
      setCart(previous);
      toast.error(errorMessage(err));
      return false;
    }
  }, [cart]);

  const add = useCallback((productId, qty = 1, variant = '') => {
    if (!user) { toast.error('Log in to add gifts to your cart'); return Promise.resolve(false); }
    return run(() => api.post('/cart', { productId, qty, variant }), {
      optimistic: (c) => ({ ...c, itemCount: c.itemCount + qty }),
      success: 'Added to cart',
    });
  }, [run, user]);

  const updateQty = useCallback((itemId, qty) => run(() => api.put(`/cart/items/${itemId}`, { qty }), {
    optimistic: (c) => ({ ...c, items: c.items.map((i) => (i._id === itemId ? { ...i, qty, lineTotal: i.unitPrice * qty } : i)) }),
  }), [run]);

  const remove = useCallback((itemId) => run(() => api.delete(`/cart/items/${itemId}`), {
    optimistic: (c) => ({ ...c, items: c.items.filter((i) => i._id !== itemId) }),
    success: 'Removed from cart',
  }), [run]);

  const value = useMemo(() => ({
    cart,
    loading,
    loaded,
    refresh,
    setCart,
    add,
    updateQty,
    remove,
    saveForLater: (itemId) => run(() => api.post(`/cart/items/${itemId}/save-for-later`), { success: 'Saved for later' }),
    moveToCart: (itemId) => run(() => api.post(`/cart/saved/${itemId}/move-to-cart`), { success: 'Moved to cart' }),
    removeSaved: (itemId) => run(() => api.delete(`/cart/saved/${itemId}`)),
    applyCoupon: (code) => run(() => api.post('/cart/coupon', { code }), { success: 'Coupon applied' }),
    removeCoupon: () => run(() => api.delete('/cart/coupon')),
  }), [cart, loading, loaded, refresh, add, updateQty, remove, run]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
