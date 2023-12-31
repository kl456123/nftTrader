import {
  Order,
  Asset,
  Network,
  ECSignature,
  OrderJSON,
  UnsignedOrder,
  OrderSide,
} from './types'
import { BigNumber } from 'bignumber.js'
import { ContractsWrapper } from './contracts_wrapper'
import { Interface, FunctionFragment } from '@ethersproject/abi'
import {
  NULL_ADDRESS,
  MAX_EXPIRATION_MONTHS,
  MAX_DIGITS_IN_UNSIGNED_256_INT,
  NULL_BYTES,
} from './constants'
import { passwdBook } from './passwd'
import { ethers, utils } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'

export const assetFromJSON = (asset: any): Asset => {
  const fromJSON: Asset = {
    tokenId: asset.token_id.toString(),
    tokenAddress: asset.asset_contract.address,
    name: asset.name,
  }
  return fromJSON
}

export const orderFromJSON = (order: any): Order => {
  const createdDate = new Date(`${order.created_date}Z`)

  const fromJSON: Order = {
    hash: order.order_hash || order.hash,
    cancelledOrFinalized: order.cancelled || order.finalized,
    markedInvalid: order.marked_invalid,
    metadata: order.metadata,
    quantity: new BigNumber(order.quantity || 1),
    exchange: order.exchange,
    maker: order.maker.address,
    taker: order.taker.address,
    // fees including protocol fee and relayer fee
    makerRelayerFee: new BigNumber(order.maker_relayer_fee),
    takerRelayerFee: new BigNumber(order.taker_relayer_fee),
    makerProtocolFee: new BigNumber(order.maker_protocol_fee),
    takerProtocolFee: new BigNumber(order.taker_protocol_fee),
    makerReferrerFee: new BigNumber(order.maker_referrer_fee || 0),
    feeMethod: order.fee_method,
    feeRecipient: order.fee_recipient.address,
    side: order.side,
    saleKind: order.sale_kind,
    target: order.target,
    howToCall: order.how_to_call,
    calldata: order.calldata,
    replacementPattern: order.replacement_pattern,
    staticTarget: order.static_target,
    staticExtradata: order.static_extradata,
    paymentToken: order.payment_token,

    basePrice: new BigNumber(order.base_price),
    extra: new BigNumber(order.extra),

    createdTime: new BigNumber(Math.round(createdDate.getTime() / 1000)),
    listingTime: new BigNumber(order.listing_time),
    expirationTime: new BigNumber(order.expiration_time),

    salt: new BigNumber(order.salt),
    v: parseInt(order.v),
    r: order.r,
    s: order.s,

    asset: order.asset ? assetFromJSON(order.asset) : undefined,
  }
  return fromJSON
}

export function validateAndFormatWalletAddress(address: string) {
  if (!address) {
    throw new Error('No wallet address found')
  }
  if (!utils.isAddress(address)) {
    throw new Error('Invalid wallet address')
  }
  if (address == NULL_ADDRESS) {
    throw new Error('Wallet cannot be the null address')
  }
  return address.toLowerCase()
}

export type AddressBook = {
  mockNFT: string
  mockToken: string
  atomicizer: string
  validator: string
  registry: string
  tokenTransferProxy: string
  exchange: string
  exchangev2: string
  multicall: string
  weth9: string
}

