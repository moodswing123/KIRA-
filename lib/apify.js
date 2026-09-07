'use strict';

const axios = require('axios');

const APIFY_BASE_URL = String(
  process.env.APIFY_API_BASE_URL || 'https://api.apify.com'
).replace(/\/+$/, '');
const DEFAULT_ACTOR_ID = 'easyapi~all-in-one-media-downloader';
const APIFY_TIMEOUT_MS = Number(process.env.APIFY_TIMEOUT_MS || 300000);
const MAX_MEDIA_BYTES = Number(process.env.MAX_DOWNLOAD_BYTES || 90 * 1024 * 1024);

function getApifyToken() {
  return String(process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || '').trim();
}

function actorPath(actorId) {
  return encodeURIComponent(actorId || DEFAULT_ACTOR_ID).replace(/%7E/gi, '~');
}

function useApifyProxy() {
  return String(process.env.APIFY_USE_PROXY || 'false').toLowerCase() === 'true';
}

function proxyGroups() {
  const groups = String(process.env.APIFY_PROXY_GROUPS || 'RESIDENTIAL')
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
  return groups.length ? groups : ['RESIDENTIAL'];
}

function mediaCandidates(items) {
  const candidates = [];

  for (const item of Array.isArray(items) ? items : []) {
    const result = item?.result && typeof item.result === 'object' ? item.result : item;
    const media = Array.isArray(result?.medias) ? result.medias : [];

    for (const entry of media) {
      if (entry && typeof entry === 'object' && typeof entry.url === 'string') {
        candidates.push({
          ...entry,
          title: result?.title || item?.title || '',
          sourceUrl: item?.url || result?.url || ''
        });
      }
    }

    if (!media.length) {
      const directUrl = result?.downloadUrl || result?.download_url || result?.url;
      if (typeof directUrl === 'string' && /^https?:\/\//i.test(directUrl)) {
        candidates.push({
          url: directUrl,
          type: result?.type || 'file',
          extension: result?.extension || '',
          title: result?.title || '',
          sourceUrl: item?.url || ''
        });
      }
    }
  }

  return candidates;
}

function scoreCandidate(candidate, preferredType) {
  const type = String(candidate.type || '').toLowerCase();
  const quality = String(candidate.quality || '').toLowerCase();
  const extension = String(candidate.extension || '').toLowerCase();
  let score = 0;

  if (preferredType && type === preferredType) score += 100;
  if (preferredType === 'video' && /mp4|webm|mov/.test(extension)) score += 15;
  if (preferredType === 'audio' && /mp3|m4a|aac|ogg|wav/.test(extension)) score += 15;
  if (preferredType === 'image' && /jpg|jpeg|png|webp|gif/.test(extension)) score += 15;
  if (/hd.*no.?watermark|no.?watermark/.test(quality)) score += 20;
  if (/watermark/.test(quality) && !/no.?watermark/.test(quality)) score -= 20;
  return score;
}

function chooseMedia(items, preferredType) {
  const candidates = mediaCandidates(items);
  if (!candidates.length) {
    throw new Error('Apify returned no downloadable media');
  }

  return [...candidates]
    .sort((a, b) => scoreCandidate(b, preferredType) - scoreCandidate(a, preferredType))[0];
}

async function runMediaDownloader(link) {
  const token = getApifyToken();
  if (!token) {
    throw new Error('APIFY_API_TOKEN is not configured');
  }

  const actorId = process.env.APIFY_ACTOR_ID || DEFAULT_ACTOR_ID;
  const proxyConfiguration = {
    useApifyProxy: useApifyProxy(),
    apifyProxyGroups: proxyGroups()
  };

  const response = await axios.post(
    `${APIFY_BASE_URL}/v2/actors/${actorPath(actorId)}/run-sync-get-dataset-items?format=json&clean=true`,
    { link, proxyConfiguration },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Kira-MD/1.0'
      },
      timeout: APIFY_TIMEOUT_MS,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 1024 * 1024
    }
  );

  const items = Array.isArray(response.data) ? response.data : [];
  return {
    items,
    media: chooseMedia(items),
    raw: items
  };
}

async function resolveMedia(link, preferredType) {
  const result = await runMediaDownloader(link);
  return {
    ...result,
    media: chooseMedia(result.items, preferredType)
  };
}

async function downloadMedia(media) {
  const response = await axios.get(media.url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: MAX_MEDIA_BYTES,
    maxBodyLength: MAX_MEDIA_BYTES,
    headers: { 'User-Agent': 'Kira-MD/1.0' }
  });

  const buffer = Buffer.from(response.data);
  if (buffer.length > MAX_MEDIA_BYTES) {
    throw new Error('Downloaded media is too large to send through WhatsApp');
  }

  return {
    buffer,
    contentType: String(response.headers['content-type'] || '').split(';')[0].toLowerCase()
  };
}

module.exports = {
  resolveMedia,
  downloadMedia,
  MAX_MEDIA_BYTES
};