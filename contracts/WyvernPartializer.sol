/**
 *Submitted for verification at Etherscan.io on 2018-03-08
 */

pragma solidity ^0.4.13;

interface IERC721 {
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
}

interface IERC1155 {
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes calldata data
    ) external;
}

library OptionalTransfer {
    function transferERC721(
        address from,
        address to,
        IERC721 token,
        uint256 tokenId
    ) {
        if (to != address(0)) {
            // Transfer the token.
            token.safeTransferFrom(from, to, tokenId);
        }
        return true;
    }

    function transferERC1155(
        address from,
        address to,
        IERC1155 token,
        uint256 tokenId,
        uint256 amount
    ) external returns (bool) {
        if (to != address(0)) {
            // Transfer the token.
            token.safeTransferFrom(from, to, tokenId, amount, '');
        }

        return true;
    }
}
