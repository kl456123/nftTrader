import {
  Asset,
  UnhashedOrder,
  ComputedFees,
  OrderSide,
  APIConfig,
  Network,
  SaleKind,
  FeeMethod,
  HowToCall,
  UnsignedOrder,
  ECSignature,
  RawOrderJSON,
  Order,
  SchemaName,
  AtomicMatchParameters,
} from './types'
import { Schema, schemas } from './schemas'
import { WalletProvider } from './wallet_provider'
import {
  validateAndFormatWalletAddress,
  encodeSell,
  encodeBuy,
  getMaxOrderExpirationTimestamp,
  generatePseudoRandomSalt,
  orderToJSON,
  signTypedDataAsync,
  assignOrdersToSides,
  toBaseUnitAmount,
  delay,
} from './utils'
import { requireOrdersCanMatch, requireOrderCalldataCanMatch, MAX_ERROR_LENGTH } from './debugging'
import { passwdBook } from './passwd'
import { providers, ethers } from 'ethers'
import { BigNumber } from 'bignumber.js'
import { API } from './api'
import { ContractsWrapper } from './contracts_wrapper'
import { Logger, logger as defaultLogger } from './logger'
import {
  DEFAULT_BUYER_FEE_BASIS_POINTS,
  DEFAULT_SELLER_FEE_BASIS_POINTS,
  DEFAULT_MAX_BOUNTY,
  PROTOCOL_SELLER_BOUNTY_BASIS_POINTS,
  MIN_EXPIRATION_MINUTES,
  PROTOCOL_FEE_RECIPIENT,
  NULL_ADDRESS,
  NULL_BYTES,
  EIP_712_ORDER_TYPES,
  EIP_712_WYVERN_DOMAIN_NAME,
  EIP_712_WYVERN_DOMAIN_VERSION,
  INVERSE_BASIS_POINT,
  NULL_BLOCK_HASH,
  DEFAULT_GAS_INCREASE_FACTOR,
} from './constants'

const MAX_UINT_256 = new BigNumber(2).pow(256).minus(1)

export class Trader {
  public readonly api: API
  public logger: Logger
  public provider: providers.BaseProvider
  public contractsWrapper: ContractsWrapper
  public gasIncreaseFactor = DEFAULT_GAS_INCREASE_FACTOR

  private networkName: Network
  constructor(protected walletProvider: WalletProvider, apiConfig: APIConfig = {}, logger?: Logger) {
    const provider = walletProvider.provider
    this.api = new API(apiConfig)
    const network = apiConfig.networkName || Network.Main
    this.contractsWrapper = new ContractsWrapper(network, provider)

    this.networkName = network
    // Debugging: default to nothing
    this.logger = logger || defaultLogger
    this.provider = provider
  }

  public async createSellOrder({
    asset,
    accountAddress,
    startAmount,
    endAmount,
    quantity = 1,
    listingTime,
    expirationTime = getMaxOrderExpirationTimestamp(),
    paymentTokenAddress,
    extraBountyBasisPoints = 0,
    buyerAddress,
  }: {
    asset: Asset
    accountAddress: string
    startAmount: number
    endAmount?: number
    quantity?: number
    listingTime?: number
    expirationTime?: number
    paymentTokenAddress?: string
    extraBountyBasisPoints?: number
    buyerAddress?: string
  }): Promise<Order> {
    const order = await this.makeSellOrder({
      asset,
      quantity,
      accountAddress,
      startAmount,
      endAmount,
      listingTime,
      expirationTime,
      paymentTokenAddress: paymentTokenAddress || NULL_ADDRESS,
      extraBountyBasisPoints,
      buyerAddress: buyerAddress || NULL_ADDRESS,
    })

    await this.sellOrderValidationAndApprovals({ order, accountAddress })

    // no need to hash off-chain
    const hashedOrder = {
      ...order,
      hash: NULL_BYTES,
    }

    // sign order
    let signature
    try {
      signature = await this.authorizeOrder(hashedOrder)
    } catch (error) {
      console.error(error)
      throw new Error('You declined to authorize your auction')
    }

    const orderWithSignature = {
      ...hashedOrder,
      ...signature,
    }
    return orderWithSignature
    // const confirmedOrder = await this.api.postOrder(orderToJSON(orderWithSignature))
    // return confirmedOrder
  }

  /**
   * For a fungible token to use in trades (like W-ETH), get the amount
   *  approved for use by the Wyvern transfer proxy.
   * Internal method exposed for dev flexibility.
   * @param param0 __namedParameters Object
   * @param accountAddress Address for the user's wallet
   * @param tokenAddress Address for the token's contract
   * @param proxyAddress User's proxy address. If undefined, uses the token transfer proxy address
   */
  public async getApprovedTokenCount({
    accountAddress,
    tokenAddress,
    proxyAddress,
  }: {
    accountAddress: string
    tokenAddress: string
    proxyAddress?: string
  }) {
    const addressToApprove = proxyAddress || this.contractsWrapper.tokenTransferProxy.address
    const schema = this.getSchema(SchemaName.ERC20)
    const tokenContract = new ethers.Contract(tokenAddress, schema.contractInterface, this.provider)
    const approved = await tokenContract.allowance(accountAddress, addressToApprove)
    return new BigNumber(approved.toString())
  }

