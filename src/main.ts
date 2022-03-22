import { Trader } from './trader'
import { Asset, SchemaName, Network } from './types'
import { ethers } from 'ethers'
import * as dotenv from 'dotenv'
import { MockNFT__factory } from './typechain'
import { WalletProvider } from './wallet_provider'

dotenv.config()

async function initEnv(nftAddress: string, tokenId: number, signer: ethers.Signer, otherAddress: string) {
  const mockNFT = MockNFT__factory.connect(nftAddress, signer)
  // const numNFT = 2;
  // for(let i=0;i<numNFT;++i){
  // sequence process
  await mockNFT.mint(otherAddress)
  // }
  const numNFT = await mockNFT.balanceOf(otherAddress)
  console.log(`account ${otherAddress} balance: `, numNFT.toString())
  console.log(`${tokenId} owner address: ${await mockNFT.ownerOf(tokenId)}`)
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RINKEBY_URL)
  const walletProvider = new WalletProvider(provider)
  walletProvider.unlockAll([
    process.env.ALICE_PASSWD,
    process.env.BOB_PASSWD,
    process.env.RINKEBY_PRIVATE_KEY,
  ] as string[])

  const trader = new Trader(walletProvider, { networkName: Network.Rinkeby })
  const NFT_CONTRACT_ADDRESS = '0x43BB99CC6EdfA45181295Cce4528F08f54C58aa4'
  const NFT_TOKEN_ID = 1
  const deployer = new ethers.Wallet(process.env.RINKEBY_PRIVATE_KEY as string, provider)
  const seller = process.env.ALICE_ADDR as string
  const buyer = process.env.BOB_ADDR as string
  const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24) // one day
  // await initEnv(NFT_CONTRACT_ADDRESS, NFT_TOKEN_ID, deployer, seller)

  const asset: Asset = {
    tokenId: NFT_TOKEN_ID.toString(),
    tokenAddress: NFT_CONTRACT_ADDRESS,
    schemaName: SchemaName.ERC721,
  }
  const sellOrder = await trader.createSellOrder({
    asset,
    startAmount: 0.01,
    expirationTime,
    accountAddress: seller,
  })
  const txHash = await trader.fulfillOrder({ order: sellOrder, accountAddress: buyer })
}

main().catch(console.error)
