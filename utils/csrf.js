import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000';

/**
 * Fetches a CSRF token from the server
 * @returns {Promise<string>} The CSRF token
 */
export const getCsrfToken = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/csrf-token`, {
      withCredentials: true
    });
    return response.data.csrfToken;
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    throw error;
  }
};

/**
 * Sets the CSRF token in localStorage
 * @param {string} token The CSRF token to store
 */
export const setCsrfToken = (token) => {
  localStorage.setItem('csrfToken', token);
};

/**
 * Gets the CSRF token from localStorage
 * @returns {string|null} The CSRF token or null if not found
 */
export const getStoredCsrfToken = () => {
  return localStorage.getItem('csrfToken');
};

/**
 * Removes the CSRF token from localStorage
 */
export const removeCsrfToken = () => {
  localStorage.removeItem('csrfToken');
};
