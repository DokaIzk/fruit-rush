import { describe, expect, it } from 'vitest'
import { encodeAbiParameters, encodeEventTopics, parseAbiParameters } from 'viem'

import {
  BOAST_ABI,
  BOAST_MAINNET,
  describeBoastError,
  formatCusd,
  parseBoastId,
} from '../boast'
import { CUSD_MAINNET } from '../../auth/constants'

function boastMintedLog(boastId: bigint) {
  const topics = encodeEventTopics({
    abi: BOAST_ABI,
    eventName: 'BoastMinted',
    args: { boastId, player: BOAST_MAINNET },
  })
  // Non-indexed: score (uint256), gameMode (string), timestamp (uint256)
  const data = encodeAbiParameters(parseAbiParameters('uint256, string, uint256'), [
    1234n,
    'classic',
    1760000000n,
  ])
  return { data, topics: [...topics] as readonly `0x${string}`[] }
}

describe('formatCusd', () => {
  it('formats the default 0.99 cUSD fee', () => {
    expect(formatCusd(990000000000000000n)).toBe('0.99')
  })

  it('formats whole tokens without decimals', () => {
    expect(formatCusd(1000000000000000000n)).toBe('1')
  })

  it('keeps small fractional fees readable', () => {
    expect(formatCusd(1990000000000000n)).toBe('0.002')
  })
})

describe('parseBoastId', () => {
  it('extracts the boastId from a BoastMinted log', () => {
    const { data, topics } = boastMintedLog(7n)
    expect(parseBoastId([{ data, topics }])).toBe(7)
  })

  it('returns null when no BoastMinted log is present', () => {
    expect(parseBoastId([])).toBeNull()
    expect(
      parseBoastId([{ data: '0x', topics: ['0xbaddead'] }]),
    ).toBeNull()
  })})

describe('describeBoastError', () => {
  it('maps user rejection to a short cancel message', () => {
    expect(describeBoastError(new Error('User rejected the request'))).toBe('Request cancelled')
  })

  it('maps contract revert selectors to player-facing copy', () => {
    expect(describeBoastError(new Error('NonceAlreadyUsed(0x1)'))).toBe('That boast was already minted')
    expect(describeBoastError(new Error('InvalidSignature()'))).toBe('Signature rejected by the contract')
  })

  it('maps backend already-signed conflicts', () => {
    expect(describeBoastError(new Error('Already signed: signature already generated'))).toContain(
      'already signed',
    )
  })

  it('passes through friendly messages it knows nothing about', () => {
    expect(describeBoastError(new Error('Not enough cUSD — the boast fee is 0.99 cUSD'))).toContain(
      '0.99 cUSD',
    )
  })

  it('handles non-Error throws', () => {
    expect(describeBoastError('NonceAlreadyUsed')).toBe('That boast was already minted')
  })
})

describe('boast addresses', () => {
  it('keeps the mainnet boast and cUSD constants in sync with AGENTS.md', () => {
    expect(BOAST_MAINNET.toLowerCase()).toBe('0xac9c17eed06d935c255e5e5c668c5ef07ec79181')
    expect(CUSD_MAINNET.toLowerCase()).toBe('0x765de816845861e75a25fca122bb6898b8b1282a')
  })
})