  public async approveFungibleToken({
    accountAddress,
    tokenAddress,
    proxyAddress,
    minimumAmount = MAX_UINT_256,
  }: {
    accountAddress: string
    tokenAddress: string
    proxyAddress?: string
    minimumAmount?: BigNumber
  }): Promise<string | null> {
    const approvedAmount = await this.getApprovedTokenCount({
      accountAddress,
      tokenAddress,
      proxyAddress,
    })

    if (approvedAmount.isGreaterThanOrEqualTo(minimumAmount)) {
      this.logger.warn('Already approved enough currency for trading')
      return null
    }

    this.logger.info(`Not enough token approved for trade: ${approvedAmount} approved to transfer ${tokenAddress}`)
    const wallet = this.walletProvider.getSigner(accountAddress)
    const schema = this.getSchema(SchemaName.ERC20)
    const tokenContract = new ethers.Contract(tokenAddress, schema.contractInterface, this.provider)
    const { hash } = await tokenContract.connect(wallet).approve(proxyAddress, MAX_UINT_256.toFixed(0))
    return hash
  }

  public async initializeProxy(accountAddress: string): Promise<string> {
    this.logger.info(`Initializing proxy for account: ${accountAddress}`)
    const txnData = { from: accountAddress }
    const wallet = this.walletProvider.getSigner(accountAddress)
    const gasEstimate = await this.contractsWrapper.wyvernProxyRegistry.estimateGas.registerProxy(txnData)
    const { hash: transactionHash } = await this.contractsWrapper.wyvernProxyRegistry
      .connect(wallet)
      .registerProxy({ ...txnData, gasLimit: this.correctGasAmount(gasEstimate.toNumber()) })
    const proxyAddress = await this.getProxy(accountAddress, 10)
    if (!proxyAddress) {
      throw new Error('Failed to initialize your account :( Please restart your wallet/browser and try again!')
    }

    return proxyAddress
  }

  public async getNonce(accountAddress: string) {
    return await this.contractsWrapper.wyvernExchangeBulkCancellations.nonces(accountAddress)
  }

  /**
   * Generate the signature for authorizing an order
   * @param order Unsigned wyvern order
   * @returns order signature in the form of v, r, s, also an optional nonce
   */
  public async authorizeOrder(order: UnsignedOrder): Promise<(ECSignature & { nonce?: number }) | null> {
    const signerAddress = order.maker
    // eip712
    const orderForSigning: RawOrderJSON = {
      maker: order.maker,
      exchange: order.exchange,
      taker: order.taker,
      makerRelayerFee: order.makerRelayerFee.toString(),
      takerRelayerFee: order.takerRelayerFee.toString(),
      makerProtocolFee: order.makerProtocolFee.toString(),
      takerProtocolFee: order.takerProtocolFee.toString(),
      feeRecipient: order.feeRecipient,
      feeMethod: order.feeMethod,
      side: order.side,
      saleKind: order.saleKind,
      target: order.target,
      howToCall: order.howToCall,
      calldata: order.calldata,
      replacementPattern: order.replacementPattern,
      staticTarget: NULL_ADDRESS,
      staticExtradata: '0x',
      paymentToken: order.paymentToken,
      basePrice: order.basePrice.toString(),
      extra: order.extra.toString(),
      listingTime: order.listingTime.toString(),
      expirationTime: order.expirationTime.toString(),
      salt: order.salt.toFixed(0),
    }
    const signerOrderNonce = await this.getNonce(signerAddress)
    const message = {
      types: EIP_712_ORDER_TYPES,
      domain: {
        name: EIP_712_WYVERN_DOMAIN_NAME,
        version: EIP_712_WYVERN_DOMAIN_VERSION,
        chainId: this.networkName == Network.Main ? 1 : 4,
        verifyingContract: order.exchange,
      },
      primaryType: 'Order',
      value: { ...orderForSigning, nonce: signerOrderNonce.toNumber() },
    }
    const ecSignature = await signTypedDataAsync(this.provider, message, signerAddress)
    return { ...ecSignature, nonce: signerOrderNonce.toNumber() }
  }

  public async getProxy(accountAddress: string, retries = 0): Promise<string | null> {
    let proxyAddress: string | null = await this.contractsWrapper.wyvernProxyRegistry.proxies(accountAddress)
    if (proxyAddress == '0x') {
      throw new Error(
        "Couldn't retrieve your account from the blockchain - make sure you're on the correct Ethereum network!"
      )
    }

    if (!proxyAddress || proxyAddress == NULL_ADDRESS) {
      if (retries > 0) {
        await delay(1000)
        return await this.getProxy(accountAddress, retries - 1)
      }
      proxyAddress = null
    }
    return proxyAddress
  }

  public async approveAll({
    assets,
    accountAddress,
    proxyAddress,
  }: {
    assets: Asset[]
    accountAddress: string
    proxyAddress?: string
  }) {
    proxyAddress = proxyAddress || (await this.getProxy(accountAddress, 0)) || undefined
    if (!proxyAddress) {
      proxyAddress = await this.initializeProxy(accountAddress)
    }
    const contractsWithApproveAll: Set<string> = new Set()
    return await Promise.all(
      assets.map(async (asset, i) => {
        // handle approve functions for all kinds of asset
        switch (asset.schemaName) {
          case SchemaName.ERC721:
          case SchemaName.ERC1155:
          case SchemaName.ENSShortNameAuction:
            // Handle NFTs and SFTs
            // eslint-disable-next-line no-case-declarations
            return await this.approveSemiOrNonFungibleToken({
              tokenId: asset.tokenId.toString(),
              tokenAddress: asset.tokenAddress,
              accountAddress,
              proxyAddress,
              schemaName: asset.schemaName,
              skipApproveAllIfTokenAddressIn: contractsWithApproveAll,
            })
        }
      })
    )
  }

