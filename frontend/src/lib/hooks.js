import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, errMsg } from './api';
import { useToast } from '../components/toast';

/** '/hr' or '/manager' — project & review pages are shared by both portals */
export function useBase() {
  const { pathname } = useLocation();
  return pathname.startsWith('/hr') ? '/hr' : '/manager';
}

export const useGet = (key, url, params, opts = {}) => useQuery({ queryKey: [key, url, params], queryFn: () => get(url, params), ...opts });

/** Mutation with toast + cache invalidation. */
export function useAction(fn, { success, invalidate = [], onSuccess } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      const msg = typeof success === 'function' ? success(data, vars) : success || data?.message;
      if (msg) toast(msg);
      onSuccess?.(data, vars);
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });
}
