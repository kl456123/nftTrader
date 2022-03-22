import { ethers } from 'hardhat'

async function main() {
  const signers = await ethers.getSigners()
  const deployer = signers[0].address

  const protocolFeeAddress = deployer
  const registryAddress = '0xEb3542517464701cD4d42B5bDC49c1cB21d83331'
  const tokenTransferProxyAddress = '0xDb043586CC1A0a784329733f5caa39F2167d8c0F'
  const tokenAddress = '0x8b5947506A87276dD0c17f9c6cD3FAc5DD06Fba7'
  const nftAddress = '0x8b5947506A87276dD0c17f9c6cD3FAc5DD06Fba7'

  const WyvernExchangeWithBulkCancellations = await ethers.getContractFactory('WyvernExchangeWithBulkCancellations')
  const wyvernExchangeWithBulkCancellations = await WyvernExchangeWithBulkCancellations.deploy(
    registryAddress,
    tokenTransferProxyAddress,
    tokenAddress,
    protocolFeeAddress
  )

  // used for verify contracts
  console.log(
    'abi encoded constructor arguments:',
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'address', 'address'],
      [registryAddress, tokenTransferProxyAddress, tokenAddress, protocolFeeAddress]
    )
  )

  await wyvernExchangeWithBulkCancellations.deployed()
  console.log('WyvernExchangeWithBulkCancellations deployed to:', wyvernExchangeWithBulkCancellations.address)
  const wyvernProxyRegistry = await ethers.getContractAt('WyvernProxyRegistry', registryAddress)
  await wyvernProxyRegistry.grantInitialAuthentication(wyvernExchangeWithBulkCancellations.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
