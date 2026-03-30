/**
 * authService.js
 * Refactored dual-token auth flow:
 * - Gateway token: OAuth client credentials for protected AppCube APIs.
 * - User identity token: getAccessToken(authCode) -> getUserInfo(authCode, accessToken).
 */

import axios from 'axios'

const DEFAULT_GET_ACCESS_TOKEN_PATH = '/kbz-api/service/ht012026__testing/0.0.1/getAccessToken'
const GET_ACCESS_TOKEN_PATH = (import.meta.env.VITE_KBZ_GET_ACCESS_TOKEN_PATH ?? DEFAULT_GET_ACCESS_TOKEN_PATH).trim()
const DEFAULT_GET_ACCESS_TOKEN_URL = 'https://wap.kbzpay.com/service/ht012026__testing/0.0.1/getAccessToken'
const GET_ACCESS_TOKEN_URL = (import.meta.env.VITE_KBZ_GET_ACCESS_TOKEN_URL ?? DEFAULT_GET_ACCESS_TOKEN_URL).trim()

const DEFAULT_GET_USER_INFO_PATH = '/kbz-api/service/ht012026__testing/0.0.1/getUserInfo'
const GET_USER_INFO_PATH = (import.meta.env.VITE_KBZ_GET_USER_INFO_PATH ?? DEFAULT_GET_USER_INFO_PATH).trim()
const DEFAULT_GET_USER_INFO_URL = 'https://wap.kbzpay.com/service/ht012026__testing/0.0.1/getUserInfo'
const GET_USER_INFO_URL = (import.meta.env.VITE_KBZ_GET_USER_INFO_URL ?? DEFAULT_GET_USER_INFO_URL).trim()

const DEFAULT_OAUTH_TOKEN_PATH = '/kbz-api/baas/auth/v1.0/oauth2/token'
const OAUTH_TOKEN_PATH = (import.meta.env.VITE_KBZ_OAUTH_TOKEN_PATH ?? DEFAULT_OAUTH_TOKEN_PATH).trim()
const DEFAULT_OAUTH_TOKEN_URL = 'https://wap.kbzpay.com/baas/auth/v1.0/oauth2/token'
const OAUTH_TOKEN_URL = (import.meta.env.VITE_KBZ_OAUTH_TOKEN_URL ?? DEFAULT_OAUTH_TOKEN_URL).trim()

const EXPIRY_BUFFER_MS = 60_000
const AUTH_SCOPES = String(import.meta.env.VITE_KBZ_AUTH_SCOPES ?? 'USER_NICKNAME,PLAINTEXT_MOBILE_PHONE,AUTH_BASE')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const AUTH_TIMEOUT_MS = Number(import.meta.env.VITE_KBZ_AUTH_TIMEOUT_MS ?? 45_000)
const FORCE_ENV_AUTH_CODE = String(import.meta.env.VITE_KBZ_FORCE_ENV_AUTH_CODE ?? '0') === '1'
const ALLOW_CACHED_AUTH_CODE = String(import.meta.env.VITE_KBZ_ALLOW_CACHED_AUTH_CODE ?? '0') === '1'

let _gatewayCache = {
  token: null,
  expiresAt: 0,
}

let _userSessionCache = {
  authCode: null,
  userInfoToken: null,
  expiresAt: 0,
  userInfo: null,
}

let _gatewayInFlight = null
let _userSessionInFlight = null

function normalizeServiceNamespace(urlOrPath) {
  const raw = String(urlOrPath ?? '').trim()
  if (!raw) return raw

  // Guard against accidental loss of double underscore in service namespace.
  return raw
    .replace('/service/ht012026testing/', '/service/ht012026__testing/')
    .replace('/kbz-api/service/ht012026testing/', '/kbz-api/service/ht012026__testing/')
    .replace(/ht012026testing/g, 'ht012026__testing')
}

function normalizeAuthCodeResult(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object') {
    return String(value.authCode ?? value.code ?? value.content ?? value.auth_code ?? '').trim()
  }
  return ''
}

