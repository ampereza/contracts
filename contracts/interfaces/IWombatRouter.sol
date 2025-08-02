// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWombatRouter {
    function swapExactTokensForTokens(
        address[] calldata tokenPath,
        address[] calldata poolPath,
        uint256 fromAmount,
        uint256 minimumToAmount,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function getAmountOut(
        address[] calldata tokenPath,
        address[] calldata poolPath,
        uint256 fromAmount
    ) external view returns (uint256 potentialOutcome, uint256 haircut);
    
    function quotePotentialSwap(
        address fromToken,
        address toToken,
        uint256 fromAmount
    ) external view returns (uint256 potentialOutcome, uint256 haircut);
}
