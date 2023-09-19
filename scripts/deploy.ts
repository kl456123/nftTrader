// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, run } from 'hardhat'
import { getContractAddress } from '@ethersproject/address'

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
  const signers = await ethers.getSigners()
  const deployer = signers[0].address

  // We get the contract to deploy

  // mock nft
  const MockNFT = await ethers.getContractFactory('MockNFT')
  const mockNFT = await MockNFT.deploy()
  await mockNFT.deployed()
  console.log('MockNFT deployed to:', mockNFT.address)

  // mock token
  const MockToken = await ethers.getContractFactory('MockToken')
  const mockToken = await MockToken.deploy()
  await mockToken.deployed()
  console.log('MockToken deployed to:', mockToken.address)

  const WyvernProxyRegistry = await ethers.getContractFactory(
    'WyvernProxyRegistry'
  )
  const wyvernProxyRegistry = await WyvernProxyRegistry.deploy()
  await wyvernProxyRegistry.deployed()
  console.log('wyvernProxyRegistry deployed to:', wyvernProxyRegistry.address)

  const TokenTransferProxy = await ethers.getContractFactory(
    'WyvernTokenTransferProxy'
  )
  const tokenTransferProxy = await TokenTransferProxy.deploy(
    wyvernProxyRegistry.address
  )
  await tokenTransferProxy.deployed()
  console.log('tokenTransferProxy deployed to:', tokenTransferProxy.address)

  // ////////////////////////// WyvernToken ///////////////////////
  // // const totalUtxoAmount = 1000000000
  // // const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle tree root'))
  // // const WyvernToken = await ethers.getContractFactory('WyvernToken')
  // // const wyvernToken = await WyvernToken.deploy(merkleRoot, totalUtxoAmount)

  // // await wyvernToken.deployed()

  // // console.log('wyvernToken deployed to:', wyvernToken.address)

  // ///////////////////// WyvernDAO //////////////////////////////////
  // // const WyvernDAO = await ethers.getContractFactory('WyvernDAO')
  // // const wyvernDAO = await WyvernDAO.deploy(wyvernToken.address)

  // // await wyvernDAO.deployed()
  // // console.log('wyvernDAO deployed to:', wyvernDAO.address)

  ///////////////////////////////////////////////////////////////
  // validator and atomicizer
  const Atomicizer = await ethers.getContractFactory('WyvernAtomicizer')
  const atomicizer = await Atomicizer.deploy()
  await atomicizer.deployed()
  console.log('atomicizer deployed to:', atomicizer.address)

  const Validator = await ethers.getContractFactory('MerkleValidator')
  const validator = await Validator.deploy()
  await validator.deployed()
  console.log('validator deployed to:', validator.address)

  // //////////////////// exchange //////////////////////////

  // // the following address is truely address in mainnet, we use random address here for simplification
  // // const protocolFeeAddress = "0xa839d4b5a36265795eba6894651a8af3d0ae2e68"
  // const registryAddress = wyvernProxyRegistry.address
  // const tokenTransferProxyAddress = tokenTransferProxy.address
  // const tokenAddress = mockToken.address

  // const WyvernExchange = await ethers.getContractFactory('WyvernExchange')
  // const wyvernExchange = await WyvernExchange.deploy(
  // registryAddress,
  // tokenTransferProxyAddress,
  // tokenAddress,
  // protocolFeeAddress
  // )

  // await wyvernExchange.deployed()
  // console.log('wyvernExchange deployed to:', wyvernExchange.address)
  // can only called once
  // await wyvernProxyRegistry.grantInitialAuthentication(wyvernExchange.address)

  const nonce = await signers[0].getTransactionCount()
  console.log('deployer dddress:', deployer)
  const futureAddress = getContractAddress({ from: deployer, nonce })
  console.log('future contract deployed to:', futureAddress)
  const _EIP_712_DOMAIN_TYPEHASH =
    '0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f'
  const _NAME_HASH =
    '0x9a2ed463836165738cfa54208ff6e7847fd08cbaac309aac057086cb0a144d13'
  const _VERSION_HASH =
    '0xe2fd538c762ee69cab09ccd70e2438075b7004dd87577dc3937e9fcc8174bb64'
  const _ORDER_TYPEHASH =
    '0xdba08a88a748f356e8faf8578488343eab21b1741728779c9dcfdc782bc800f8'
  const { chainId: _CHAIN_ID } = await ethers.provider.getNetwork()

  const domain_separator = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        _EIP_712_DOMAIN_TYPEHASH,
        _NAME_HASH,
        _VERSION_HASH,
        _CHAIN_ID,
        futureAddress,
      ]
    )
  )
  console.log('domain_separator:', domain_separator)
  console.log(
    `modify domain_separator to ${domain_separator} and chainId to ${_CHAIN_ID} before deploy exchangev2!`
  )

  // verify
  await run('verify:verify', {
    address: mockNFT.address,
    contract: 'contracts/MockNFT.sol:MockNFT',
  })
  await run('verify:verify', {
    address: mockToken.address,
    contract: 'contracts/MockToken.sol:MockToken',
  })

  await run('verify:verify', {
    address: wyvernProxyRegistry.address,
    contract: 'contracts/WyvernProxyRegistry.sol:WyvernProxyRegistry',
  })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
