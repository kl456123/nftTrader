import {
  IERC721__factory,
  IERC1155__factory,
  IERC20__factory,
} from '../typechain'
import { SchemaName, Network } from '../types'
import { Interface } from '@ethersproject/abi'

export type Schema = {
  name: SchemaName
  contractInterface: Interface
}

export const rinkebySchemas: Array<Schema> = []

export const mainSchemas: Array<Schema> = [
  {
    name: SchemaName.ERC721,
    contractInterface: IERC721__factory.createInterface(),
  },
  {
    name: SchemaName.ERC1155,
    contractInterface: IERC1155__factory.createInterface(),
  },
  {
    name: SchemaName.ERC20,
    contractInterface: IERC20__factory.createInterface(),
  },
]

export const schemas: { [network in Network]: Array<Schema> } = {
  [Network.Main]: mainSchemas,
  [Network.Rinkeby]: mainSchemas,
  [Network.BSC]: mainSchemas,
  [Network.BSC_Test]: mainSchemas,
  [Network.OEC]: mainSchemas,
  [Network.OEC_Test]: mainSchemas,
}
