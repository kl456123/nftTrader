import { Order, Asset, Network, ECSignature, OrderJSON, UnsignedOrder, OrderSide } from './types'
import { BigNumber } from 'bignumber.js'
import { ContractsWrapper } from './contracts_wrapper'
import { Interface, FunctionFragment } from '@ethersproject/abi'
import {
  NULL_ADDRESS,
  MERKLE_VALIDATOR_MAINNET,
  MERKLE_VALIDATOR_RINKEBY,
  MAX_EXPIRATION_MONTHS,
  MAX_DIGITS_IN_UNSIGNED_256_INT,
  NULL_BYTES,
  ATOMICIZER_MAINNET,
  ATOMICIZER_RINKEBY,
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

export const merkleValidatorByNetwork = {
  [Network.Main]: MERKLE_VALIDATOR_MAINNET,
  [Network.Rinkeby]: MERKLE_VALIDATOR_RINKEBY,
}

export const atomicizerByNetwork = {
  [Network.Main]: ATOMICIZER_MAINNET,
  [Network.Rinkeby]: ATOMICIZER_RINKEBY,
}

export const encodeCall = (abi: FunctionFragment, parameters: unknown[]) => {
  return utils.hexlify(utils.concat([Interface.getSighash(abi), utils.defaultAbiCoder.encode(abi.inputs, parameters)]))
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

export const encodeReplacementPattern = (abi: FunctionFragment, replaceKind: boolean[]) => {
  if (abi.inputs.length !== replaceKind.length) {
    throw new Error(`replaceKind length is not matched with inputs! (${replaceKind.length}!=${abi.inputs.length})`)
  }
  // 4 initial bytes of 0x00 for the method hash.
  const output: Buffer[] = []
  const data: Buffer[] = []
  const dynamicOffset = abi.inputs.reduce((len, { type }) => {
    const match = type.match(/\[(.+)\]$/)
    return len + (match ? parseInt(match[1], 10) * 32 : 32)
  }, 0)
  abi.inputs
    .map(({ type, arrayLength }, ind) => ({
      bitmask: replaceKind[ind] ? 255 : 0,
      type,
      isDynamic: arrayLength === -1 ? true : false,
      value: arrayLength !== null ? [] : generateDefaultValue(type),
    }))
    .reduce((offset, { bitmask, type, isDynamic, value }) => {
      // The 0xff bytes in the mask select the replacement bytes. All other bytes are
      const cur = Buffer.alloc(utils.defaultAbiCoder.encode([type], [value]).length).fill(bitmask)
      if (isDynamic) {
        if (bitmask) {
          throw new Error('Replacement is not supported for dynamic parameters.')
        }
        output.push(Buffer.alloc(utils.defaultAbiCoder.encode(['uint256'], [dynamicOffset]).length))
        data.push(cur)
        return offset + cur.length
      }
      output.push(cur)
      return offset
    }, dynamicOffset)

  const methodIdMask = Buffer.alloc(4)
  const mask = Buffer.concat([methodIdMask, Buffer.concat(output.concat(data))])
  return `0x${mask.toString('hex')}`
}

export const encodeSell = (schema: Interface, asset: Asset, address: string, validatorAddress?: string) => {
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
      replacementPattern: encodeReplacementPattern(schema.getFunction(funcName), [
        false,
        true,
        false,
        false,
        false,
        false,
      ]),
    }
  } else {
    const funcName = 'safeTransferFrom'
    return {
      target: asset.tokenAddress,
      calldata: schema.encodeFunctionData(funcName, [address, NULL_ADDRESS, asset.tokenId]),
      replacementPattern: encodeReplacementPattern(schema.getFunction(funcName), [false, true, false]),
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
  // const salt = randomNumber.times(factor)
  const salt = new BigNumber(Math.floor(Math.random() * (9999999999 - 1000000)) + 1000000)
  return salt
}

export async function signTypedDataAsync(
  provider: ethers.providers.BaseProvider,
  message: { domain: TypedDataDomain; types: Record<string, Array<TypedDataField>>; value: Record<string, any> },
  signerAddress: string
): Promise<ECSignature> {
  let signature: undefined
  const wallet = new ethers.Wallet(passwdBook[signerAddress.toLowerCase()], provider)
  const rawSignature = await wallet._signTypedData(message.domain, message.types, message.value)
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

export function assignOrdersToSides(order: Order, matchingOrder: UnsignedOrder): { buy: Order; sell: Order } {
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

export const encodeBuy = (schema: Interface, asset: Asset, address: string, validatorAddress?: string) => {
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
      replacementPattern: encodeReplacementPattern(schema.getFunction(funcName), [
        true,
        false,
        false,
        false,
        false,
        false,
      ]),
    }
  } else {
    const funcName = 'safeTransferFrom'
    return {
      target: asset.tokenAddress,
      calldata: schema.encodeFunctionData(funcName, [address, NULL_ADDRESS, asset.tokenId]),
      replacementPattern: encodeReplacementPattern(schema.getFunction(funcName), [true, false, false]),
    }
  }
}

export const toBaseUnitAmount = (amount: BigNumber, decimals: number): BigNumber => {
  const unit = new BigNumber(10).pow(decimals)
  const baseUnitAmount = amount.times(unit)
  const hasDecimals = baseUnitAmount.decimalPlaces() !== 0
  if (hasDecimals) {
    throw new Error(`Invalid unit amount: ${amount.toString()} - Too many decimal places`)
  }
  return baseUnitAmount
}
