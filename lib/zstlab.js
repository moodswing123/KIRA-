'use strict';

const axios = require('axios');

const BASE_URL = 'https://zstlab.cyou';

function isConfigured() {
  return Boolean(String(process.env.ZSTLAB_API_KEY || '').trim());
}

function headers() {
  const key = String(process.env.ZSTLAB_API_KEY || '').trim();
  if (!key) throw new Error('ZSTLAB_API_KEY not set');
  return { 'x-api-key': key, Accept: 'application/json', 'User-Agent': 'Kira-MD/1.0' };
}

async function get(endpoint, params = {}) {
  const response = await axios.get(`${BASE_URL}${endpoint}`, {
    headers: headers(),
    params,
    timeout: 60000
  });
  if (response.data?.status === false || response.data?.success === false) {
    throw new Error(response.data?.message || response.data?.error || 'ZSTLAB request failed');
  }
  return response.data;
}

function collectUrls(value, out = []) {
  if (!value || out.length >= 20) return out;
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    if (!out.includes(value)) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (/^(downloadUrl|download_url|audioUrl|audio_url|videoUrl|video_url|url|link|src|play)$/i.test(key)) {
        collectUrls(item, out);
      } else if (typeof item === 'object') {
        collectUrls(item, out);
      }
    }
  }
  return out;
}

function firstUrl(data) {
  return collectUrls(data)[0] || null;
}

module.exports = { BASE_URL, isConfigured, get, collectUrls, firstUrl };
