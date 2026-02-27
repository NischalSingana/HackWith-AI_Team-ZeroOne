export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
// Extract base URL (without /api) for static assets
export const BASE_URL = API_BASE_URL.replace(/\/api$/, '');
