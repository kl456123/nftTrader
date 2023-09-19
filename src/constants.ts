import { constants } from 'ethers'

export const ORDERBOOK_VERSION = 1

export const API_BASE_MAINNET = 'https://api.opensea.io'
export const ORDERBOOK_PATH = `/wyvern/v${ORDERBOOK_VERSION}`
export const API_PATH = `/api/v${ORDERBOOK_VERSION}`
export const NULL_ADDRESS = constants.AddressZero
export const MAX_UINT_256 = constants.MaxUint256
export const DEFAULT_BUYER_FEE_BASIS_POINTS = 0
export const DEFAULT_SELLER_FEE_BASIS_POINTS = 250
export const PROTOCOL_SELLER_BOUNTY_BASIS_POINTS = 100
export const INVERSE_BASIS_POINT = 10000
export const DEFAULT_MAX_BOUNTY = DEFAULT_SELLER_FEE_BASIS_POINTS

// export const MERKLE_VALIDATOR_MAINNET = '0xbaf2127b49fc93cbca6269fade0f7f31df4c88a7'
// export const MERKLE_VALIDATOR_RINKEBY = '0x45b594792a5cdc008d0de1c1d69faa3d16b3ddc1'
// export const ATOMICIZER_MAINNET = '0xc99f70bfd82fb7c8f8191fdfbfb735606b15e5c5'
// export const ATOMICIZER_RINKEBY = '0x613a12b156ffa304f714cc38d6ae5d3df70d8063'

export const MIN_EXPIRATION_MINUTES = 15
export const MAX_EXPIRATION_MONTHS = 6
export const DEFAULT_GAS_INCREASE_FACTOR = 1.01
export const PROTOCOL_FEE_RECIPIENT =
  '0x5b3256965e7c3cf26e11fcaf296dfc8807c01073'
// export const EXCHANGE_MAINNET = '0x7f268357A8c2552623316e2562D90e642bB538E5'
// export const EXCHANGE_RINKEBY = '0x7f268357A8c2552623316e2562D90e642bB538E5'
export const MAX_DIGITS_IN_UNSIGNED_256_INT = 78

export const NULL_BYTES = '0x'
export const NULL_BLOCK_HASH = constants.HashZero

export const EIP_712_WYVERN_DOMAIN_NAME = 'Wyvern Exchange Contract'
export const EIP_712_WYVERN_DOMAIN_VERSION = '2.3'

export const EIP_712_ORDER_TYPES = {
  Order: [
    { name: 'exchange', type: 'address' },
    { name: 'maker', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'makerRelayerFee', type: 'uint256' },
    { name: 'takerRelayerFee', type: 'uint256' },
    { name: 'makerProtocolFee', type: 'uint256' },
    { name: 'takerProtocolFee', type: 'uint256' },
    { name: 'feeRecipient', type: 'address' },
    { name: 'feeMethod', type: 'uint8' },
    { name: 'side', type: 'uint8' },
    { name: 'saleKind', type: 'uint8' },
    { name: 'target', type: 'address' },
    { name: 'howToCall', type: 'uint8' },
    { name: 'calldata', type: 'bytes' },
    { name: 'replacementPattern', type: 'bytes' },
    { name: 'staticTarget', type: 'address' },
    { name: 'staticExtradata', type: 'bytes' },
    { name: 'paymentToken', type: 'address' },
    { name: 'basePrice', type: 'uint256' },
    { name: 'extra', type: 'uint256' },
    { name: 'listingTime', type: 'uint256' },
    { name: 'expirationTime', type: 'uint256' },
    { name: 'salt', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
}

export const WETH_ADDRESS = '0xc778417E063141139Fce010982780140Aa0cD5Ab'
export const ETH_ADDRESS = NULL_ADDRESS
