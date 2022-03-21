import { IERC721__factory, IERC1155__factory } from '../typechain'
import { SchemaName } from '../types'
import { Interface } from '@ethersproject/abi'

export type Schema = {
  name: SchemaName
  contractInterface: Interface
}

export const rinkebySchemas: Array<Schema> = []

export const mainSchemas: Array<Schema> = [
  { name: SchemaName.ERC721, contractInterface: IERC721__factory.createInterface() },
  { name: SchemaName.ERC1155, contractInterface: IERC1155__factory.createInterface() },
]

export const schemas = {
  rinkeby: rinkebySchemas,
  main: mainSchemas,
}
