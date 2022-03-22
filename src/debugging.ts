import { WyvernExchangeWithBulkCancellations } from './typechain'
import { Order, OrderSide } from './types'
import { NULL_ADDRESS } from './constants'

function canSettleOrder(listingTime: number, expirationTime: number): boolean {
  const now = Math.round(Date.now() / 1000)
  return listingTime < now && (expirationTime === 0 || now < expirationTime)
}

/**
 * Debug the `ordersCanMatch` part of Wyvern
 * @param buy Buy order for debugging
 * @param sell Sell order for debugging
 */
export async function requireOrdersCanMatch(
  client: WyvernExchangeWithBulkCancellations,
  { buy, sell, accountAddress }: { buy: Order; sell: Order; accountAddress: string }
) {
  const result = await client.ordersCanMatch_(
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
    {
      from: accountAddress,
    }
  )

  if (result) {
    return
  }
  if (!(+buy.side == +OrderSide.Buy && +sell.side == +OrderSide.Sell)) {
    throw new Error('Must be opposite-side')
  }

  if (!(buy.feeMethod == sell.feeMethod)) {
    throw new Error('Must use same fee method')
  }

  if (!(buy.paymentToken == sell.paymentToken)) {
    throw new Error('Must use same payment token')
  }

  if (!(sell.taker == NULL_ADDRESS || sell.taker == buy.maker)) {
    throw new Error('Sell taker must be null or matching buy maker')
  }

  if (!(buy.taker == NULL_ADDRESS || buy.taker == sell.maker)) {
    throw new Error('Buy taker must be null or matching sell maker')
  }

  if (
    !(
      (sell.feeRecipient == NULL_ADDRESS && buy.feeRecipient != NULL_ADDRESS) ||
      (sell.feeRecipient != NULL_ADDRESS && buy.feeRecipient == NULL_ADDRESS)
    )
  ) {
    throw new Error('One order must be maker and the other must be taker')
  }

  if (!(buy.target == sell.target)) {
    throw new Error('Must match target')
  }

  if (!(buy.howToCall == sell.howToCall)) {
    throw new Error('Must match howToCall')
  }

  if (!canSettleOrder(+buy.listingTime, +buy.expirationTime)) {
    throw new Error(`Buy-side order is set in the future or expired`)
  }

  if (!canSettleOrder(+sell.listingTime, +sell.expirationTime)) {
    throw new Error(`Sell-side order is set in the future or expired`)
  }

  // Handle default, which is likely now() being diff than local time
  throw new Error(
    'Error creating your order. Check that your system clock is set to the current date and time before you try again.'
  )
}

/**
 * Debug the `orderCalldataCanMatch` part of Wyvern
 * @param buy Buy order for debugging
 * @param sell Sell Order for debugging
 */
export async function requireOrderCalldataCanMatch(
  client: WyvernExchangeWithBulkCancellations,
  { buy, sell }: { buy: Order; sell: Order }
) {
    console.log('calldata:', buy.calldata, sell.calldata)
    console.log('replacementPattern:', buy.replacementPattern, sell.replacementPattern)
  const result = await client.orderCalldataCanMatch(
    buy.calldata,
    buy.replacementPattern,
    sell.calldata,
    sell.replacementPattern
  )
  if (result) {
    return
  }
  throw new Error('Unable to match offer data with auction data.')
}
