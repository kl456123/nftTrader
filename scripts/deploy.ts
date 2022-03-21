// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from 'hardhat'

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy

  // mock nft
  const MockNFT = await ethers.getContractFactory('MockNFT')
  const mockNFT = await MockNFT.deploy()
  await mockNFT.deployed()
  console.log('MockNFT deployed to:', mockNFT.address)

  // mock token
  const MockToken = await ethers.getContractFactory('MockToken')
  const mockToken = await MockToken.deploy()
  await mockNFT.deployed()
  console.log('MockToken deployed to:', mockToken.address)

  const WyvernProxyRegistry = await ethers.getContractFactory('contracts/WyvernProxyRegistry.sol:WyvernProxyRegistry')
  const wyvernProxyRegistry = await WyvernProxyRegistry.deploy()
  await wyvernProxyRegistry.deployed()
  console.log('wyvernProxyRegistry deployed to:', wyvernProxyRegistry.address)

  const TokenTransferProxy = await ethers.getContractFactory('contracts/WyvernTokenTransferProxy.sol:WyvernTokenTransferProxy')
  const tokenTransferProxy = await TokenTransferProxy.deploy(wyvernProxyRegistry.address)
  await tokenTransferProxy.deployed()
  console.log('tokenTransferProxy deployed to:', tokenTransferProxy.address)

  ////////////////////////// WyvernToken ///////////////////////
  // const totalUtxoAmount = 1000000000
  // const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle tree root'))
  // const WyvernToken = await ethers.getContractFactory('WyvernToken')
  // const wyvernToken = await WyvernToken.deploy(merkleRoot, totalUtxoAmount)

  // await wyvernToken.deployed()

  // console.log('wyvernToken deployed to:', wyvernToken.address)

  ///////////////////// WyvernDAO //////////////////////////////////
  // const WyvernDAO = await ethers.getContractFactory('WyvernDAO')
  // const wyvernDAO = await WyvernDAO.deploy(wyvernToken.address)

  // await wyvernDAO.deployed()
  // console.log('wyvernDAO deployed to:', wyvernDAO.address)

  //////////////////// exchange //////////////////////////
  const signers = await ethers.getSigners()
  // the following address is truely address in mainnet, we use random address here for simplification
  // const protocolFeeAddress = "0xa839d4b5a36265795eba6894651a8af3d0ae2e68"
  const protocolFeeAddress = signers[0].address
  const registryAddress = wyvernProxyRegistry.address
  const tokenTransferProxyAddress = tokenTransferProxy.address
  const tokenAddress = mockToken.address

  const WyvernExchange = await ethers.getContractFactory('WyvernExchange')
  const wyvernExchange = await WyvernExchange.deploy(
    registryAddress,
    tokenTransferProxyAddress,
    tokenAddress,
    protocolFeeAddress
  )

  await wyvernExchange.deployed()
  console.log('wyvernExchange deployed to:', wyvernExchange.address)
  await wyvernProxyRegistry.grantInitialAuthentication(wyvernExchange.address)

  const WyvernExchangeWithBulkCancellations = await ethers.getContractFactory('WyvernExchangeWithBulkCancellations')
  const wyvernExchangeWithBulkCancellations = await WyvernExchangeWithBulkCancellations.deploy(
    registryAddress,
    tokenTransferProxyAddress,
    tokenAddress,
    protocolFeeAddress
  )

  await wyvernExchangeWithBulkCancellations.deployed()

  console.log('WyvernExchangeWithBulkCancellations deployed to:', wyvernExchangeWithBulkCancellations.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