function readAuthCodeFromRuntime() {
  if (typeof window === 'undefined') return ''

  // authCode is one-time use in production/simulator.
  // Do not reuse cached authCode unless explicitly enabled for debugging.
  if (ALLOW_CACHED_AUTH_CODE) {
    const windowAuthCode = String(window.__KBZ_AUTH_CODE ?? '').trim()
    if (windowAuthCode) {
      return windowAuthCode
    }

    const sessionAuthCode = String(window.sessionStorage?.getItem('kbz_auth_code') ?? '').trim()
    if (sessionAuthCode) {
      return sessionAuthCode
    }
  }

  const envAuthCode = String(import.meta.env.VITE_KBZ_AUTH_CODE ?? '').trim()
  if (envAuthCode) {
    const bridge = window.ma ?? window.my ?? null
    const hasMiniAppBridge = !!(bridge && typeof bridge.getAuthCode === 'function')

    if (import.meta.env.DEV || FORCE_ENV_AUTH_CODE) {
      return envAuthCode
    }

    if (!hasMiniAppBridge) {
      return envAuthCode
    }
  }

  return ''
}

function getMiniAppBridge() {
  if (typeof window === 'undefined') return null
  const bridge = window.ma ?? window.my ?? null
  if (!bridge || typeof bridge.getAuthCode !== 'function') return null
  return bridge
}

function resolveUrlForAxios(devPath, absoluteUrl) {
  // In Vite dev server, use proxy path. In UAT/prod, use absolute URL.
  const selected = import.meta.env.DEV ? devPath : absoluteUrl
  return normalizeServiceNamespace(selected)
}

async function requestAuthCodeWithGetAuthCode(bridge, timeoutMs) {
  return await new Promise((resolve, reject) => {
    let done = false

    const finish = (value) => {
      if (done) return
      done = true
      const code = normalizeAuthCodeResult(value)
      if (!code) {
        reject(new Error('[Auth] getAuthCode returned empty value.'))
        return
      }
      resolve(code)
    }

    const fail = (reason) => {
      if (done) return
      done = true
      reject(new Error(`[Auth] getAuthCode failed: ${reason}`))
    }

    const timer = setTimeout(() => fail('timeout'), timeoutMs)

    try {
      const maybeResult = bridge.getAuthCode({
        scopes: AUTH_SCOPES,
        success: (res) => {
          clearTimeout(timer)
          finish(res)
        },
        fail: (err) => {
          clearTimeout(timer)
          fail(err?.message ?? 'unknown error')
        },
      })

      if (maybeResult && typeof maybeResult.then === 'function') {
        maybeResult
          .then((res) => {
            clearTimeout(timer)
            finish(res)
          })
          .catch((err) => {
            clearTimeout(timer)
            fail(err?.message ?? String(err))
          })
      } else {
        const code = normalizeAuthCodeResult(maybeResult)
        if (code) {
          clearTimeout(timer)
          finish(code)
        }
      }
    } catch (err) {
      clearTimeout(timer)
      fail(err?.message ?? String(err))
    }
  })
}

async function getAuthCode() {
  const localAuthCode = readAuthCodeFromRuntime()
  if (localAuthCode) {
    console.log('[Auth] Full authCode:', localAuthCode)
    return localAuthCode
  }

  const miniApp = getMiniAppBridge()
  if (!miniApp) {
    throw new Error(
      '[Auth] authCode not found. In dev, set VITE_KBZ_AUTH_CODE. In mini app, ensure ma.getAuthCode is available.'
    )
  }

  try {
    const runtimeAuthCode = await requestAuthCodeWithGetAuthCode(miniApp, AUTH_TIMEOUT_MS)
    console.log('[Auth] Full authCode:', runtimeAuthCode)
    return runtimeAuthCode
  } catch (err1) {
    throw new Error(err1?.message ?? '[Auth] Failed to obtain authCode from mini app runtime.')
  }
}