  public async approveSemiOrNonFungibleToken({
    tokenId,
    tokenAddress,
    accountAddress,
    proxyAddress,
    skipApproveAllIfTokenAddressIn = new Set(),
    schemaName = SchemaName.ERC721,
  }: {
    tokenId: string
    tokenAddress: string
    accountAddress: string
    proxyAddress?: string
    skipApproveAllIfTokenAddressIn?: Set<string>
    schemaName?: SchemaName
  }): Promise<string | null> {
    // approve nft to proxy
    const schema = this.getSchema(schemaName)
    const tokenContract = new ethers.Contract(tokenAddress, schema.contractInterface, this.provider)

    if (!proxyAddress) {
      proxyAddress = (await this.getProxy(accountAddress)) || undefined
      if (!proxyAddress) {
        throw new Error('Uninitialized account')
      }
    }
    const isApprovedForAll = await tokenContract.isApprovedForAll(accountAddress, proxyAddress as string)
    if (isApprovedForAll) {
      this.logger.info('Already approved proxy for all tokens')
      return null
    } else {
      if (skipApproveAllIfTokenAddressIn.has(tokenAddress)) {
        this.logger.info('Already approving proxy for all tokens in another transaction')
        return null
      }
      skipApproveAllIfTokenAddressIn.add(tokenAddress)
      const wallet = this.walletProvider.getSigner(accountAddress)
      const { hash } = await tokenContract.connect(wallet).setApprovalForAll(proxyAddress, true)
      return hash
    }
  }

  public async createBuyOrder({
    asset,
    accountAddress,
    startAmount,
    endAmount,
    quantity,
  }: {
    asset: Asset
    accountAddress: string
    startAmount: number
    endAmount: number
    quantity: number
    expirationTime?: number
    listingTime?: number
  }) {}

  private getSchema(schemaName?: SchemaName): Schema {
    const schemaName_ = schemaName || SchemaName.ERC721
    const schema = schemas[this.networkName].filter((s) => s.name === schemaName_)[0]
    if (!schema) {
      throw new Error(`Trading for this asset (${schemaName_}) is not yet supported.`)
    }
    return schema
  }

  public async makeSellOrder({
    asset,
    accountAddress,
    startAmount,
    endAmount,
    quantity,
    expirationTime = getMaxOrderExpirationTimestamp(),
    listingTime,
    paymentTokenAddress,
    extraBountyBasisPoints,
    buyerAddress,
  }: {
    asset: Asset
    accountAddress: string
    startAmount: number
    endAmount?: number
    quantity: number
    expirationTime?: number
    listingTime?: number
    paymentTokenAddress: string
    extraBountyBasisPoints: number
    buyerAddress: string
  }): Promise<UnhashedOrder> {
    accountAddress = validateAndFormatWalletAddress(accountAddress)
    const quantityBN = new BigNumber(quantity)
    const { totalSellerFeeBasisPoints, totalBuyerFeeBasisPoints, sellerBountyBasisPoints } = await this.computeFees({
      asset,
      side: OrderSide.Sell,
      extraBountyBasisPoints,
    })

    const schema = this.getSchema(asset.schemaName)

    const { target, calldata, replacementPattern } = encodeSell(
      this.contractsWrapper.merkleValidator.interface,
      asset,
      accountAddress,
      this.contractsWrapper.merkleValidator.address
    )
    const orderSaleKind = endAmount != null && endAmount !== startAmount ? SaleKind.DutchAuction : SaleKind.FixedPrice
    // price
    const { basePrice, extra, paymentToken } = await this.getPriceParameters(
      OrderSide.Sell,
      paymentTokenAddress,
      expirationTime,
      startAmount,
      endAmount
    )

    // time
    const times = this.getTimeParameters({
      expirationTimestamp: expirationTime,
      listingTimestamp: listingTime,
    })

    // fees
    const {
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee,
      takerProtocolFee,
      makerReferrerFee,
      feeRecipient,
      feeMethod,
    } = this.getSellFeeParameters(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints, sellerBountyBasisPoints)
    const exchange = this.contractsWrapper.wyvernExchangeBulkCancellations.address
    return {
      exchange,
      maker: accountAddress,
      taker: buyerAddress,
      quantity: quantityBN,
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee,
      takerProtocolFee,
      makerReferrerFee,
      staticTarget: NULL_ADDRESS,
      staticExtradata: '0x',
      feeMethod,
      feeRecipient,
      side: OrderSide.Sell,
      saleKind: orderSaleKind,
      target,
      howToCall: target === this.contractsWrapper.merkleValidator.address ? HowToCall.DelegateCall : HowToCall.Call,
      calldata,
      replacementPattern,
      paymentToken,
      basePrice,
      extra,
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: generatePseudoRandomSalt(),
      metadata: {
        asset,
        schema: schema.name,
      },
    }
  }

