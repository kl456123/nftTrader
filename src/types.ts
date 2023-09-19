import { BigNumber } from 'bignumber.js'
import { BigNumberish, BytesLike } from 'ethers'

export enum Network {
  Main = 'main',
  Rinkeby = 'rinkeby',
  OEC = 'OEC',
  OEC_Test = 'OEC_Test',
  BSC_Test = 'BSC_Test',
  BSC = 'BSC',
}

export interface APIConfig {
  apiKey?: string
  networkName?: Network
  apiBaseUrl?: string
}

export interface ECSignature {
  v: number
  r: string
  s: string
}

export enum FeeMethod {
  ProtocolFee = 0,
  SplitFee = 1,
}
export enum SaleKind {
  FixedPrice = 0,
  DutchAuction = 1,
}
export enum OrderSide {
  Buy = 0,
  Sell = 1,
}

export enum HowToCall {
  Call = 0,
  DelegateCall = 1,
}

export interface UnhashedOrder {
  feeMethod: FeeMethod
  side: OrderSide
  saleKind: SaleKind
  howToCall: HowToCall
  quantity: BigNumber

  // address
  exchange: string
  taker: string
  maker: string
  feeRecipient: string
  target: string
  paymentToken: string

  // bytes
  calldata: string
  replacementPattern: string

  makerRelayerFee: BigNumber
  takerRelayerFee: BigNumber
  makerProtocolFee: BigNumber
  takerProtocolFee: BigNumber
  makerReferrerFee: BigNumber
  listingTime: BigNumber
  expirationTime: BigNumber
  salt: BigNumber
  basePrice: BigNumber
  extra: BigNumber

  metadata: ExchangeMetadata

  staticTarget: string
  staticExtradata: string
}

export interface UnsignedOrder extends UnhashedOrder {
  hash?: string
}

export interface AssetBase {
  tokenId: string
  tokenAddress: string
  name?: string
  schemaName?: SchemaName
}

export enum SchemaName {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  ENSShortNameAuction = 'ENSShortNameAuction',
}

export interface Asset extends AssetBase {
  // name: string;
  // address: string;
  // description:string;
  // tokenSymbol: string;
  // imageUrl: string;
  // externalLink?: string;
  // wikiLink?:string;
}

export interface Bundle {
  assets: Asset[]
  schemas: SchemaName[]
  name?: string
  description?: string
  external_link?: string
}

export interface Order extends UnsignedOrder, Partial<ECSignature> {
  cancelledOrFinalized?: boolean
  markedInvalid?: boolean
  createdTime?: BigNumber
  asset?: Asset
  nonce?: number
}

export interface ExchangeMetadataForAsset {
  asset: Asset
  schema: SchemaName
  referrerAddress?: string
}
export interface ExchangeMetadataForBundle {
  bundle: Bundle
  referrerAddress?: string
}
export type ExchangeMetadata =
  | ExchangeMetadataForAsset
  | ExchangeMetadataForBundle

export interface OrderJSON extends Partial<ECSignature> {
  // Base wyvern fields
  exchange: string
  maker: string
  taker: string
  makerRelayerFee: string
  takerRelayerFee: string
  makerProtocolFee: string
  takerProtocolFee: string
  feeRecipient: string
  feeMethod: number
  side: number
  saleKind: number
  target: string
  howToCall: number

  calldata: string
  replacementPattern: string
  paymentToken: string
  basePrice: string
  extra: string
  listingTime: number | string
  expirationTime: number | string
  salt: string

  makerReferrerFee: string
  quantity: string

  // createdTime is undefined when order hasn't been posted yet
  createdTime?: number | string
  metadata: ExchangeMetadata

  // validate result order match
  staticTarget: string
  staticExtradata: string

  nonce?: number
}

export interface OrderQuery extends Partial<OrderJSON> {
  asset_contract_address?: string
  payment_token_address?: string
  token_id?: number | string
  token_ids?: Array<number | string>
  saleKind?: SaleKind
  listed_after?: number | string
  listed_before?: number | string

  // pagination
  limit?: number
  offset?: number
}

export interface OrderbookResponse {
  orders: OrderJSON[]
  count: number
}

export interface ProtocolFees {
  // Fee for Protocol levied on sellers
  protocolSellerFeeBasisPoints: number
  // Fee for Protocol levied on buyers
  protocolBuyerFeeBasisPoints: number
  // Fee for the collection owner levied on sellers
  devSellerFeeBasisPoints: number
  // Fee for the collection owner levied on buyers
  devBuyerFeeBasisPoints: number
}

export interface ComputedFees extends ProtocolFees {
  // Total fees. dev + protocol
  totalBuyerFeeBasisPoints: number
  totalSellerFeeBasisPoints: number

  // Fees that go to whoever refers the order to the taker.
  // Comes out of protocol fees
  sellerBountyBasisPoints: number
}

export type RawOrderJSON = Omit<
  OrderJSON,
  | 'makerReferrerFee'
  | 'quantity'
  | 'createdTime'
  | 'metadata'
  | 'hash'
  | 'v'
  | 'r'
  | 's'
>

export type AtomicMatchParameters = [
  [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string
  ],
  [
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish
  ],
  [
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish
  ],
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  [BigNumberish, BigNumberish],
  [BytesLike, BytesLike, BytesLike, BytesLike, BytesLike]
]
