// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.4;

import './interfaces/IWETH.sol';

library Converter {
    function ethToWeth(address weth, uint256 amount) external {
        bytes memory _data = abi.encodeWithSelector(IWETH.deposit.selector);
        (bool success, ) = address(weth).call{value: amount}(_data);
        if (!success) {
            // Copy revert reason from call
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    function wethToEth(address weth, uint256 amount) external {
        IWETH(weth).withdraw(amount);
    }
}