  public async computeFees({
    asset,
    side,
    extraBountyBasisPoints = 0,
  }: {
    asset: Asset
    side: OrderSide
    extraBountyBasisPoints?: number
  }): Promise<ComputedFees> {
    let protocolBuyerFeeBasisPoints = DEFAULT_BUYER_FEE_BASIS_POINTS
    let protocolSellerFeeBasisPoints = DEFAULT_SELLER_FEE_BASIS_POINTS
    let devBuyerFeeBasisPoints = 0
    let devSellerFeeBasisPoints = 0
    let maxTotalBountyBPS = DEFAULT_MAX_BOUNTY
    if (asset) {
      asset
    }
    // Compute bounty
    const sellerBountyBasisPoints = side == OrderSide.Sell ? extraBountyBasisPoints : 0
    // Check that bounty is in range of the opensea fee
    const bountyTooLarge = sellerBountyBasisPoints + PROTOCOL_SELLER_BOUNTY_BASIS_POINTS > maxTotalBountyBPS
    if (sellerBountyBasisPoints > 0 && bountyTooLarge) {
      let errorMessage = `Total bounty exceeds the maximum for this asset type (${maxTotalBountyBPS / 100}%).`
      throw new Error(errorMessage)
    }

    return {
      totalBuyerFeeBasisPoints: protocolBuyerFeeBasisPoints + devBuyerFeeBasisPoints,
      totalSellerFeeBasisPoints: protocolSellerFeeBasisPoints + devSellerFeeBasisPoints,
      protocolBuyerFeeBasisPoints,
      protocolSellerFeeBasisPoints,
      devBuyerFeeBasisPoints,
      devSellerFeeBasisPoints,
      sellerBountyBasisPoints,
    }
  }
  private getTimeParameters({
    expirationTimestamp = getMaxOrderExpirationTimestamp(),
    listingTimestamp,
    isMatchingOrder = false,
  }: {
    expirationTimestamp?: number
    listingTimestamp?: number
    isMatchingOrder?: boolean
  }) {
    // listing time
    const minListingTimestamp = Math.round(Date.now() / 1000)

    if (listingTimestamp && listingTimestamp < minListingTimestamp) {
      throw new Error('Listing time cannot be in the past.')
    }
    if (listingTimestamp && listingTimestamp >= expirationTimestamp) {
      throw new Error('Listing time must be before the expiration time.')
    }
    // Small offset to account for latency
    listingTimestamp = listingTimestamp || Math.round(Date.now() / 1000 - 100)

    // expiration time
    const maxExpirationTimeStamp = getMaxOrderExpirationTimestamp()

    if (!isMatchingOrder && expirationTimestamp === 0) {
      throw new Error('Expiration time cannot be 0')
    }

    if (parseInt(expirationTimestamp.toString()) != expirationTimestamp) {
      throw new Error(`Expiration timestamp must be a whole number of seconds`)
    }

    if (expirationTimestamp > maxExpirationTimeStamp) {
      throw new Error('Expiration time must not exceed six months from now')
    }

    // The minimum expiration time has to be at least fifteen minutes from now
    const minExpirationTimestamp = listingTimestamp + MIN_EXPIRATION_MINUTES * 60

    if (!isMatchingOrder && expirationTimestamp < minExpirationTimestamp) {
      throw new Error(`Expiration time must be at least ${MIN_EXPIRATION_MINUTES} minutes from the listing date`)
    }
    return {
      listingTime: new BigNumber(listingTimestamp),
      expirationTime: new BigNumber(expirationTimestamp),
    }
  }

  private getSellFeeParameters(
    totalBuyerFeeBasisPoints: number,
    totalSellerFeeBasisPoints: number,
    sellerBountyBasisPoints = 0
  ) {
    const feeRecipient = PROTOCOL_FEE_RECIPIENT
    const makerRelayerFee = new BigNumber(totalSellerFeeBasisPoints)
    const takerRelayerFee = new BigNumber(totalBuyerFeeBasisPoints)

    return {
      makerRelayerFee,
      takerRelayerFee,
      makerProtocolFee: new BigNumber(0),
      takerProtocolFee: new BigNumber(0),
      makerReferrerFee: new BigNumber(sellerBountyBasisPoints),
      feeRecipient,
      feeMethod: FeeMethod.SplitFee,
    }
  }

  private async getPriceParameters(
    orderSide: OrderSide,
    tokenAddress: string,
    expirationTime: number,
    startAmount: number,
    endAmount?: number
  ) {
    const priceDiff = endAmount != null ? startAmount - endAmount : 0
    const paymentToken = tokenAddress.toLowerCase()
    const isEther = tokenAddress == NULL_ADDRESS
    // Validation
    if (isNaN(startAmount) || startAmount == null || startAmount < 0) {
      throw new Error(`Starting price must be a number >= 0`)
    }
    if (!isEther && !tokenAddress) {
      throw new Error(`No ERC-20 token found for '${paymentToken}'`)
    }

    if (isEther && orderSide === OrderSide.Buy) {
      throw new Error(`Offers must use wrapped ETH or an ERC-20 token.`)
    }

    if (priceDiff < 0) {
      throw new Error('End price must be less than or equal to the start price.')
    }
    if (priceDiff > 0 && expirationTime == 0) {
      throw new Error('Expiration time must be set if order will change in price.')
    }

    const decimals = 18
    const basePrice = toBaseUnitAmount(new BigNumber(startAmount), decimals)
    const extra = new BigNumber(priceDiff)
    return { basePrice, extra, paymentToken }
  }

