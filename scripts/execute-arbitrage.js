const hre = require("hardhat");

async function main() {
  console.log("🔄 Executing Flash Loan Arbitrage on Arbitrum...");
  
  // Replace with your deployed contract address
  const FLASH_LOAN_CONTRACT = "YOUR_DEPLOYED_CONTRACT_ADDRESS";
  
  // Arbitrum token addresses
  const DAI_ADDRESS = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
  const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  
  // Arbitrum DEX addresses
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const SUSHI_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  const CAMELOT_ROUTER = "0xc873fEcbd354f5A56E00E710B90EF4201db2448d";
  
  const [signer] = await hre.ethers.getSigners();
  console.log("Executing with account:", signer.address);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  // Get the deployed contract
  const flashLoan = await hre.ethers.getContractAt("AaveV3FlashLoan", FLASH_LOAN_CONTRACT);
  
  // Check current prices on different DEXs
  console.log("\n📊 Checking current prices...");
  
  const flashLoanAmount = hre.ethers.parseEther("10000"); // 10,000 DAI for arbitrage
  const testAmount = hre.ethers.parseEther("1000"); // 1,000 DAI for price checking
  
  try {
    // Get prices from different DEXs
    const sushiPrice = await flashLoan.getSushiPrice(DAI_ADDRESS, USDC_ADDRESS, testAmount);
    const camelotPrice = await flashLoan.getCamelotPrice(DAI_ADDRESS, USDC_ADDRESS, testAmount);
    
    console.log(`SushiSwap: 1000 DAI → ${hre.ethers.formatUnits(sushiPrice, 6)} USDC`);
    console.log(`Camelot: 1000 DAI → ${hre.ethers.formatUnits(camelotPrice, 6)} USDC`);
    
    // Calculate potential arbitrage opportunity
    const priceDiff = sushiPrice > camelotPrice ? sushiPrice - camelotPrice : camelotPrice - sushiPrice;
    const profitPercentage = (priceDiff * 100n) / (sushiPrice > camelotPrice ? camelotPrice : sushiPrice);
    
    console.log(`Price difference: ${hre.ethers.formatUnits(priceDiff, 6)} USDC`);
    console.log(`Potential profit: ${profitPercentage}%`);
    
    // Only proceed if profit is > 0.2%
    if (profitPercentage < 20n) { // 20 basis points = 0.2%
      console.log("❌ No profitable arbitrage opportunity found");
      console.log("💡 Try again later when price differences are larger");
      return;
    }
    
    console.log("✅ Profitable arbitrage opportunity detected!");
    
    // Determine which DEX has better rates
    const useUniswapFirst = sushiPrice > camelotPrice;
    const dexA = useUniswapFirst ? SUSHI_ROUTER : CAMELOT_ROUTER;
    const dexB = useUniswapFirst ? CAMELOT_ROUTER : SUSHI_ROUTER;
    
    console.log(`Strategy: DAI → USDC on ${useUniswapFirst ? 'SushiSwap' : 'Camelot'}`);
    console.log(`Then: USDC → DAI on ${useUniswapFirst ? 'Camelot' : 'SushiSwap'}`);
    
    // Calculate minimum amounts with slippage protection
    const minUSDCOut = (testAmount * (useUniswapFirst ? sushiPrice : camelotPrice) * 995n) / (1000n * hre.ethers.parseEther("1")); // 0.5% slippage
    const minDAIBack = (flashLoanAmount * 998n) / 1000n; // Must get back at least 99.8% to cover fees
    
    // Prepare arbitrage parameters
    const arbitrageParams = {
      tokenA: DAI_ADDRESS,
      tokenB: USDC_ADDRESS, 
      dexA: dexA,
      dexB: dexB,
      amountIn: flashLoanAmount,
      minAmountOut: minUSDCOut * 10n, // Scale for 10k DAI
      routerCallDataA: "0x", // Not used in this implementation
      routerCallDataB: "0x"  // Not used in this implementation
    };
    
    console.log("\n🚀 Executing arbitrage flash loan...");
    console.log("Flash loan amount:", hre.ethers.formatEther(flashLoanAmount), "DAI");
    console.log("Expected min USDC:", hre.ethers.formatUnits(arbitrageParams.minAmountOut, 6));
    
    // Execute the arbitrage flash loan
    const tx = await flashLoan.executeArbitrageFlashLoan(
      DAI_ADDRESS,
      flashLoanAmount,
      arbitrageParams,
      {
        gasLimit: 1000000 // Set high gas limit for complex arbitrage
      }
    );
    
    console.log("\n📡 Transaction submitted!");
    console.log("Transaction Hash:", tx.hash);
    console.log(`🔍 View on Arbiscan: https://arbiscan.io/tx/${tx.hash}`);
    
    console.log("\n⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log("✅ Arbitrage executed successfully!");
      
      // Parse events to show results
      const events = receipt.logs;
      for (const log of events) {
        try {
          const parsed = flashLoan.interface.parseLog(log);
          if (parsed.name === "ArbitrageExecuted") {
            const profit = parsed.args.profit;
            const profitInDAI = hre.ethers.formatEther(profit);
            const profitUSD = parseFloat(profitInDAI) * 1; // Assuming 1 DAI ≈ $1
            
            console.log(`💰 Profit earned: ${profitInDAI} DAI (~$${profitUSD.toFixed(2)})`);
            console.log(`📈 ROI: ${((parseFloat(profitInDAI) / parseFloat(hre.ethers.formatEther(flashLoanAmount))) * 100).toFixed(4)}%`);
          }
        } catch (e) {
          // Ignore parsing errors for non-contract events
        }
      }
      
      console.log("Block Number:", receipt.blockNumber);
      console.log("Gas Used:", receipt.gasUsed.toString());
      
      // Calculate total cost
      const totalCost = receipt.gasUsed * (receipt.gasPrice || 0n);
      console.log("Total Gas Cost:", hre.ethers.formatEther(totalCost), "ETH");
      
      // Check final balance
      const finalBalance = await flashLoan.getBalance(DAI_ADDRESS);
      if (finalBalance > 0) {
        console.log(`💼 Contract has ${hre.ethers.formatEther(finalBalance)} DAI profit remaining`);
        console.log("💡 Use withdrawProfits() to claim your earnings!");
      }
      
    } else {
      console.log("❌ Transaction failed!");
    }
    
  } catch (priceError) {
    console.log("⚠️  Could not fetch prices. Executing basic flash loan for testing...");
    
    // Fallback to basic flash loan execution
    const basicTx = await flashLoan.executeFlashLoan(DAI_ADDRESS, hre.ethers.parseEther("1000"), {
      gasLimit: 300000
    });
    
    console.log("\n📡 Basic flash loan submitted!");
    console.log("Transaction Hash:", basicTx.hash);
    console.log(`🔍 View on Arbiscan: https://arbiscan.io/tx/${basicTx.hash}`);
    
    const basicReceipt = await basicTx.wait();
    console.log("✅ Basic flash loan completed!");
  }
  
  console.log(`\n🔍 Final Explorer Links:`);
  console.log(`Contract: https://arbiscan.io/address/${FLASH_LOAN_CONTRACT}`);
  
}

main()
  .then(() => {
    console.log("\n🎉 Flash loan arbitrage script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Flash loan arbitrage failed:", error);
    process.exit(1);
  });
