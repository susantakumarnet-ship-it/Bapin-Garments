import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const StoreContext = createContext(null);

const DEFAULTS = {
  store_name: 'Bapin Garments',
  tagline: 'Your Style, Your Choice!',
  whatsapp_number: '',
};

/** Public store settings + category tree, loaded once for the storefront. */
export function StoreProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [categories, setCategories] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([api('/public/settings'), api('/public/categories')])
      .then(([s, c]) => {
        setSettings({ ...DEFAULTS, ...s });
        setCategories(c);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const findCategory = (slug) => {
    const walk = (nodes, parent) => {
      for (const n of nodes) {
        if (n.slug === slug) return { ...n, parent };
        const f = walk(n.children || [], n);
        if (f) return f;
      }
      return null;
    };
    return walk(categories, null);
  };

  return (
    <StoreContext.Provider value={{ settings, categories, ready, findCategory }}>{children}</StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
