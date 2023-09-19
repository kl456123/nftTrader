/**
 *Submitted for verification at Etherscan.io on 2018-03-08
 */

pragma solidity ^0.4.13;

library WyvernAtomicizer {
    function atomicize(
        address[] addrs,
        uint256[] values,
        uint256[] calldataLengths,
        bytes calldatas
    ) public {
        require(
            addrs.length == values.length &&
                addrs.length == calldataLengths.length
        );

        uint256 j = 0;
        for (uint256 i = 0; i < addrs.length; i++) {
            bytes memory calldata = new bytes(calldataLengths[i]);
            for (uint256 k = 0; k < calldataLengths[i]; k++) {
                calldata[k] = calldatas[j];
                j++;
            }
            require(addrs[i].call.value(values[i])(calldata));
        }
    }
}
