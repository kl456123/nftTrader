import { ethers, waffle } from 'hardhat'
import { MockNFT } from '../src/typechain'
import { Signer } from 'ethers'
import { expect } from 'chai'
import chai from 'chai'

chai.use(waffle.solidity)

describe('MockNFT Test', () => {
  const mockNFTAddress = '0x4bf010f1b9beda5450a8dd702ed602a104ff65ee'
  let mockNFT: MockNFT
  let signers: Signer[] = []
  let deployer: string, other: string
  before(async () => {
    signers = await ethers.getSigners()
    deployer = await signers[0].getAddress()
    other = await signers[1].getAddress()
    mockNFT = await ethers.getContractAt('MockNFT', mockNFTAddress)
  })

  it('nft mintable test', async () => {
    await mockNFT.mint(other)
    expect(await mockNFT.balanceOf(other)).gt(0)
  })

  it('nft transfer test', async () => {
    expect(await mockNFT.ownerOf(0)).eq(other)
    await mockNFT.transferFrom(other, deployer, 0)
    expect(await mockNFT.ownerOf(0)).eq(deployer)
  })
})
