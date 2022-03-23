import { ethers } from 'hardhat'

async function main() {
  const signer = await ethers.getSigners()
  const deployer = signer[0]
  // converter
  const Converter = await ethers.getContractFactory('Converter')
  const converter = await Converter.deploy()
  await converter.deployed()
  console.log('converter deployed to:', converter.address)

  // market registry
  // add opensea v2(Rinkeby)
  const exchangev2 = '0x2d1FBe9075e01bB16dc4C5c209be8CEBb3db1eB1'
  const proxies: string[] = [exchangev2]
  const libs: boolean[] = [false]

  const MarketRegistry = await ethers.getContractFactory('MarketRegistry')
  const marketRegistry = await MarketRegistry.deploy(proxies, libs)
  await marketRegistry.deployed()
  console.log('marketRegistry deployed to:', marketRegistry.address)

  // use deployer as guardian
  const guardian = deployer.address
  const GemSwap = await ethers.getContractFactory('GemSwap')
  const gemSwap = await GemSwap.deploy(marketRegistry.address, converter.address, guardian)
  await gemSwap.deployed()

  console.log('GemSwap deployed to:', gemSwap.address)

    // approve first
    const paymentTokens: string[] = ['0xc778417E063141139Fce010982780140Aa0cD5Ab']// weth in rinkeby
    await Promise.all(paymentTokens.map(async (token)=>{
        return gemSwap.setOneTimeApproval(token,
        exchangev2,
        ethers.constants.MaxUint256)
    }))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
