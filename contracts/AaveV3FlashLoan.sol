// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IFlashLoanReceiver} from "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanReceiver.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IUniswapV3Router.sol";
import "./interfaces/ISushiSwapRouter.sol";
import "./interfaces/ICamelotRouter.sol";
import "./interfaces/IWETH.sol";

contract AaveV3FlashLoan is IFlashLoanReceiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public owner;
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IPool public immutable POOL;

    // Arbitrum DEX Router Addresses
    IUniswapV3Router public constant UNISWAP_V3_ROUTER = IUniswapV3Router(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    ISushiSwapRouter public constant SUSHI_ROUTER = ISushiSwapRouter(0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506);
    ICamelotRouter public constant CAMELOT_ROUTER = ICamelotRouter(0xc873fEcbd354f5A56E00E710B90EF4201db2448d);
    IWETH public constant WETH = IWETH(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1);

    // Common token addresses on Arbitrum
    address public constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address public constant USDT = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    address public constant WETH_ADDRESS = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    // Arbitrage configuration
    uint256 public minProfitBasisPoints = 10; // 0.1% minimum profit
    uint256 public maxSlippageBasisPoints = 100; // 1% max slippage
    uint256 public constant BASIS_POINTS = 10000;

    struct ArbitrageParams {
        address tokenA;
        address tokenB;
        address dexA; // Router address for first DEX
        address dexB; // Router address for second DEX
        uint256 amountIn;
        uint256 minAmountOut;
        bytes routerCallDataA; // Encoded call data for DEX A
        bytes routerCallDataB; // Encoded call data for DEX B
    }

    event FlashLoanExecuted(address asset, uint256 amount, uint256 premium);
    event ArbitrageExecuted(
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit
    );
    event ProfitWithdrawn(address indexed token, uint256 amount);

    constructor(address addressProvider) {
        owner = msg.sender;
        ADDRESSES_PROVIDER = IPoolAddressesProvider(addressProvider);
        POOL = IPool(IPoolAddressesProvider(addressProvider).getPool());
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // Basic flash loan execution (for simple operations)
    function executeFlashLoan(address asset, uint256 amount) external onlyOwner {
        _executeFlashLoan(asset, amount, "");
    }

    // Advanced arbitrage flash loan
    function executeArbitrageFlashLoan(
        address asset,
        uint256 amount,
        ArbitrageParams calldata arbitrageParams
    ) external onlyOwner nonReentrant {
        bytes memory params = abi.encode(arbitrageParams);
        _executeFlashLoan(asset, amount, params);
    }

    // Internal function to execute flash loan
    function _executeFlashLoan(address asset, uint256 amount, bytes memory params) internal {
        address receiverAddress = address(this);
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // 0 = no debt (flash loan)
        address onBehalfOf = address(this);
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
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Untrusted lender");
        require(initiator == address(this), "Untrusted initiator");

        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwed = amounts[i] + premiums[i];
            
            // If params are provided, execute arbitrage logic
            if (params.length > 0) {
                ArbitrageParams memory arbitrageParams = abi.decode(params, (ArbitrageParams));
                _executeArbitrage(assets[i], amounts[i], arbitrageParams);
            }

            emit FlashLoanExecuted(assets[i], amounts[i], premiums[i]);
            
            // Ensure we have enough balance to repay the loan
            uint256 currentBalance = IERC20(assets[i]).balanceOf(address(this));
            require(currentBalance >= amountOwed, "Insufficient balance to repay loan");
            
            // Approve the Pool contract allowance to pull the owed amount
            IERC20(assets[i]).approve(address(POOL), amountOwed);
        }

        return true;
    }

    // Core arbitrage logic
    function _executeArbitrage(
        address flashAsset,
        uint256 flashAmount,
        ArbitrageParams memory params
    ) internal {
        require(params.tokenA == flashAsset, "Flash asset must match tokenA");
        require(params.amountIn <= flashAmount, "Amount exceeds flash loan");

        // Step 1: Trade on DEX A (tokenA -> tokenB)
        uint256 balanceBeforeTrade = IERC20(params.tokenB).balanceOf(address(this));
        
        IERC20(params.tokenA).approve(params.dexA, params.amountIn);
        
        if (params.dexA == address(UNISWAP_V3_ROUTER)) {
            _executeUniswapV3Trade(params.tokenA, params.tokenB, params.amountIn, params.minAmountOut);
        } else if (params.dexA == address(SUSHI_ROUTER)) {
            _executeSushiTrade(params.tokenA, params.tokenB, params.amountIn, params.minAmountOut);
        } else if (params.dexA == address(CAMELOT_ROUTER)) {
            _executeCamelotTrade(params.tokenA, params.tokenB, params.amountIn, params.minAmountOut);
        } else {
            revert("Unsupported DEX A");
        }

        uint256 tokenBReceived = IERC20(params.tokenB).balanceOf(address(this)) - balanceBeforeTrade;
        require(tokenBReceived >= params.minAmountOut, "Insufficient output from DEX A");

        // Step 2: Trade on DEX B (tokenB -> tokenA) 
        uint256 balanceBeforeReturn = IERC20(params.tokenA).balanceOf(address(this));
        
        IERC20(params.tokenB).approve(params.dexB, tokenBReceived);
        
        if (params.dexB == address(UNISWAP_V3_ROUTER)) {
            _executeUniswapV3Trade(params.tokenB, params.tokenA, tokenBReceived, params.amountIn);
        } else if (params.dexB == address(SUSHI_ROUTER)) {
            _executeSushiTrade(params.tokenB, params.tokenA, tokenBReceived, params.amountIn);
        } else if (params.dexB == address(CAMELOT_ROUTER)) {
            _executeCamelotTrade(params.tokenB, params.tokenA, tokenBReceived, params.amountIn);
        } else {
            revert("Unsupported DEX B");
        }

        uint256 finalBalance = IERC20(params.tokenA).balanceOf(address(this));
        uint256 totalReceived = finalBalance - balanceBeforeReturn;
        
        // Calculate profit
        require(totalReceived > params.amountIn, "Arbitrage not profitable");
        uint256 profit = totalReceived - params.amountIn;
        
        // Ensure minimum profit threshold
        uint256 minProfit = (params.amountIn * minProfitBasisPoints) / BASIS_POINTS;
        require(profit >= minProfit, "Profit below minimum threshold");

        emit ArbitrageExecuted(params.tokenA, params.tokenB, params.amountIn, totalReceived, profit);
    }

    // Uniswap V3 trading function
    function _executeUniswapV3Trade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) internal returns (uint256) {
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: 3000, // 0.3% fee tier
            recipient: address(this),
            deadline: block.timestamp + 300, // 5 minutes
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        return UNISWAP_V3_ROUTER.exactInputSingle(params);
    }

    // SushiSwap trading function
    function _executeSushiTrade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) internal returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = SUSHI_ROUTER.swapExactTokensForTokens(
            amountIn,
            amountOutMinimum,
            path,
            address(this),
            block.timestamp + 300
        );

        return amounts[1];
    }

    // Camelot trading function
    function _executeCamelotTrade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) internal returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));

        CAMELOT_ROUTER.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            amountOutMinimum,
            path,
            address(this),
            address(0), // no referrer
            block.timestamp + 300
        );

        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        return balanceAfter - balanceBefore;
    }

    // Price checking functions for arbitrage opportunities
    function getUniswapV3Price(address tokenA, address tokenB, uint256 amountIn) 
        external 
        view 
        returns (uint256) 
    {
        // Note: This is a simplified version. In production, you'd use Uniswap V3 quoter
        // For now, return 0 as placeholder
        return 0;
    }

    function getSushiPrice(address tokenA, address tokenB, uint256 amountIn) 
        external 
        view 
        returns (uint256) 
    {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        
        try SUSHI_ROUTER.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return amounts[1];
        } catch {
            return 0;
        }
    }

    function getCamelotPrice(address tokenA, address tokenB, uint256 amountIn) 
        external 
        view 
        returns (uint256) 
    {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        
        try CAMELOT_ROUTER.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return amounts[1];
        } catch {
            return 0;
        }
    }

    // Configuration functions
    function setMinProfitBasisPoints(uint256 _minProfitBasisPoints) external onlyOwner {
        require(_minProfitBasisPoints <= 1000, "Max 10%"); // Max 10%
        minProfitBasisPoints = _minProfitBasisPoints;
    }

    function setMaxSlippageBasisPoints(uint256 _maxSlippageBasisPoints) external onlyOwner {
        require(_maxSlippageBasisPoints <= 1000, "Max 10%"); // Max 10%
        maxSlippageBasisPoints = _maxSlippageBasisPoints;
    }

    // Utility functions
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Emergency function to withdraw tokens (only owner)
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
        emit ProfitWithdrawn(token, amount);
    }

    // Withdraw profits after successful arbitrage
    function withdrawProfits(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No profits to withdraw");
        
        IERC20(token).transfer(owner, balance);
        emit ProfitWithdrawn(token, balance);
    }

    // Emergency function to withdraw ETH
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool success, ) = owner.call{value: balance}("");
        require(success, "ETH withdrawal failed");
    }

    // Function to receive Ether
    receive() external payable {}

    // Fallback function for any unexpected calls
    fallback() external payable {}
}
