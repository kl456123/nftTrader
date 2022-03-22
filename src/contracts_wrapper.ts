import {
  WyvernExchangeWithBulkCancellations__factory,
  WyvernExchangeWithBulkCancellations,
  MerkleValidator,
  MerkleValidator__factory,
  WyvernProxyRegistry,
  WyvernProxyRegistry__factory,
  WyvernAtomicizer,
  WyvernAtomicizer__factory,
  WyvernTokenTransferProxy,
  WyvernTokenTransferProxy__factory,
  Multicall,
  Multicall__factory,
} from './typechain'
import { ethers, Contract } from 'ethers'
import { addressesByNetwork } from './utils'
import { Network } from './types'

export class ContractsWrapper {
  public wyvernExchangeBulkCancellations: WyvernExchangeWithBulkCancellations
  public merkleValidator: MerkleValidator
  public wyvernProxyRegistry: WyvernProxyRegistry
  public atomicizer: WyvernAtomicizer
  public tokenTransferProxy: WyvernTokenTransferProxy
  public multicall: Multicall
  constructor(protected network: Network, protected provider: ethers.providers.BaseProvider) {
    const addressbook = addressesByNetwork[this.network]!
    this.wyvernExchangeBulkCancellations = WyvernExchangeWithBulkCancellations__factory.connect(
      addressbook.exchangev2,
      provider
    )
    this.tokenTransferProxy = WyvernTokenTransferProxy__factory.connect(addressbook.tokenTransferProxy, provider)
    this.merkleValidator = MerkleValidator__factory.connect(addressbook.validator, provider)
    this.wyvernProxyRegistry = WyvernProxyRegistry__factory.connect(addressbook.registry, provider)
    this.atomicizer = WyvernAtomicizer__factory.connect(addressbook.atomicizer, provider)
    this.multicall = Multicall__factory.connect(addressbook.multicall, provider)
  }
}
