const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export async function apiRequest(path, options = {}, token = null) {
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const activeToken = token || localStorage.getItem('dummr_access_token');
  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    throw new Error('Unable to reach server. Please check your network connection.');
  }

  // Handle 401 Unauthorized - Attempt Token Refresh
  if (response.status === 401 && !options._retry && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
    const refreshToken = localStorage.getItem('dummr_refresh_token');
    if (refreshToken) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          return apiRequest(path, { ...options, _retry: true }, newToken);
        });
      }

      options._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          localStorage.setItem('dummr_access_token', tokens.access_token);
          if (tokens.refresh_token) {
            localStorage.setItem('dummr_refresh_token', tokens.refresh_token);
          }
          processQueue(null, tokens.access_token);
          return apiRequest(path, options, tokens.access_token);
        } else {
          processQueue(new Error('Session expired'), null);
          clearSession();
          window.dispatchEvent(new Event('dummr_unauthorized'));
          throw new Error('Session expired. Please log in again.');
        }
      } catch (err) {
        processQueue(err, null);
        clearSession();
        window.dispatchEvent(new Event('dummr_unauthorized'));
        throw err;
      } finally {
        isRefreshing = false;
      }
    } else {
      clearSession();
      window.dispatchEvent(new Event('dummr_unauthorized'));
    }
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { detail: text };
    }
  }

  if (!response.ok) {
    let detail = payload?.detail || payload?.message || payload?.error || 'Request failed';
    if (Array.isArray(detail)) {
      detail = detail.map((d) => d.msg || d.detail || JSON.stringify(d)).join(', ');
    } else if (typeof detail !== 'string') {
      detail = JSON.stringify(detail);
    }
    throw new Error(detail);
  }

  return payload;
}

export function clearSession() {
  localStorage.removeItem('dummr_access_token');
  localStorage.removeItem('dummr_refresh_token');
  localStorage.removeItem('dummr_user');
}

/* ================= AUTHENTICATION ================= */

export async function registerUser({ name, fullName, username, email, password, role, specialty = '', college = '' }) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: name || fullName,
      fullName: fullName || name,
      username,
      email,
      password,
      role: role.toUpperCase(),
      specialty,
      college,
    }),
  });
}

export async function loginUser({ username, password }) {
  const params = new URLSearchParams({ username, password });
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

export async function getCurrentUser(token = null) {
  return apiRequest('/api/auth/me', { method: 'GET' }, token);
}

export async function logoutUser() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignore error on logout
  } finally {
    clearSession();
  }
}

export async function forgotPassword(email) {
  return apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword({ token, new_password }) {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password }),
  });
}

export async function updateProfile(profileData) {
  return apiRequest('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
}

/* ================= CATEGORIES ================= */

export async function fetchCategories() {
  return apiRequest('/api/categories', { method: 'GET' });
}

/* ================= SERVICES ================= */

export async function fetchServices(params = {}) {
  const query = new URLSearchParams();
  if (params.q) query.append('q', params.q);
  if (params.category) query.append('category', params.category);
  if (params.min_price != null) query.append('min_price', params.min_price);
  if (params.max_price != null) query.append('max_price', params.max_price);
  if (params.sort) query.append('sort', params.sort);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);

  const queryString = query.toString();
  return apiRequest(`/api/services${queryString ? `?${queryString}` : ''}`, { method: 'GET' });
}

export async function fetchServiceById(id) {
  return apiRequest(`/api/services/${id}`, { method: 'GET' });
}

export async function createService(data) {
  return apiRequest('/api/services', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateService(id, data) {
  return apiRequest(`/api/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteService(id) {
  return apiRequest(`/api/services/${id}`, { method: 'DELETE' });
}

export async function publishService(id) {
  return apiRequest(`/api/services/${id}/publish`, { method: 'POST' });
}

export async function pauseService(id) {
  return apiRequest(`/api/services/${id}/pause`, { method: 'POST' });
}

export async function createServicePackage(serviceId, packageData) {
  return apiRequest(`/api/services/${serviceId}/packages`, {
    method: 'POST',
    body: JSON.stringify(packageData),
  });
}

/* ================= SAVED SERVICES ================= */

export async function toggleSaveService(serviceId) {
  return apiRequest(`/api/services/${serviceId}/save`, { method: 'POST' });
}

export async function fetchSavedServices() {
  return apiRequest('/api/services/saved', { method: 'GET' });
}

/* ================= ORDERS ================= */

export async function createOrder({ service_id, package_id, requirements = '' }) {
  return apiRequest('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ service_id, package_id, requirements }),
  });
}

export async function fetchOrders() {
  return apiRequest('/api/orders', { method: 'GET' });
}

export async function fetchOrderById(id) {
  return apiRequest(`/api/orders/${id}`, { method: 'GET' });
}

export async function acceptOrder(id) {
  return apiRequest(`/api/orders/${id}/accept`, { method: 'POST' });
}

export async function startOrder(id) {
  return apiRequest(`/api/orders/${id}/start`, { method: 'POST' });
}

export async function deliverOrder(id, { message = '', files = [] } = {}) {
  return apiRequest(`/api/orders/${id}/deliver`, {
    method: 'POST',
    body: JSON.stringify({ delivery_message: message, delivery_files: files }),
  });
}

export async function completeOrder(id) {
  return apiRequest(`/api/orders/${id}/complete`, { method: 'POST' });
}

export async function cancelOrder(id) {
  return apiRequest(`/api/orders/${id}/cancel`, { method: 'POST' });
}

export async function createReview(orderId, { rating, comment = '' }) {
  return apiRequest(`/api/orders/${orderId}/review`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  });
}

/* ================= MESSAGING ================= */

export async function fetchConversations() {
  return apiRequest('/api/conversations', { method: 'GET' });
}

export async function createConversation(participantId, orderId = null) {
  return apiRequest('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ participant_id: participantId, order_id: orderId }),
  });
}

export async function fetchMessages(conversationId) {
  return apiRequest(`/api/conversations/${conversationId}/messages`, { method: 'GET' });
}

export async function sendMessage(conversationId, content) {
  return apiRequest(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function markConversationRead(conversationId) {
  return apiRequest(`/api/conversations/${conversationId}/read`, { method: 'POST' });
}

/* ================= DASHBOARDS ================= */

export async function fetchSellerDashboard() {
  return apiRequest('/api/seller/dashboard', { method: 'GET' });
}

export async function fetchSellerServices() {
  return apiRequest('/api/seller/services', { method: 'GET' });
}

export async function fetchBuyerDashboard() {
  return apiRequest('/api/buyer/dashboard', { method: 'GET' });
}

/* ================= NOTIFICATIONS ================= */

export async function fetchNotifications() {
  return apiRequest('/api/notifications', { method: 'GET' });
}

export async function markNotificationRead(id) {
  return apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead() {
  return apiRequest('/api/notifications/read-all', { method: 'POST' });
}
