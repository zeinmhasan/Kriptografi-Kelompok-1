import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { FileListing, ServerParameters } from '../types';

export function useFiles() {
  const [listing, setListing] = useState<FileListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api
      .listFiles()
      .then((data) => {
        setListing(data);
        setError(null);
      })
      .catch((thrown) => setError(errorMessage(thrown)));
  }, []);

  useEffect(reload, [reload]);

  return { listing, error, reload };
}

// Parameter server tidak berubah selama server berjalan, jadi cukup diambil sekali.
let parametersRequest: Promise<ServerParameters> | undefined;

export function useParameters(): ServerParameters | null {
  const [parameters, setParameters] = useState<ServerParameters | null>(null);

  useEffect(() => {
    let cancelled = false;
    parametersRequest ??= api.parameters();
    parametersRequest
      .then((data) => {
        if (!cancelled) setParameters(data);
      })
      .catch(() => {
        parametersRequest = undefined;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return parameters;
}
