import { Trader } from './trader'
import { Asset, SchemaName, Network } from './types'
import { ethers } from 'ethers'
import * as dotenv from 'dotenv'
import { MockNFT__factory } from './typechain'
import { WalletProvider } from './wallet_provider'

dotenv.config()

async function initEnv(nftAddress: string, tokenId: number, signer: ethers.Signer, otherAddress: string) {
  const mockNFT = MockNFT__factory.connect(nftAddress, signer)
  await mockNFT.mint(otherAddress)
  const owner = await mockNFT.ownerOf(tokenId)
  if (owner.toLowerCase() !== otherAddress.toLowerCase()) {
    throw new Error(`nft of ${tokenId}'s owner is not ${otherAddress} but ${owner}`)
  }
}

async function fulfillOrders(trader: Trader, deployer: ethers.Signer, seller: string, buyer: string) {
  const NFT_CONTRACT_ADDRESS = '0x43BB99CC6EdfA45181295Cce4528F08f54C58aa4'
  const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24) // one day
  const NFT_TOKEN_IDS = [2, 3]
  const sellOrders = []
  for (const nftId of NFT_TOKEN_IDS) {
    await initEnv(NFT_CONTRACT_ADDRESS, nftId, deployer, seller)
    const asset: Asset = {
      tokenId: nftId.toString(),
      tokenAddress: NFT_CONTRACT_ADDRESS,
      schemaName: SchemaName.ERC721,
    }
    const sellOrder = await trader.createSellOrder({
      asset,
      startAmount: 0.01,
      expirationTime,
      accountAddress: seller,
    })
    sellOrders.push(sellOrder)
  }
  const txHash = await trader.fulfillOrders({ orders: sellOrders, accountAddress: buyer })
}

async function fulfillOrder(trader: Trader, deployer: ethers.Signer, seller: string, buyer: string) {
  const NFT_CONTRACT_ADDRESS = '0x43BB99CC6EdfA45181295Cce4528F08f54C58aa4'
  const NFT_TOKEN_ID = 3
  const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24) // one day
  await initEnv(NFT_CONTRACT_ADDRESS, NFT_TOKEN_ID, deployer, seller)

  const asset: Asset = {
    tokenId: NFT_TOKEN_ID.toString(),
    tokenAddress: NFT_CONTRACT_ADDRESS,
    schemaName: SchemaName.ERC721,
  }
  const paymentTokenAddress = '0xc778417E063141139Fce010982780140Aa0cD5Ab' // weth
  const sellOrder = await trader.createSellOrder({
    asset,
    startAmount: 0.01,
    paymentTokenAddress,
    expirationTime,
    accountAddress: seller,
  })
  const txHash = await trader.fulfillOrder({ order: sellOrder, accountAddress: buyer })
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RINKEBY_URL)
  const walletProvider = new WalletProvider(provider)
  walletProvider.unlockAll([
    process.env.ALICE_PASSWD,
    process.env.BOB_PASSWD,
    process.env.RINKEBY_PRIVATE_KEY,
  ] as string[])
  const deployer = new ethers.Wallet(process.env.RINKEBY_PRIVATE_KEY as string, provider)
  const seller = process.env.ALICE_ADDR as string
  const buyer = process.env.BOB_ADDR as string

  const trader = new Trader(walletProvider, { networkName: Network.Rinkeby })

  // test
  // await fulfillOrders(trader, deployer, seller, buyer)
  await fulfillOrder(trader, deployer, seller, buyer)
}

main().catch(console.error)