function unwrapEnvelope(responseData) {
  return (
    responseData?.result ??
    responseData?.content ??
    responseData?.body?.content ??
    responseData?.data?.content ??
    responseData ??
    {}
  )
}

function extractAccessToken(responseData) {
  const payload = unwrapEnvelope(responseData)
  const raw =
    payload?.accessToken ??
    payload?.access_token ??
    payload?.token ??
    payload?.content ??
    payload?.body?.content ??
    payload?.data?.content ??
    responseData?.accessToken ??
    responseData?.access_token ??
    responseData?.token ??
    responseData?.content ??
    responseData?.body?.content ??
    responseData?.data?.content ??
    ''
  return String(raw ?? '').trim()
}

function extractExpiresIn(responseData) {
  const payload = unwrapEnvelope(responseData)
  const raw =
    payload?.expiresIn ??
    payload?.expires_in ??
    payload?.expiry ??
    payload?.body?.expiresIn ??
    payload?.body?.expires_in ??
    payload?.data?.expiresIn ??
    payload?.data?.expires_in ??
    responseData?.expiresIn ??
    responseData?.expires_in ??
    responseData?.expiry ??
    responseData?.body?.expiresIn ??
    responseData?.body?.expires_in ??
    responseData?.data?.expiresIn ??
    responseData?.data?.expires_in ??
    3600
  return Number(raw) || 3600
}

function extractUserInfo(responseData) {
  const payload = unwrapEnvelope(responseData)
  return (
    payload?.userInfo ??
    payload?.userinfo ??
    payload?.content ??
    payload?.body?.content ??
    payload?.data?.content ??
    responseData?.userInfo ??
    responseData?.userinfo ??
    responseData?.content ??
    responseData?.body?.content ??
    responseData?.data?.content ??
    null
  )
}

async function fetchGatewayAccessToken() {
  const clientId = String(import.meta.env.VITE_KBZ_CLIENT_ID ?? '').trim()
  const clientSecret = String(import.meta.env.VITE_KBZ_CLIENT_SECRET ?? '').trim()
  if (!clientId || !clientSecret) {
    throw new Error('[Auth] Missing VITE_KBZ_CLIENT_ID or VITE_KBZ_CLIENT_SECRET for gateway OAuth.')
  }

  const url = resolveUrlForAxios(OAUTH_TOKEN_PATH, OAUTH_TOKEN_URL)
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  let response
  try {
    response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  } catch (err) {
    throw new Error(
      `[Auth] OAuth token fetch failed (${err?.response?.status ?? 'NO_STATUS'}): ` +
      (err?.response?.data?.error_description ?? err?.response?.data?.resMsg ?? err?.message ?? 'unknown error')
    )
  }

  const accessToken = String(response?.data?.access_token ?? response?.data?.token ?? '').trim()
  const expiresIn = Number(response?.data?.expires_in ?? response?.data?.expiry ?? 3600) || 3600
  if (!accessToken) {
    throw new Error('[Auth] OAuth token response missing access_token. Check client_id/client_secret and environment.')
  }

  return { accessToken, expiresIn }
}

async function getGatewayTokenAndCache() {
  const now = Date.now()
  if (_gatewayCache.token && now < _gatewayCache.expiresAt - EXPIRY_BUFFER_MS) {
    return {
      token: _gatewayCache.token,
      expiresAt: _gatewayCache.expiresAt,
    }
  }

  if (_gatewayInFlight) return _gatewayInFlight

  _gatewayInFlight = (async () => {
    const oauth = await fetchGatewayAccessToken()
    _gatewayCache = {
      token: oauth.accessToken,
      expiresAt: now + oauth.expiresIn * 1000,
    }
    return {
      token: _gatewayCache.token,
      expiresAt: _gatewayCache.expiresAt,
    }
  })()

  try {
    return await _gatewayInFlight
  } finally {
    _gatewayInFlight = null
  }
}

