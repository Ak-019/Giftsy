import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../api/client';

/**
 * Loads data from the API and keeps loading / error state.
 * `url` can be null to skip loading. Responses that arrive after a newer request are ignored.
 */
export default function useApi(url, { params, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(url && enabled));
  const requestId = useRef(0);
  const paramsKey = JSON.stringify(params || {});

  const load = useCallback(async () => {
    if (!url || !enabled) { setLoading(false); return; }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: JSON.parse(paramsKey) });
      if (id === requestId.current) setData(res.data);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [url, paramsKey, enabled]);

  useEffect(() => { load(); }, [load]);

  return { data, setData, error, loading, reload: load };
}
