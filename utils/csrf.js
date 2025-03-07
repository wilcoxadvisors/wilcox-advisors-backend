import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000';

export const getCsrfToken = async () => {
  try {
    console.log('Attempting to fetch CSRF token from:', `${API_URL}/api/csrf-token`);
    const response = await axios.get(`${API_URL}/api/csrf-token`, {
      withCredentials: true
    });
    console.log('CSRF Token response:', response.data);
    return response.data.csrfToken;
  } catch (error) {
    console.error('Detailed CSRF Token Error:', {
      message: error.message,
      response: error.response,
      request: error.request
    });
    throw error;
  }
};

export const setCsrfToken = (token) => {
  localStorage.setItem('csrfToken', token);
};

export const getStoredCsrfToken = () => {
  return localStorage.getItem('csrfToken');
};
