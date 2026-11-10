import { createPublicClient, http, defineChain } from 'viem'

const celo = defineChain({
  id: 42220,
  name: 'Celo',
  network: 'celo',
  nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
  rpcUrls: { default: { http: ['https://forno.celo.org'] } },
})

const client = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') })

const tournament = '0xc396fa8D8fA76457eAD5772a936a896716D2640F'
const operator = '0xA8064027F3831617525b8A6BD30efd9946d3800c'
const boast = '0xAc9C17Eed06D935C255E5E5c668C5EF07EC79181'
const wantSigner = '0x2C8cE6B6b27baEffFF47db7258D5156EfE71438C'

const ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'hasRole', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'trustedSigner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
]

try {
  const { keccak256, toHex } = await import('viem')
  const operatorRole = keccak256(toHex('OPERATOR_ROLE'))
  const finalizerRole = keccak256(toHex('FINALIZER_ROLE'))
  const upgraderRole = keccak256(toHex('UPGRADER_ROLE'))
  const adminRole = '0x0000000000000000000000000000000000000000000000000000000000000000'
  const hasOp = await client.readContract({ address: tournament, abi: ABI, functionName: 'hasRole', args: [operatorRole, operator] })
  const hasFin = await client.readContract({ address: tournament, abi: ABI, functionName: 'hasRole', args: [finalizerRole, operator] })
  const hasUpg = await client.readContract({ address: tournament, abi: ABI, functionName: 'hasRole', args: [upgraderRole, operator] })
  const hasAdmin = await client.readContract({ address: tournament, abi: ABI, functionName: 'hasRole', args: [adminRole, operator] })
  console.log('backend operator hasRole OPERATOR_ROLE:', hasOp)
  console.log('backend operator hasRole FINALIZER_ROLE:', hasFin)
  console.log('backend operator hasRole UPGRADER_ROLE:', hasUpg)
  console.log('backend operator hasRole DEFAULT_ADMIN_ROLE:', hasAdmin)
} catch (e) {
  console.log('Tournament role read FAILED:', e.message?.slice(0, 200))
}

try {
  const signer = await client.readContract({ address: boast, abi: ABI, functionName: 'trustedSigner' })
  console.log('Boast trustedSigner (mainnet):', signer, signer?.toLowerCase() === wantSigner.toLowerCase() ? '== backend signer ✓' : '!= backend signer ✗')
} catch (e) {
  console.log('Boast read FAILED:', e.message?.slice(0, 200))
}
