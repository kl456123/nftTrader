import { ethers } from 'hardhat'

async function main() {
  const signer = await ethers.getSigners()
  const deployer = signer[0]
  // // converter
  const Converter = await ethers.getContractFactory('Converter')
  const converter = await Converter.deploy()
  await converter.deployed()
  console.log('converter deployed to:', converter.address)

  // market registry
  // add opensea v2(Rinkeby)
  const exchangev2 = '0x2d1FBe9075e01bB16dc4C5c209be8CEBb3db1eB1'
  const tokenTransferProxy = '0xdb043586cc1a0a784329733f5caa39f2167d8c0f'
  const proxies: string[] = [exchangev2]
  const libs: boolean[] = [false]

  const MarketRegistry = await ethers.getContractFactory('MarketRegistry')
  const marketRegistry = await MarketRegistry.deploy(proxies, libs)
  await marketRegistry.deployed()
  console.log('marketRegistry deployed to:', marketRegistry.address)

  // // use deployer as guardian
  const guardian = deployer.address
  const GemSwap = await ethers.getContractFactory('GemSwap')
  const gemSwap = await GemSwap.deploy(
    marketRegistry.address,
    converter.address,
    guardian
  )
  await gemSwap.deployed()

  console.log('GemSwap deployed to:', gemSwap.address)
  // used for verify contracts
  const marketRegistryAddress = marketRegistry.address
  const converterAddress = converter.address
  console.log(
    'abi encoded constructor arguments:',
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'address'],
      [marketRegistryAddress, converterAddress, guardian]
    )
  )

  // approve first
  // const gemSwap = await ethers.getContractAt('GemSwap', '0xCC10A64d6ADfa9d55291bD9ddd2510e11Ce3274A');
  const paymentTokens: string[] = [
    '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    '0x8b5947506A87276dD0c17f9c6cD3FAc5DD06Fba7',
  ] // weth and mockToken in rinkeby
  // make sure use different nonce among all txns, otherwise the previous txs will be replaced by the last one
  const nonce = await deployer.getTransactionCount()
  await Promise.all(
    paymentTokens.map((token, ind) =>
      gemSwap.setOneTimeApproval(
        token,
        tokenTransferProxy,
        ethers.constants.MaxUint256,
        { nonce: nonce + ind }
      )
    )
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