  /**
   * Fullfill or "take" an order for an asset, either a buy or sell order
   * @param param0 __namedParamaters Object
   * @param order The order to fulfill, a.k.a. "take"
   * @param accountAddress The taker's wallet address
   * @param recipientAddress The optional address to receive the order's item(s) or curriencies. If
   * @param referrerAddress The optional address that referred the order
   * @returns Transaction hash for fulfilling the order
   */
  public async fulfillOrder({
    order,
    accountAddress,
    recipientAddress,
    referrerAddress,
  }: {
    order: Order
    accountAddress: string
    recipientAddress?: string
    referrerAddress?: string
  }): Promise<string> {
    const matchingOrder = this.makeMatchingOrder({
      order,
      accountAddress,
      recipientAddress: recipientAddress || accountAddress,
    })

    const { buy, sell } = assignOrdersToSides(order, matchingOrder)

    const metadata = this.getMetadata(order, referrerAddress)

    const transactionHash = await this.atomicMatch({
      buy,
      sell,
      accountAddress,
      metadata,
    })

    return transactionHash
  }

  private getMetadata(order: Order, referrerAddress?: string) {
    const referrer = referrerAddress || order.metadata.referrerAddress
    if (referrer && ethers.utils.isAddress(referrer)) {
      return referrer
    }
    return undefined
  }

  // Throws
  public async sellOrderValidationAndApprovals({
    order,
    accountAddress,
  }: {
    order: UnhashedOrder
    accountAddress: string
  }) {
    const assets =
      'bundle' in order.metadata ? order.metadata.bundle.assets : order.metadata.asset ? [order.metadata.asset] : []
    // approve proxy for nft and erc20
    await this.approveAll({
      assets: assets,
      accountAddress,
    })

    // For fulfilling bids,
    // need to approve access to fungible token because of the way fees are paid
    // This can be done at a higher level to show UI
    const tokenAddress = order.paymentToken
    if (tokenAddress != NULL_ADDRESS) {
      const minimumAmount = new BigNumber(order.basePrice)
      const tokenTransferProxyAddress = this.contractsWrapper.tokenTransferProxy.address
      await this.approveFungibleToken({
        accountAddress,
        tokenAddress,
        minimumAmount,
        proxyAddress: tokenTransferProxyAddress,
      })
    }

    // Check sell parameters
    const sellValid = await this.contractsWrapper.wyvernExchangeBulkCancellations.validateOrderParameters_(
      [
        order.exchange,
        order.maker,
        order.taker,
        order.feeRecipient,
        order.target,
        order.staticTarget,
        order.paymentToken,
      ],
      [
        order.makerRelayerFee.toFixed(0),
        order.takerRelayerFee.toFixed(0),
        order.makerProtocolFee.toFixed(0),
        order.takerProtocolFee.toFixed(0),
        order.basePrice.toFixed(0),
        order.extra.toFixed(0),
        order.listingTime.toFixed(0),
        order.expirationTime.toFixed(0),
        order.salt.toFixed(0),
      ],
      order.feeMethod,
      order.side,
      order.saleKind,
      order.howToCall,
      order.calldata,
      order.replacementPattern,
      order.staticExtradata,
      { from: accountAddress }
    )

    if (!sellValid) {
      console.error(order)
      throw new Error(`Failed to validate sell order parameters. Make sure you're on the right network!`)
    }
  }

  public async getAssetBalance(
    { accountAddress, asset }: { accountAddress: string; asset: Asset },
    retries = 1
  ): Promise<BigNumber> {
    const schema = this.getSchema(asset.schemaName)

    // ERC20 or ERC1155 (non-Enjin)

    const tokenContract = new ethers.Contract(asset.tokenAddress, schema.contractInterface, this.provider)

    const count = await tokenContract.balanceOf(accountAddress)

    return new BigNumber(count.toString())
  }

  /**
   * Get the balance of a fungible token.
   * Convenience method for getAssetBalance for fungibles
   * @param param0 __namedParameters Object
   * @param accountAddress Account address to check
   * @param tokenAddress The address of the token to check balance for
   * @param schemaName Optional schema name for the fungible token
   * @param retries Number of times to retry if balance is undefined
   */
  public async getTokenBalance(
    {
      accountAddress,
      tokenAddress,
      schemaName = SchemaName.ERC20,
    }: {
      accountAddress: string
      tokenAddress: string
      schemaName?: SchemaName
    },
    retries = 1
  ) {
    const asset: Asset = {
      tokenId: '',
      tokenAddress,
      schemaName,
    }
    return this.getAssetBalance({ accountAddress, asset }, retries)
  }

