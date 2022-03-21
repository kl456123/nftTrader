import {
  WyvernExchangeWithBulkCancellations__factory,
  WyvernExchangeWithBulkCancellations,
  MerkleValidator,
  MerkleValidator__factory,
} from './typechain'
import { ethers, Contract } from 'ethers'
import { EXCHANGE_RINKEBY, MERKLE_VALIDATOR_RINKEBY } from './constants'

export class ContractsWrapper {
  public wyvernExchangeBulkCancellations: WyvernExchangeWithBulkCancellations
  public merkleValidator: MerkleValidator
  constructor(protected provider: ethers.providers.BaseProvider) {
    this.wyvernExchangeBulkCancellations = WyvernExchangeWithBulkCancellations__factory.connect(
      EXCHANGE_RINKEBY,
      provider
    )
    this.merkleValidator = MerkleValidator__factory.connect(MERKLE_VALIDATOR_RINKEBY, provider)
  }
}
