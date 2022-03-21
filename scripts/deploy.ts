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
  // const WyvernExchangeWithBulkCancellations = await ethers.getContractFactory("WyvernExchangeWithBulkCancellations");
  // const registryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1"
  // const tokenTransferProxyAddress = "0xe5c783ee536cf5e63e792988335c4255169be4e1"
  // const tokenAddress = "0x056017c55ae7ae32d12aef7c679df83a85ca75ff"
  // const protocolFeeAddress = "0xa839d4b5a36265795eba6894651a8af3d0ae2e68"
  // const wyvernExchangeWithBulkCancellations = await WyvernExchangeWithBulkCancellations.deploy(registryAddress, tokenTransferProxyAddress, tokenAddress, protocolFeeAddress);

  // await wyvernExchangeWithBulkCancellations.deployed();

  // console.log("WyvernExchangeWithBulkCancellations deployed to:", wyvernExchangeWithBulkCancellations.address);

  // mock nft
  const MockNFT = await ethers.getContractFactory('MockNFT')
  const mockNFT = await MockNFT.deploy()
  await mockNFT.deployed()

  console.log('MockNFT deployed to:', mockNFT.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
