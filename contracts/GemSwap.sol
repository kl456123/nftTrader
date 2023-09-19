// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

import './markets/MarketRegistry.sol';

contract GemSwap is Ownable, ReentrancyGuard {
    struct OpenseaTrades {
        uint256 value;
        bytes tradeData;
    }

    struct ERC20Details {
        address[] tokenAddrs;
        uint256[] amounts;
    }

    struct ERC1155Details {
        address tokenAddr;
        uint256[] ids;
        uint256[] amounts;
    }

    struct ERC721Details {
        address tokenAddr;
        address[] to;
        uint256[] ids;
    }

    struct ConverstionDetails {
        bytes conversionData;
    }

    struct AffiliateDetails {
        address affiliate;
        bool isActive;
    }

    struct SponsoredMarket {
        uint256 marketId;
        bool isActive;
    }

    address public constant GOV = 0x83d841bC0450D5Ac35DCAd8d05Db53EbA29978c2;
    address public guardian;
    address public converter;
    address public punkProxy;
    uint256 public baseFees;
    bool public openForTrades;
    bool public openForFreeTrades;
    MarketRegistry public marketRegistry;
    AffiliateDetails[] public affiliates;
    SponsoredMarket[] public sponsoredMarkets;

    modifier isOpenForTrades() {
        require(openForTrades, 'trades not allowed');
        _;
    }

    modifier isOpenForFreeTrades() {
        require(openForFreeTrades, 'free trades not allowed');
        _;
    }

    constructor(
        address _marketRegistry,
        address _converter,
        address _guardian
    ) {
        marketRegistry = MarketRegistry(_marketRegistry);
        converter = _converter;
        guardian = _guardian;
        baseFees = 0;
        openForTrades = true;
        openForFreeTrades = true;
        affiliates.push(AffiliateDetails(GOV, true));
    }

    // @audit This function is used to approve specific tokens to specific market contracts with high volume.
    // This is done in very rare cases for the gas optimization purposes.
    function setOneTimeApproval(
        IERC20 token,
        address operator,
        uint256 amount
    ) external onlyOwner {
        token.approve(operator, amount);
    }

    function updateGuardian(address _guardian) external onlyOwner {
        guardian = _guardian;
    }

    function addAffiliate(address _affiliate) external onlyOwner {
        affiliates.push(AffiliateDetails(_affiliate, true));
    }

    function updateAffiliate(
        uint256 _affiliateIndex,
        address _affiliate,
        bool _IsActive
    ) external onlyOwner {
        affiliates[_affiliateIndex] = AffiliateDetails(_affiliate, _IsActive);
    }

    function addSponsoredMarket(uint256 _marketId) external onlyOwner {
        sponsoredMarkets.push(SponsoredMarket(_marketId, true));
    }

    function updateSponsoredMarket(
        uint256 _marketIndex,
        uint256 _marketId,
        bool _isActive
    ) external onlyOwner {
        sponsoredMarkets[_marketIndex] = SponsoredMarket(_marketId, _isActive);
    }

    function setBaseFees(uint256 _baseFees) external onlyOwner {
        baseFees = _baseFees;
    }

    function setOpenForTrades(bool _openForTrades) external onlyOwner {
        openForTrades = _openForTrades;
    }

    function setOpenForFreeTrades(bool _openForFreeTrades) external onlyOwner {
        openForFreeTrades = _openForFreeTrades;
    }

    // @audit we will setup a system that will monitor the contract for any leftover
    // assets. In case any asset is leftover, the system should be able to trigger this
    // function to close all the trades until the leftover assets are rescued.
    function closeAllTrades() external {
        require(_msgSender() == guardian);
        openForTrades = false;
        openForFreeTrades = false;
    }

    function setConverter(address _converter) external onlyOwner {
        converter = _converter;
    }

    function setMarketRegistry(MarketRegistry _marketRegistry)
        external
        onlyOwner
    {
        marketRegistry = _marketRegistry;
    }

    function _transferEth(address _to, uint256 _amount) internal {
        bool callStatus;
        assembly {
            // Transfer the ETH and store if it succeeded or not.
            callStatus := call(gas(), _to, _amount, 0, 0, 0, 0)
        }
        require(callStatus, '_transferEth: Eth transfer failed');
    }

    function _collectFee(uint256[2] memory feeDetails) internal {
        require(feeDetails[1] >= baseFees, 'Insufficient fee');
        if (feeDetails[1] > 0) {
            AffiliateDetails memory affiliateDetails = affiliates[
                feeDetails[0]
            ];
            affiliateDetails.isActive
                ? _transferEth(affiliateDetails.affiliate, feeDetails[1])
                : _transferEth(GOV, feeDetails[1]);
        }
    }

    function _checkCallResult(bool _success) internal pure {
        if (!_success) {
            // Copy revert reason from call
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    function _transferFromHelper(
        ERC20Details memory erc20Details,
        ERC721Details[] memory erc721Details,
        ERC1155Details[] memory erc1155Details
    ) internal {
        // transfer ERC20 tokens from the sender to this contract
        for (uint256 i = 0; i < erc20Details.tokenAddrs.length; i++) {
            erc20Details.tokenAddrs[i].call(
                abi.encodeWithSelector(
                    0x23b872dd,
                    msg.sender,
                    address(this),
                    erc20Details.amounts[i]
                )
            );
        }

        // transfer ERC721 tokens from the sender to this contract
        for (uint256 i = 0; i < erc721Details.length; i++) {
            for (uint256 j = 0; j < erc721Details[i].ids.length; j++) {
                IERC721(erc721Details[i].tokenAddr).transferFrom(
                    _msgSender(),
                    address(this),
                    erc721Details[i].ids[j]
                );
            }
        }

        // transfer ERC1155 tokens from the sender to this contract
        for (uint256 i = 0; i < erc1155Details.length; i++) {
            IERC1155(erc1155Details[i].tokenAddr).safeBatchTransferFrom(
                _msgSender(),
                address(this),
                erc1155Details[i].ids,
                erc1155Details[i].amounts,
                ''
            );
        }
    }

    function _conversionHelper(ConverstionDetails[] memory _converstionDetails)
        internal
    {
        for (uint256 i = 0; i < _converstionDetails.length; i++) {
            // convert to desired asset
            (bool success, ) = converter.delegatecall(
                _converstionDetails[i].conversionData
            );
            // check if the call passed successfully
            _checkCallResult(success);
        }
    }

    function _trade(MarketRegistry.TradeDetails[] memory _tradeDetails)
        internal
    {
        for (uint256 i = 0; i < _tradeDetails.length; i++) {
            // get market details
            (address _proxy, bool _isLib, bool _isActive) = marketRegistry
                .markets(_tradeDetails[i].marketId);
            // market should be active
            require(_isActive, '_trade: InActive Market');
            // execute trade
            (bool success, ) = _isLib
                ? _proxy.delegatecall(_tradeDetails[i].tradeData)
                : _proxy.call{value: _tradeDetails[i].value}(
                    _tradeDetails[i].tradeData
                );
            // check if the call passed successfully
            _checkCallResult(success);
        }
    }

    function _returnDust(address[] memory _tokens) internal {
        // return remaining ETH (if any)
        assembly {
            if gt(selfbalance(), 0) {
                let callStatus := call(
                    gas(),
                    caller(),
                    selfbalance(),
                    0,
                    0,
                    0,
                    0
                )
            }
        }
        // return remaining tokens (if any)
        for (uint256 i = 0; i < _tokens.length; i++) {
            if (IERC20(_tokens[i]).balanceOf(address(this)) > 0) {
                _tokens[i].call(
                    abi.encodeWithSelector(
                        0xa9059cbb,
                        msg.sender,
                        IERC20(_tokens[i]).balanceOf(address(this))
                    )
                );
            }
        }
    }

    // swaps any combination of ERC-20/721/1155
    // User needs to approve assets before invoking swap
    // WARNING: DO NOT SEND TOKENS TO THIS FUNCTION DIRECTLY!!!
    function multiAssetSwap(
        ERC20Details memory erc20Details,
        ERC721Details[] memory erc721Details,
        ERC1155Details[] memory erc1155Details,
        ConverstionDetails[] memory converstionDetails,
        MarketRegistry.TradeDetails[] memory tradeDetails,
        address[] memory dustTokens
    ) external payable isOpenForTrades nonReentrant {
        // transfer all tokens
        _transferFromHelper(erc20Details, erc721Details, erc1155Details);

        // Convert any assets if needed
        _conversionHelper(converstionDetails);

        // execute trades
        _trade(tradeDetails);

        // return dust tokens (if any)
        _returnDust(dustTokens);
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) public virtual returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) public virtual returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external virtual returns (bytes4) {
        return 0x150b7a02;
    }

    // Used by ERC721BasicToken.sol
    function onERC721Received(
        address,
        uint256,
        bytes calldata
    ) external virtual returns (bytes4) {
        return 0xf0b9e5ba;
    }

    function supportsInterface(bytes4 interfaceId)
        external
        view
        virtual
        returns (bool)
    {
        return interfaceId == this.supportsInterface.selector;
    }

    receive() external payable {}

    // Emergency function: In case any ETH get stuck in the contract unintentionally
    // Only owner can retrieve the asset balance to a recipient address
    function rescueETH(address recipient) external onlyOwner {
        _transferEth(recipient, address(this).balance);
    }

    // Emergency function: In case any ERC20 tokens get stuck in the contract unintentionally
    // Only owner can retrieve the asset balance to a recipient address
    function rescueERC20(address asset, address recipient) external onlyOwner {
        asset.call(
            abi.encodeWithSelector(
                0xa9059cbb,
                recipient,
                IERC20(asset).balanceOf(address(this))
            )
        );
    }

    // Emergency function: In case any ERC721 tokens get stuck in the contract unintentionally
    // Only owner can retrieve the asset balance to a recipient address
    function rescueERC721(
        address asset,
        uint256[] calldata ids,
        address recipient
    ) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            IERC721(asset).transferFrom(address(this), recipient, ids[i]);
        }
    }

    // Emergency function: In case any ERC1155 tokens get stuck in the contract unintentionally
    // Only owner can retrieve the asset balance to a recipient address
    function rescueERC1155(
        address asset,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        address recipient
    ) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            IERC1155(asset).safeTransferFrom(
                address(this),
                recipient,
                ids[i],
                amounts[i],
                ''
            );
        }
    }
}
