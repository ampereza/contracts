// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external {
        // Simple mock - just call back immediately
        // In real implementation, this would transfer tokens first
    }
}