async function postAuthApi({ name, devPath, absoluteUrl, body, extraHeaders = {} }) {
  const axiosUrl = resolveUrlForAxios(devPath, absoluteUrl)

  try {
    return await axios.post(
      axiosUrl,
      body,
      { headers: { 'Content-Type': 'application/json', ...extraHeaders } }
    )
  } catch (err) {
    throw new Error(
      `[Auth] ${name} failed (${err?.response?.status ?? 'NO_STATUS'}): ` +
      (err?.response?.data?.resMsg ?? err?.response?.data?.message ?? err?.message ?? 'unknown error')
    )
  }
}

async function loginUserSessionAndCache() {
  const now = Date.now()
  if (_userSessionCache.userInfoToken && now < _userSessionCache.expiresAt - EXPIRY_BUFFER_MS) {
    if (_userSessionCache.authCode) {
      console.log('[Auth] Full authCode (cached session):', _userSessionCache.authCode)
    }
    return {
      authCode: _userSessionCache.authCode,
      userInfoToken: _userSessionCache.userInfoToken,
      userInfo: _userSessionCache.userInfo,
      expiresAt: _userSessionCache.expiresAt,
    }
  }

  if (_userSessionInFlight) return _userSessionInFlight

  _userSessionInFlight = (async () => {
    const authCode = await getAuthCode()
    console.log('[Auth] Full authCode (session flow):', authCode)
    const gateway = await getGatewayTokenAndCache()
    const protectedHeaders = {
      'access-token': gateway.token,
    }

    const accessTokenResponse = await postAuthApi({
      name: 'getAccessToken',
      devPath: GET_ACCESS_TOKEN_PATH,
      absoluteUrl: GET_ACCESS_TOKEN_URL,
      body: {
        // Send all common key variants in one request to avoid consuming one-time authCode twice.
        authCode,
        code: authCode,
        auth_code: authCode,
      },
      extraHeaders: protectedHeaders,
    })

    const userInfoToken = extractAccessToken(accessTokenResponse?.data)
    const expiresIn = extractExpiresIn(accessTokenResponse?.data)

    if (!userInfoToken) {
      throw new Error('[Auth] No accessToken found in getAccessToken response.')
    }

    const userInfoResponse = await postAuthApi({
      name: 'getUserInfo',
      devPath: GET_USER_INFO_PATH,
      absoluteUrl: GET_USER_INFO_URL,
      body: { authCode, accessToken: userInfoToken },
      extraHeaders: protectedHeaders,
    })

    console.info('[Auth] getUserInfo raw response.body', {
      body: userInfoResponse?.body ?? userInfoResponse?.data?.body ?? null,
    })

    console.info('[Auth] getUserInfo raw response.data', {
      data: userInfoResponse?.data ?? null,
      topLevelKeys: Object.keys(userInfoResponse?.data || {}),
    })

    const userInfo = extractUserInfo(userInfoResponse?.data)

    _userSessionCache = {
      authCode,
      userInfoToken,
      expiresAt: now + expiresIn * 1000,
      userInfo,
    }

    return {
      authCode: _userSessionCache.authCode,
      userInfoToken: _userSessionCache.userInfoToken,
      userInfo: _userSessionCache.userInfo,
      expiresAt: _userSessionCache.expiresAt,
    }
  })()

  try {
    return await _userSessionInFlight
  } finally {
    _userSessionInFlight = null
  }
}

export async function getAccessToken() {
  const gateway = await getGatewayTokenAndCache()
  return gateway.token
}

export async function getUserInfo() {
  const session = await loginUserSessionAndCache()
  return session.userInfo ?? {}
}

export async function initializeAutoLogin() {
  const session = await loginUserSessionAndCache()
  return {
    authCode: session.authCode,
    userInfoAccessToken: session.userInfoToken,
    userInfo: session.userInfo ?? {},
    expiresAt: session.expiresAt,
  }
}

export function clearTokenCache() {
  _gatewayCache = { token: null, expiresAt: 0 }
  _userSessionCache = { authCode: null, userInfoToken: null, expiresAt: 0, userInfo: null }
  _gatewayInFlight = null
  _userSessionInFlight = null
}