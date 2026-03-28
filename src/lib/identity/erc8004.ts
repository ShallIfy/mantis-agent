import { publicClient } from '@/lib/chain/config';
import { ERC8004 } from '@/lib/chain/contracts';
import { encodeFunctionData } from 'viem';

// Minimal ABI for IdentityRegistry (ERC-8004)
const IDENTITY_REGISTRY_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'setMetadata',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
      { name: 'metadataValue', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'getMetadata',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// MANTIS agent metadata (follows ERC-8004 schema)
export const MANTIS_AGENT_METADATA = {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  name: 'MANTIS',
  description: 'Autonomous CeDeFi agent on Mantle | Built on Agent Scaffold + MCP + Agent Skills | OBSERVE → DECIDE → ACT',
  image: 'https://raw.githubusercontent.com/ShallIfy/mantis-agent/main/public/mantis-logo.png',
  services: [
    {
      name: 'mantis-defi-agent',
      endpoint: 'http://72.61.209.138:3001/api/agent/run',
      version: '1.0.0',
      skills: ['yield-optimization', 'cedefi-routing', 'risk-assessment', 'portfolio-analysis'],
      domains: ['defi', 'mantle'],
    },
    {
      name: 'mantis-chat',
      endpoint: 'http://72.61.209.138:3001/api/chat',
      version: '1.0.0',
      skills: ['conversational-defi', 'mantle-knowledge'],
      domains: ['defi', 'mantle'],
    },
  ],
  x402Support: false,
  active: true,
  supportedTrust: ['ERC-8004'],
  supportedProtocols: ['MCP'],
  techStack: {
    ai: 'Claude Sonnet 4.6 (extended thinking)',
    chain: 'Mantle (Chain ID 5000)',
    mcp: 'Mantle Agent Scaffold (19 tools)',
    dataFeeds: ['Aave V3', 'Bybit Earn', 'CIAN Protocol', 'DefiLlama'],
  },
};

// Get total registered agents
export async function getTotalAgents(): Promise<number> {
  try {
    const total = await publicClient.readContract({
      address: ERC8004.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'totalSupply',
    });
    return Number(total);
  } catch {
    return 0;
  }
}

// Check if an address has registered agents
export async function getAgentCount(address: string): Promise<number> {
  try {
    const count = await publicClient.readContract({
      address: ERC8004.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });
    return Number(count);
  } catch {
    return 0;
  }
}

// Get agent URI by token ID
export async function getAgentURI(agentId: bigint): Promise<string | null> {
  try {
    return await publicClient.readContract({
      address: ERC8004.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'tokenURI',
      args: [agentId],
    });
  } catch {
    return null;
  }
}

// Prepare registration calldata (for unsigned tx)
export function prepareRegistrationCalldata(agentURI: string): `0x${string}` {
  return encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI],
  });
}

// Get full registration info for display
export async function getRegistrationInfo() {
  const totalAgents = await getTotalAgents();
  return {
    registry: ERC8004.IDENTITY_REGISTRY,
    reputationRegistry: ERC8004.REPUTATION_REGISTRY,
    chain: 'Mantle Mainnet (5000)',
    totalRegisteredAgents: totalAgents,
    mantisMetadata: MANTIS_AGENT_METADATA,
    registrationCost: 'Free (gas only, ~0.001 MNT)',
    standard: 'ERC-721 + ERC-8004',
  };
}
