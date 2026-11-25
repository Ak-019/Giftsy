import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMessage, refreshSession, setAccessToken, setOnSessionExpired } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // true once we know whether a session exists

  // On load, try to restore the session from the refresh cookie
  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      toast.error('Your session expired. Please log in again.');
    });
    refreshSession()
      .then((data) => setUser(data.user))
      .catch((err) => {
        setUser(null);
        // 401 just means "not logged in". Anything else (rate limit, server down) is worth telling the user.
        if (err?.response?.status !== 401) toast.error(errorMessage(err));
      })
      .finally(() => setReady(true));
  }, []);

  const startSession = (data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const login = useCallback(async (email, password) => startSession((await api.post('/auth/login', { email, password })).data), []);
  const register = useCallback(async (body) => startSession((await api.post('/auth/register', body)).data), []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* clear locally anyway */ }
    setAccessToken(null);
    setUser(null);
  }, []);

  // Optimistic: the heart fills immediately and is reverted if the request fails
  const toggleWishlist = useCallback(async (productId) => {
    if (!user) { toast.error('Log in to save gifts to your wishlist'); return false; }
    const had = user.wishlist?.includes(productId);
    const next = had ? user.wishlist.filter((id) => id !== productId) : [...(user.wishlist || []), productId];
    setUser((u) => ({ ...u, wishlist: next }));
    try {
      const { data } = await api.post(`/account/wishlist/${productId}`);
      setUser((u) => ({ ...u, wishlist: data.wishlist }));
      toast.success(data.inWishlist ? 'Saved to wishlist' : 'Removed from wishlist');
      return data.inWishlist;
    } catch (err) {
      setUser((u) => ({ ...u, wishlist: user.wishlist }));
      toast.error(errorMessage(err));
      return had;
    }
  }, [user]);

  const value = useMemo(() => ({
    user,
    ready,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
    setUser,
    startSession,
    toggleWishlist,
    inWishlist: (id) => Boolean(user?.wishlist?.includes(id)),
  }), [user, ready, login, register, logout, toggleWishlist]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
