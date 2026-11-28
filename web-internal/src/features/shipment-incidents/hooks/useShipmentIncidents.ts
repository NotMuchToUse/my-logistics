import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_FILTERS } from '../schemas/shipmentIncidents.schema.ts';
import { incidentError } from '../utils/incidentErrors.ts';
import type { IncidentError } from '../utils/incidentErrors.ts';
import type { Filters, Incident, IncidentLookups, IncidentService, IncidentSession } from '../types/shipmentIncidents.types.ts';
import type { PaginationMeta } from '@/types/api.types';

export function useShipmentIncidents(service: IncidentService, session: IncidentSession) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([session.key, filters, revision]);
  const emptyOptions: IncidentLookups = { staff: [], shipments: [], branches: [] };
  const emptyPagination: PaginationMeta = { page: filters.page, per_page: filters.per_page, total: 0, total_pages: 0 };
  const [state, setState] = useState<{ requestKey: string; rows: Incident[]; options: IncidentLookups; pagination: PaginationMeta; error: IncidentError | null }>({ requestKey: '', rows: [], options: emptyOptions, pagination: emptyPagination, error: null });
  const sequence = useRef(0);
  useEffect(() => { const timer = setTimeout(() => setFilters(old => ({ ...old, search, page: 1 })), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    const request = ++sequence.current;
    let active = true;
    Promise.all([service.list(session, filters), service.options(session)]).then(([list, options]) => {
      if (active && request === sequence.current) setState({ requestKey, rows: list.data, options: options.data, pagination: list.meta.pagination, error: null });
    }).catch(error => {
      if (active && request === sequence.current) setState({ requestKey, rows: [], options: { staff: [], shipments: [], branches: [] }, pagination: { page: filters.page, per_page: filters.per_page, total: 0, total_pages: 0 }, error: incidentError(error) });
    });
    return () => { active = false; };
  }, [service, session, filters, requestKey]);
  const refetch = useCallback(() => setRevision(old => old + 1), []);
  function filter<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters(old => ({ ...old, [key]: value, page: 1 })); }
  function reset() { setSearch(''); setFilters({ ...DEFAULT_FILTERS }); }
  const loading = state.requestKey !== requestKey;
  return { rows: loading ? [] : state.rows, options: state.options, pagination: loading ? emptyPagination : state.pagination, error: loading ? null : state.error, loading, filters, search, setSearch, filter, reset, refetch, page: (page: number) => setFilters(old => ({ ...old, page })) };
}
