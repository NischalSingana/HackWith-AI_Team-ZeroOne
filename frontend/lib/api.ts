export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://crimegraphapi.zeroonedevs.in/api';
// Extract base URL (without /api) for static assets
export const BASE_URL = API_BASE_URL.replace(/\/api$/, '');
