import { Trader } from './trader'
import { Asset, SchemaName } from './types'
import { ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  // const provider = ethers.getDefaultProvider('mainnet')
  const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_URL)
  const trader = new Trader(provider)
  const NFT_CONTRACT_ADDRESS = '0x4bf010f1b9beda5450a8dd702ed602a104ff65ee'
  const NFT_TOKEN_ID = 5465
  const seller = process.env.ALICE_ADDR as string
  const buyer = process.env.BOB_ADDR as string
  const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24) // one day
  const asset: Asset = {
    tokenId: NFT_TOKEN_ID.toString(),
    tokenAddress: NFT_CONTRACT_ADDRESS,
    schemaName: SchemaName.ERC721,
  }
  const sellOrder = await trader.createSellOrder({
    asset,
    startAmount: 0.1,
    expirationTime,
    accountAddress: seller,
  })
  const txHash = await trader.fulfillOrder({ order: sellOrder, accountAddress: buyer })
}

main().catch(console.error)
