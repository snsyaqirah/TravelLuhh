// Shared bits for the front-door tests: axios-shaped errors as the API sends them.
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

export function apiError(status: number, message: string, headers: Record<string, string> = {}): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = {
    status,
    statusText: '',
    data: { status, message },
    headers,
    config,
  } as AxiosResponse;
  return new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, {}, response);
}
