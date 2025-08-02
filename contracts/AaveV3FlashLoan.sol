// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IFlashLoanReceiver} from "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanReceiver.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";

contract AaveV3FlashLoan is IFlashLoanReceiver {
    address public owner;
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IPool public immutable POOL;

    event FlashLoanExecuted(address asset, uint256 amount, uint256 premium);

    constructor(address addressProvider) {
        owner = msg.sender;
        ADDRESSES_PROVIDER = IPoolAddressesProvider(addressProvider);
        POOL = IPool(IPoolAddressesProvider(addressProvider).getPool());
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function executeFlashLoan(address asset, uint256 amount) external onlyOwner {
        address receiverAddress = address(this);
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // 0 = no debt (flash loan)
        address onBehalfOf = address(this);
        bytes memory params = "";
        uint16 referralCode = 0;

        POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }

    // This function is called by Aave after the loan is received
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata /* params */
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Untrusted lender");
        require(initiator == address(this), "Untrusted initiator");

        // Your custom logic goes here (arbitrage, liquidation, etc.)
        // For this example, we just emit an event
        for (uint256 i = 0; i < assets.length; i++) {
            emit FlashLoanExecuted(assets[i], amounts[i], premiums[i]);
            
            // Calculate the amount to be paid back
            uint256 totalAmount = amounts[i] + premiums[i];
            
            // Approve the Pool contract allowance to pull the owed amount
            IERC20(assets[i]).approve(address(POOL), totalAmount);
        }

        return true;
    }

    // Function to get the current balance of any ERC20 token
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Emergency function to withdraw tokens (only owner)
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    // Function to receive Ether
    receive() external payable {}
}
