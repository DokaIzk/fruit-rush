import { describe, expect, it, vi } from 'vitest'

import { apiBootError, assertApiBaseUrl } from '../api'

const RENDER_URL = 'https://fruit-rush.onrender.com'

describe('apiBootError', () => {
  it('passes in development even with no URL (localhost fallback is fine)', () => {
    expect(apiBootError(undefined, false)).toBeNull()
    expect(apiBootError('http://localhost:3000', false)).toBeNull()
  })

  it('fails a production build with no URL', () => {
    const problem = apiBootError(undefined, true)
    expect(problem).toMatch(/VITE_API_URL/)
    expect(problem).toMatch(/not set/)
  })

  it('fails a production build with an empty / whitespace URL', () => {
    expect(apiBootError('', true)).toMatch(/not set/)
    expect(apiBootError('   ', true)).toMatch(/not set/)
  })

  it('fails a production build pointing at localhost / 127.0.0.1', () => {
    expect(apiBootError('http://localhost:3000', true)).toMatch(/localhost/i)
    expect(apiBootError('http://127.0.0.1:3000', true)).toMatch(/localhost/i)
  })

  it('accepts a production build with the Render URL', () => {
    expect(apiBootError(RENDER_URL, true)).toBeNull()
  })
})

describe('assertApiBaseUrl', () => {
  it('throws a clear error in production with no VITE_API_URL', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_API_URL', '')
    try {
      expect(() => assertApiBaseUrl()).toThrowError(/VITE_API_URL is not set for this build/)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('does not throw in development', () => {
    expect(() => assertApiBaseUrl()).not.toThrow()
  })
})
