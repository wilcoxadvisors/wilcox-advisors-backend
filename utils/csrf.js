import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000';

export const getCsrfToken = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/csrf-token`, {
      withCredentials: true
    });
    return response.data.csrfToken;
  } catch (error) {
    console.error('Failed to get CSRF token:', error.response || error.message);
    throw error;
  }
};

export const setCsrfToken = (token) => {
  localStorage.setItem('csrfToken', token);
};

export const getStoredCsrfToken = () => {
  return localStorage.getItem('csrfToken');
};