export const addressesByNetwork: { [network in Network]?: AddressBook } = {
  [Network.BSC_Test]: {
    mockNFT: '0xC8A514128358498F26ccDDCc35926C0b16e153E3',
    mockToken: '0x1daC23e41Fc8ce857E86fD8C1AE5b6121C67D96d',
    atomicizer: '0x443EF018e182d409bcf7f794d409bCea4C73C2C7',
    validator: '0x078b9259b4dc543eCa8F85A70d4635F403238D21',
    registry: '0x6CEa74418A513C95D0efa4D75349Cb1f6ee7A335',
    tokenTransferProxy: '',
    exchange: '0xd99cae3fac551f6b6ba7b9f19bdd316951eeee98',
    exchangev2: '0xb90b9A8e129D359F80F7b6fccf503B525e1B6455',
    multicall: '',
    weth9: '',
  },
  [Network.Main]: {
    mockNFT: '',
    mockToken: '',
    atomicizer: '0xc99f70bfd82fb7c8f8191fdfbfb735606b15e5c5',
    validator: '0xbaf2127b49fc93cbca6269fade0f7f31df4c88a7',
    registry: '0xa5409ec958c83c3f309868babaca7c86dcb077c1',
    tokenTransferProxy: '',
    exchange: '',
    exchangev2: '0x7f268357A8c2552623316e2562D90e642bB538E5',
    multicall: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
    weth9: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  [Network.Rinkeby]: {
    mockNFT: '0x43BB99CC6EdfA45181295Cce4528F08f54C58aa4',
    mockToken: '0x8b5947506A87276dD0c17f9c6cD3FAc5DD06Fba7',
    atomicizer: '0x1d9D0D4f3C47187CD483b11E1556aEA838f0270d',
    validator: '0x35411178dfF431Be291e95bF4925b9932AC07785',
    registry: '0xEb3542517464701cD4d42B5bDC49c1cB21d83331',
    tokenTransferProxy: '0xdb043586cc1a0a784329733f5caa39f2167d8c0f',
    exchange: '',
    exchangev2: '0x2d1FBe9075e01bB16dc4C5c209be8CEBb3db1eB1',
    multicall: '0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821',
    weth9: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
  },
}
export type AggregatorAddresses = {
  converter: string
  marketRegistry: string
  gemSwap: string
}

export const aggregatorByNetwork: {
  [network in Network]?: AggregatorAddresses
} = {
  [Network.Rinkeby]: {
    converter: '0x24C54C8d88eab1b13B6352b07789a5b12a2Fd7c0',
    marketRegistry: '0xf94640CF21F5f3930ed1fE9d730bD8c85102EA62',
    gemSwap: '0xCC10A64d6ADfa9d55291bD9ddd2510e11Ce3274A',
  },
}

export const encodeCall = (abi: FunctionFragment, parameters: unknown[]) => {
  return utils.hexlify(
    utils.concat([
      Interface.getSighash(abi),
      utils.defaultAbiCoder.encode(abi.inputs, parameters),
    ])
  )
}

export const encodeDefaultCall = (abi: FunctionFragment, address: string) => {
  const parameters = abi.inputs.map((input) => {})
  return encodeCall(abi, parameters)
}

export const generateDefaultValue = (type: string): any => {
  switch (type) {
    case 'address':
    case 'bytes20':
      /* Null address is sometimes checked in transfer calls. */
      // But we need to use 0x000 because bitwise XOR won't work if there's a 0 in the act
      return '0x0000000000000000000000000000000000000000'
    case 'bytes32':
      return '0x0000000000000000000000000000000000000000000000000000000000000000'
    case 'bool':
      return false
    case 'int':
    case 'uint':
    case 'uint8':
    case 'uint16':
    case 'uint32':
    case 'uint64':
    case 'uint256':
      return 0
    default:
      throw new Error('Default value not yet implemented for type: ' + type)
  }
}

export const encodeReplacementPattern = (
  abi: FunctionFragment,
  replaceKind: boolean[]
) => {
  if (abi.inputs.length !== replaceKind.length) {
    throw new Error(
      `replaceKind length is not matched with inputs! (${replaceKind.length}!=${abi.inputs.length})`
    )
  }
  const output: Buffer[] = []
  const data: Buffer[] = []
  const dynamicOffset = abi.inputs.reduce((len, { type }) => {
    const match = type.match(/\[(.+)\]$/)
    return len + (match ? parseInt(match[1], 10) * 32 : 32)
  }, 0)
  abi.inputs
    .map(({ arrayChildren, type, arrayLength }, ind) => ({
      bitmask: replaceKind[ind] ? 255 : 0,
      type: arrayChildren ? arrayChildren.type : type,
      isDynamic: arrayLength === -1 ? true : false,
      value: generateDefaultValue(arrayChildren ? arrayChildren.type : type),
    }))
    .reduce((offset, { bitmask, type, isDynamic, value }) => {
      // The 0xff bytes in the mask select the replacement bytes. All other bytes are
      const cur = Buffer.alloc(
        utils.defaultAbiCoder.encode([type], [value]).length / 2 - 1
      ).fill(bitmask)
      if (isDynamic) {
        if (bitmask) {
          throw new Error(
            'Replacement is not supported for dynamic parameters.'
          )
        }
        output.push(
          Buffer.alloc(
            utils.defaultAbiCoder.encode(['uint256'], [dynamicOffset]).length /
              2 -
              1
          )
        )
        data.push(cur)
        return offset + cur.length
      }
      output.push(cur)
      return offset
    }, dynamicOffset)

  // 4 initial bytes of 0x00 for the method hash.
  const methodIdMask = Buffer.alloc(4)
  const mask = Buffer.concat([methodIdMask, Buffer.concat(output.concat(data))])
  return `0x${mask.toString('hex')}`
}

export const encodeSell = (
  schema: Interface,
  asset: Asset,
  address: string,
  validatorAddress?: string
) => {
  if (validatorAddress) {
    const funcName = 'matchERC721WithSafeTransferUsingCriteria'
    return {
      target: validatorAddress,
      calldata: schema.encodeFunctionData(funcName, [
        address,
        NULL_ADDRESS,
        asset.tokenAddress,
        asset.tokenId,
        ethers.constants.HashZero /*root*/,
        [] /*proof*/,
      ]),
      replacementPattern: encodeReplacementPattern(
        schema.getFunction(funcName),
        [false, true, false, false, false, false]
      ),
    }
  } else {
    const funcName = 'safeTransferFrom'
    return {
      target: asset.tokenAddress,
      calldata: schema.encodeFunctionData(funcName, [
        address,
        NULL_ADDRESS,
        asset.tokenId,
      ]),
      replacementPattern: encodeReplacementPattern(
        schema.getFunction(funcName),
        [false, true, false]
      ),
    }
  }
}

/**
 * The longest time that an order is valid for is six months from the current date
 * @returns unix timestamp
 */
export const getMaxOrderExpirationTimestamp = () => {
  const maxExpirationDate = new Date()

  maxExpirationDate.setDate(maxExpirationDate.getDate() + MAX_EXPIRATION_MONTHS)

  return Math.round(maxExpirationDate.getTime() / 1000)
}

export const generatePseudoRandomSalt = () => {
  // BigNumber.random returns a pseudo-random number between 0 & 1 with a passed in number
  // Source: https://mikemcl.github.io/bignumber.js/#random
  const randomNumber = BigNumber.random(MAX_DIGITS_IN_UNSIGNED_256_INT)
  const factor = new BigNumber(10).pow(MAX_DIGITS_IN_UNSIGNED_256_INT - 1)
  const salt = randomNumber.times(factor)
  return salt
}

export async function signTypedDataAsync(
  provider: ethers.providers.BaseProvider,
  message: {
    domain: TypedDataDomain
    types: Record<string, Array<TypedDataField>>
    value: Record<string, any>
  },
  signerAddress: string
): Promise<ECSignature> {
  let signature: undefined
  const wallet = new ethers.Wallet(
    passwdBook[signerAddress.toLowerCase()],
    provider
  )
  const rawSignature = await wallet._signTypedData(
    message.domain,
    message.types,
    message.value
  )
  return utils.splitSignature(rawSignature)
}

export const orderToJSON = (order: Order): OrderJSON => {
  const asJSON: OrderJSON = {
    exchange: order.exchange.toLowerCase(),
    maker: order.maker.toLowerCase(),
    taker: order.taker.toLowerCase(),
    makerRelayerFee: order.makerRelayerFee.toString(),
    takerRelayerFee: order.takerRelayerFee.toString(),
    makerProtocolFee: order.makerProtocolFee.toString(),
    takerProtocolFee: order.takerProtocolFee.toString(),
    makerReferrerFee: order.makerReferrerFee.toString(),
    feeMethod: order.feeMethod,
    feeRecipient: order.feeRecipient.toLowerCase(),
    side: order.side,
    saleKind: order.saleKind,
    target: order.target.toLowerCase(),
    howToCall: order.howToCall,
    calldata: order.calldata,
    replacementPattern: order.replacementPattern,
    staticTarget: order.staticTarget.toLowerCase(),
    staticExtradata: order.staticExtradata,
    paymentToken: order.paymentToken.toLowerCase(),
    quantity: order.quantity.toString(),
    basePrice: order.basePrice.toString(),
    extra: order.extra.toString(),
    createdTime: order.createdTime ? order.createdTime.toString() : undefined,
    listingTime: order.listingTime.toString(),
    expirationTime: order.expirationTime.toString(),
    salt: order.salt.toString(),

    metadata: order.metadata,

    v: order.v,
    r: order.r,
    s: order.s,

    nonce: order.nonce,
  }
  return asJSON
}

export function assignOrdersToSides(
  order: Order,
  matchingOrder: UnsignedOrder
): { buy: Order; sell: Order } {
  const isSellOrder = order.side == OrderSide.Sell

  let buy: Order
  let sell: Order
  if (!isSellOrder) {
    buy = order
    sell = {
      ...matchingOrder,
      v: buy.v,
      r: buy.r,
      s: buy.s,
    }
  } else {
    sell = order
    buy = {
      ...matchingOrder,
      v: sell.v,
      r: sell.r,
      s: sell.s,
    }
  }

  return { buy, sell }
}

export const encodeBuy = (
  schema: Interface,
  asset: Asset,
  address: string,
  validatorAddress?: string
) => {
  if (validatorAddress) {
    const funcName = 'matchERC721WithSafeTransferUsingCriteria'
    return {
      target: validatorAddress,
      calldata: schema.encodeFunctionData(funcName, [
        NULL_ADDRESS,
        address,
        asset.tokenAddress,
        asset.tokenId,
        ethers.constants.HashZero /*root*/,
        [] /*proof*/,
      ]),
      replacementPattern: encodeReplacementPattern(
        schema.getFunction(funcName),
        [true, false, false, false, false, false]
      ),
    }
  } else {
    const funcName = 'safeTransferFrom'
    return {
      target: asset.tokenAddress,
      calldata: schema.encodeFunctionData(funcName, [
        address,
        NULL_ADDRESS,
        asset.tokenId,
      ]),
      replacementPattern: encodeReplacementPattern(
        schema.getFunction(funcName),
        [true, false, false]
      ),
    }
  }
}

export const toBaseUnitAmount = (
  amount: BigNumber,
  decimals: number
): BigNumber => {
  const unit = new BigNumber(10).pow(decimals)
  const baseUnitAmount = amount.times(unit)
  const hasDecimals = baseUnitAmount.decimalPlaces() !== 0
  if (hasDecimals) {
    throw new Error(
      `Invalid unit amount: ${amount.toString()} - Too many decimal places`
    )
  }
  return baseUnitAmount
}

export async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

export const encodeAtomicizedSell = (
  schemas: Interface[],
  assets: Asset[],
  address: string,
  atomicizer: Interface,
  target: string
) => {
  const { atomicizedCalldata, atomicizedReplacementPattern } =
    encodeAtomicizedCalldata(
      atomicizer,
      schemas,
      assets,
      address,
      OrderSide.Sell
    )

  return {
    calldata: atomicizedCalldata,
    replacementPattern: atomicizedReplacementPattern,
    target,
  }
}

export const encodeAtomicizedBuy = (
  schemas: Interface[],
  assets: Asset[],
  address: string,
  atomicizer: Interface,
  target: string
) => {
  const { atomicizedCalldata, atomicizedReplacementPattern } =
    encodeAtomicizedCalldata(
      atomicizer,
      schemas,
      assets,
      address,
      OrderSide.Buy
    )

  return {
    calldata: atomicizedCalldata,
    replacementPattern: atomicizedReplacementPattern,
    target,
  }
}

// Helpers for atomicizer

function encodeAtomicizedCalldata(
  atomicizer: Interface,
  schemas: Array<Interface>,
  assets: Asset[],
  address: string,
  side: OrderSide
) {
  const encoder = side === OrderSide.Sell ? encodeSell : encodeBuy

  try {
    const transactions = assets.map((asset, i) => {
      const schema = schemas[i]
      const { target, calldata } = encoder(schema, asset, address)
      return {
        calldata,
        abi: schema.getFunction('transfer'),
        address: target,
        value: new BigNumber(0),
      }
    })

    const atomicizedCalldata = atomicizer.encodeFunctionData('atomicize', [
      transactions.map((t) => t.address),
      transactions.map((t) => t.value),
      transactions.map((t) => new BigNumber((t.calldata.length - 2) / 2)), // subtract 2 for '0x'
      transactions.map((t) => t.calldata).reduce((x, y) => x + y.slice(2)), // cut off the '0x'
    ])

    // const kind = side === OrderSide.Buy ? FunctionInputKind.Owner : undefined;
    const kind = side === OrderSide.Buy ? [] : []

    const atomicizedReplacementPattern = encodeAtomicizedReplacementPattern(
      transactions.map((t) => t.abi),
      kind
    )

    if (!atomicizedCalldata || !atomicizedReplacementPattern) {
      throw new Error(
        `Invalid calldata: ${atomicizedCalldata}, ${atomicizedReplacementPattern}`
      )
    }
    return {
      atomicizedCalldata,
      atomicizedReplacementPattern,
    }
  } catch (error) {
    console.error({ schemas, assets, address, side })
    throw new Error(
      `Failed to construct your order: likely something strange about this type of`
      +`item. OpenSea has been notified. Please contact us in Discord! Original error: {error}`
    )
  }
}

/**
 * Encodes the atomicized replacementPattern for a supplied ABI and replace kind
 * @param   abis array of AnnotatedFunctionABI
 * @param   replaceKind Parameter kind to replace
 * @return  The resulting encoded replacementPattern
 */
export const encodeAtomicizedReplacementPattern = (
  abis: FunctionFragment[],
  replaceKind: boolean[]
): string => {
  const allowReplaceByte = '1'
  const doNotAllowReplaceByte = '0'
  /* Four bytes for method ID. */
  const maskArr: string[] = [
    doNotAllowReplaceByte,
    doNotAllowReplaceByte,
    doNotAllowReplaceByte,
    doNotAllowReplaceByte,
  ]
  return ''
}