  // Throws
  public async buyOrderValidationAndApprovals({
    order,
    counterOrder,
    accountAddress,
  }: {
    order: UnhashedOrder
    counterOrder?: Order
    accountAddress: string
  }) {
    const tokenAddress = order.paymentToken

    if (tokenAddress != NULL_ADDRESS) {
      const balance = await this.getTokenBalance({
        accountAddress,
        tokenAddress,
      })

      /* NOTE: no buy-side auctions for now, so sell.saleKind === 0 */
      let minimumAmount = new BigNumber(order.basePrice)
      if (counterOrder) {
        minimumAmount = await this.getRequiredAmountForTakingSellOrder(counterOrder)
      }

      // Check WETH balance
      if (balance.toNumber() < minimumAmount.toNumber()) {
        throw new Error('Insufficient balance.')
      }

      const tokenTransferProxyAddress = this.contractsWrapper.tokenTransferProxy.address

      // Check token approval
      // This can be done at a higher level to show UI
      await this.approveFungibleToken({
        accountAddress,
        tokenAddress,
        minimumAmount,
        proxyAddress: tokenTransferProxyAddress,
      })
    }

    // Check order formation
    const buyValid = await this.contractsWrapper.wyvernExchangeBulkCancellations.validateOrderParameters_(
      [
        order.exchange,
        order.maker,
        order.taker,
        order.feeRecipient,
        order.target,
        order.staticTarget,
        order.paymentToken,
      ],
      [
        order.makerRelayerFee.toFixed(0),
        order.takerRelayerFee.toFixed(0),
        order.makerProtocolFee.toFixed(0),
        order.takerProtocolFee.toFixed(0),
        order.basePrice.toFixed(0),
        order.extra.toFixed(0),
        order.listingTime.toFixed(0),
        order.expirationTime.toFixed(0),
        order.salt.toFixed(0),
      ],
      order.feeMethod,
      order.side,
      order.saleKind,
      order.howToCall,
      order.calldata,
      order.replacementPattern,
      order.staticExtradata,
      { from: accountAddress }
    )
    if (!buyValid) {
      console.error(order)
      throw new Error(`Failed to validate buy order parameters. Make sure you're on the right network!`)
    }
  }

  /**
   * Validate against Wyvern that a buy and sell order can match
   * @param param0 __namedParameters Object
   * @param buy The buy order to validate
   * @param sell The sell order to validate
   * @param accountAddress Address for the user's wallet
   * @param shouldValidateBuy Whether to validate the buy order individually.
   * @param shouldValidateSell Whether to validate the sell order individually.
   * @param retries How many times to retry if validation fails
   */
  public async validateMatch(
    {
      buy,
      sell,
      accountAddress,
      shouldValidateBuy = false,
      shouldValidateSell = false,
    }: {
      buy: Order
      sell: Order
      accountAddress: string
      shouldValidateBuy?: boolean
      shouldValidateSell?: boolean
    },
    retries = 1
  ): Promise<boolean> {
    try {
      if (shouldValidateBuy) {
        const buyValid = await this.validateOrder(buy)
        this.logger.info(`Buy order is valid: ${buyValid}`)

        if (!buyValid) {
          throw new Error(
            'Invalid buy order. It may have recently been removed. Please refresh the page and try again!'
          )
        }
      }

      if (shouldValidateSell) {
        const sellValid = await this.validateOrder(sell)
        this.logger.info(`Sell order is valid: ${sellValid}`)

        if (!sellValid) {
          throw new Error(
            'Invalid sell order. It may have recently been removed. Please refresh the page and try again!'
          )
        }
      }
      await requireOrdersCanMatch(this.contractsWrapper.wyvernExchangeBulkCancellations, {
        buy,
        sell,
        accountAddress,
      })
      await requireOrderCalldataCanMatch(this.contractsWrapper.wyvernExchangeBulkCancellations, { buy, sell })

      return true
    } catch (error) {
      if (retries <= 0) {
        throw new Error(
          `Error matching this listing: ${
            error instanceof Error ? error.message : ''
          }. Please contact the maker or try again later!`
        )
      }
      await delay(500)
      return await this.validateMatch({ buy, sell, accountAddress, shouldValidateBuy, shouldValidateSell }, retries - 1)
    }
  }

  public async validateOrder(order: Order): Promise<boolean> {
    const isValid = await this.contractsWrapper.wyvernExchangeBulkCancellations.validateOrder_(
      [
        order.exchange,
        order.maker,
        order.taker,
        order.feeRecipient,
        order.target,
        order.staticTarget,
        order.paymentToken,
      ],
      [
        order.makerRelayerFee.toFixed(0),
        order.takerRelayerFee.toFixed(0),
        order.makerProtocolFee.toFixed(0),
        order.takerProtocolFee.toFixed(0),
        order.basePrice.toFixed(0),
        order.extra.toFixed(0),
        order.listingTime.toFixed(0),
        order.expirationTime.toFixed(0),
        order.salt.toFixed(0),
      ],
      order.feeMethod,
      order.side,
      order.saleKind,
      order.howToCall,
      order.calldata,
      order.replacementPattern,
      order.staticExtradata,
      order.v || 0,
      order.r || NULL_BLOCK_HASH,
      order.s || NULL_BLOCK_HASH
    )

    return isValid
  }
  public async fulfillOrders({
    orders,
    accountAddress,
    recipientAddress,
    referrerAddress,
  }: {
    orders: Order[]
    accountAddress: string
    recipientAddress?: string
    referrerAddress?: string
  }) {
    const orderPairs = orders.map((order) => {
      const matchingOrder = this.makeMatchingOrder({
        order,
        accountAddress: this.contractsWrapper.multicall.address, // use multicall address as accountAddress
        recipientAddress: recipientAddress || accountAddress,
      })
      const { buy, sell } = assignOrdersToSides(order, matchingOrder)
      const metadata = this.getMetadata(order, referrerAddress)
      return { buy, sell, metadata }
    })

    const calls: { target: string; callData: string }[] = orderPairs.map(({ buy, sell, metadata }) => {
      const args = this.encodeAtomicMatchParameters({ buy, sell, metadata })
      const callData = this.contractsWrapper.wyvernExchangeBulkCancellations.interface.encodeFunctionData(
        'atomicMatch_',
        [args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10]]
      )
      return { target: this.contractsWrapper.wyvernExchangeBulkCancellations.address, callData }
    })
    const values = await Promise.all(
      orderPairs.map(async ({ buy, sell }) => {
        if (buy.paymentToken == NULL_ADDRESS) {
          return await this.getRequiredAmountForTakingSellOrder(sell)
        }
        return new BigNumber(0)
      })
    )
    const value = values.reduce((res, value) => res.plus(value), new BigNumber(0))

    const txnData = { from: accountAddress, value: value.toString() }
    const wallet = this.walletProvider.getSigner(accountAddress)
    const transactionHash = await this.contractsWrapper.multicall.connect(wallet).aggregate(calls, txnData)

    return transactionHash
  }

  private encodeAtomicMatchParameters({
    buy,
    sell,
    metadata = NULL_BLOCK_HASH,
  }: {
    buy: Order
    sell: Order
    metadata?: string
  }) {
    const args: AtomicMatchParameters = [
      [
        buy.exchange,
        buy.maker,
        buy.taker,
        buy.feeRecipient,
        buy.target,
        buy.staticTarget,
        buy.paymentToken,
        sell.exchange,
        sell.maker,
        sell.taker,
        sell.feeRecipient,
        sell.target,
        sell.staticTarget,
        sell.paymentToken,
      ],
      [
        buy.makerRelayerFee.toFixed(0),
        buy.takerRelayerFee.toFixed(0),
        buy.makerProtocolFee.toFixed(0),
        buy.takerProtocolFee.toFixed(0),
        buy.basePrice.toFixed(0),
        buy.extra.toFixed(0),
        buy.listingTime.toFixed(0),
        buy.expirationTime.toFixed(0),
        buy.salt.toFixed(0),
        sell.makerRelayerFee.toFixed(0),
        sell.takerRelayerFee.toFixed(0),
        sell.makerProtocolFee.toFixed(0),
        sell.takerProtocolFee.toFixed(0),
        sell.basePrice.toFixed(0),
        sell.extra.toFixed(0),
        sell.listingTime.toFixed(0),
        sell.expirationTime.toFixed(0),
        sell.salt.toFixed(0),
      ],
      [buy.feeMethod, buy.side, buy.saleKind, buy.howToCall, sell.feeMethod, sell.side, sell.saleKind, sell.howToCall],
      buy.calldata,
      sell.calldata,
      buy.replacementPattern,
      sell.replacementPattern,
      buy.staticExtradata,
      sell.staticExtradata,
      [buy.v || 0, sell.v || 0],
      [
        buy.r || NULL_BLOCK_HASH,
        buy.s || NULL_BLOCK_HASH,
        sell.r || NULL_BLOCK_HASH,
        sell.s || NULL_BLOCK_HASH,
        metadata,
      ],
    ]
    return args
  }

  private async atomicMatch({
    buy,
    sell,
    accountAddress,
    metadata = NULL_BLOCK_HASH,
  }: {
    buy: Order
    sell: Order
    accountAddress: string
    metadata?: string
  }) {
    let value = new BigNumber(0)
    let shouldValidateBuy = true
    let shouldValidateSell = true
    if (sell.maker.toLowerCase() == accountAddress.toLowerCase()) {
      // USER IS THE SELLER, only validate the buy order
      await this.sellOrderValidationAndApprovals({
        order: sell,
        accountAddress,
      })
      shouldValidateSell = false
    } else if (buy.maker.toLowerCase() == accountAddress.toLowerCase()) {
      // USER IS THE BUYER, only validate the sell order
      await this.buyOrderValidationAndApprovals({ order: buy, counterOrder: sell, accountAddress })
      // If using ETH to pay, set the value of the transaction to the current price
      if (buy.paymentToken == NULL_ADDRESS) {
        value = await this.getRequiredAmountForTakingSellOrder(sell)
      }
      shouldValidateBuy = false
    } else {
      // User is neither - matching service
    }

    await this.validateMatch({
      buy,
      sell,
      accountAddress,
      shouldValidateBuy,
      shouldValidateSell,
    })
    let txHash
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txnData: any = { from: accountAddress, value: value.toString() }
    const args = this.encodeAtomicMatchParameters({ buy, sell, metadata })

    // Estimate gas first
    try {
      // Typescript splat doesn't typecheck
      const gasEstimate = await this.contractsWrapper.wyvernExchangeBulkCancellations.estimateGas.atomicMatch_(
        args[0],
        args[1],
        args[2],
        args[3],
        args[4],
        args[5],
        args[6],
        args[7],
        args[8],
        args[9],
        args[10],
        txnData
      )

      txnData.gasLimit = this.correctGasAmount(gasEstimate.toNumber())
    } catch (error) {
      console.error(`Failed atomic match with args: `, args, error)
      throw new Error(
        `Oops, the Ethereum network rejected this transaction :( The OpenSea devs have been alerted, but this problem is typically due an item being locked or untransferrable. The exact error was "${
          error instanceof Error ? error.message.substr(0, MAX_ERROR_LENGTH) : 'unknown'
        }..."`
      )
    }
    // Then do the transaction
    try {
      this.logger.info(`Fulfilling order with gas set to ${txnData.gasLimit}`)
      const wallet = this.walletProvider.getSigner(accountAddress)
      const { hash } = await this.contractsWrapper.wyvernExchangeBulkCancellations
        .connect(wallet)
        .atomicMatch_(
          args[0],
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
          args[6],
          args[7],
          args[8],
          args[9],
          args[10],
          txnData
        )
      txHash = hash
    } catch (error) {
      console.error(error)

      throw new Error(
        `Failed to authorize transaction: "${
          error instanceof Error && error.message ? error.message : 'user denied'
        }..."`
      )
    }

    return txHash
  }
  /**
   * Compute the gas amount for sending a txn
   * Will be slightly above the result of estimateGas to make it more reliable
   * @param estimation The result of estimateGas for a transaction
   */
  public correctGasAmount(estimation: number): number {
    return Math.ceil(estimation * this.gasIncreaseFactor)
  }

  private async getRequiredAmountForTakingSellOrder(sell: Order) {
    let { basePrice, listingTime, expirationTime, extra } = sell
    const { side, takerRelayerFee, saleKind } = sell
    let exactPrice = basePrice

    if (saleKind == SaleKind.FixedPrice) {
    } else if (saleKind == SaleKind.DutchAuction) {
      const secondsToBacktrack = 30
      const now = new BigNumber(Math.round(Date.now() / 1000)).minus(secondsToBacktrack)
      // price decline with time goes by
      const diff = extra.times(now.minus(listingTime)).dividedBy(expirationTime.minus(listingTime))
      exactPrice =
        side == OrderSide.Sell
          ? /* Sell-side - start price: basePrice. End price: basePrice - extra. */
            basePrice.minus(diff)
          : /* Buy-side - start price: basePrice. End price: basePrice + extra. */
            basePrice.plus(diff)
    }

    sell.takerRelayerFee = new BigNumber(sell.takerRelayerFee)
    const feePercentage = sell.takerRelayerFee.div(INVERSE_BASIS_POINT)
    const fee = feePercentage.times(exactPrice)
    return fee.plus(exactPrice).integerValue(BigNumber.ROUND_CEIL)
  }

  public makeMatchingOrder({
    order,
    accountAddress,
    recipientAddress,
  }: {
    order: UnsignedOrder
    accountAddress: string
    recipientAddress: string
  }): UnsignedOrder {
    accountAddress = validateAndFormatWalletAddress(accountAddress)
    recipientAddress = validateAndFormatWalletAddress(recipientAddress)

    // Compat for matching buy orders that have fee recipient still on them
    const feeRecipient = order.feeRecipient == NULL_ADDRESS ? PROTOCOL_FEE_RECIPIENT : NULL_ADDRESS

    // encode transfer asset like nft
    const computeOrderParams = () => {
      const shouldValidate = order.target === this.contractsWrapper.merkleValidator.address

      if ('asset' in order.metadata) {
        const schema = this.getSchema(order.metadata.schema)
        return order.side == OrderSide.Buy
          ? encodeSell(
              shouldValidate ? this.contractsWrapper.merkleValidator.interface : schema.contractInterface,
              order.metadata.asset,
              recipientAddress,
              shouldValidate ? order.target : undefined
            )
          : encodeBuy(
              shouldValidate ? this.contractsWrapper.merkleValidator.interface : schema.contractInterface,
              order.metadata.asset,
              recipientAddress,
              shouldValidate ? order.target : undefined
            )
      } else if ('bundle' in order.metadata) {
        // We're matching a bundle order
        const bundle = order.metadata.bundle
        return {
          target: this.contractsWrapper.atomicizer.address,
          calldata: '0x00',
          replacementPattern: '0x00',
        }
      } else {
        throw new Error('Invalid order metadata')
      }
    }
    const { target, calldata, replacementPattern } = computeOrderParams()

    const times = this.getTimeParameters({
      expirationTimestamp: 0,
      isMatchingOrder: true,
    })

    const matchingOrder: UnhashedOrder = {
      exchange: order.exchange,
      maker: accountAddress,
      taker: order.maker,
      quantity: order.quantity,
      makerRelayerFee: order.makerRelayerFee,
      takerRelayerFee: order.takerRelayerFee,
      makerProtocolFee: order.makerProtocolFee,
      takerProtocolFee: order.takerProtocolFee,
      makerReferrerFee: order.makerReferrerFee,
      feeMethod: order.feeMethod,
      feeRecipient,
      side: (order.side + 1) % 2,
      saleKind: SaleKind.FixedPrice,
      target,
      howToCall: order.howToCall,
      calldata,
      replacementPattern,
      staticTarget: NULL_ADDRESS,
      staticExtradata: '0x',
      paymentToken: order.paymentToken,
      basePrice: order.basePrice,
      extra: new BigNumber(0),
      listingTime: times.listingTime,
      expirationTime: times.expirationTime,
      salt: generatePseudoRandomSalt(),
      metadata: order.metadata,
    }

    return matchingOrder
  }
}
