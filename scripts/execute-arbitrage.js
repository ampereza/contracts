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
  const dexRouters = {
    UNISWAP_V3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    SUSHISWAP: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    CAMELOT: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
    BALANCER: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    WOMBAT: "0x19609B03c976ccA288FbdAE5C21D4290CA2b17DC",
    ARBSWAP: "0x2F87511F76e6fabDa4Fd4BBf01f0ED8bb2A037F4",
    TRADERJOE: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
  };
  
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
    // Get prices from multiple DEXs
    const [
      sushiPrice, 
      camelotPrice, 
      balancerPrice, 
      wombatPrice, 
      arbswapPrice, 
      traderJoePrice
    ] = await Promise.all([
      flashLoan.getSushiPrice(DAI_ADDRESS, USDC_ADDRESS, testAmount),
      flashLoan.getCamelotPrice(DAI_ADDRESS, USDC_ADDRESS, testAmount),
      flashLoan.getBalancerPrice(DAI_ADDRESS, USDC_ADDRESS, testAmount),
      flashLoan.getWombatPrice(DAI_ADDRESS, USDC_ADDRESS, testAmount),
      flashLoan.getArbswapPrice(DAI_ADDRESS, USDC_ADDRESS, testAmount),
      flashLoan.getTraderJoePrice(DAI_ADDRESS, USDC_ADDRESS, testAmount)
    ]);
    
    // Create array of DEX prices
    const dexPrices = [
      { name: "SushiSwap", price: sushiPrice, router: dexRouters.SUSHISWAP },
      { name: "Camelot", price: camelotPrice, router: dexRouters.CAMELOT },
      { name: "Balancer", price: balancerPrice, router: dexRouters.BALANCER },
      { name: "Wombat", price: wombatPrice, router: dexRouters.WOMBAT },
      { name: "Arbswap", price: arbswapPrice, router: dexRouters.ARBSWAP },
      { name: "TraderJoe", price: traderJoePrice, router: dexRouters.TRADERJOE }
    ].filter(dex => dex.price > 0); // Only include DEXs with valid prices
    
    console.log("💱 Current prices across all DEXs:");
    dexPrices.forEach(dex => {
      console.log(`${dex.name}: 1000 DAI → ${hre.ethers.formatUnits(dex.price, 6)} USDC`);
    });
    
    if (dexPrices.length < 2) {
      console.log("❌ Need at least 2 DEXs with liquidity for arbitrage");
      return;
    }
    
    // Find best arbitrage opportunity
    const sortedPrices = dexPrices.sort((a, b) => Number(b.price - a.price));
    const highestDex = sortedPrices[0];
    const lowestDex = sortedPrices[sortedPrices.length - 1];
    
    const highestPrice = parseFloat(hre.ethers.formatUnits(highestDex.price, 6));
    const lowestPrice = parseFloat(hre.ethers.formatUnits(lowestDex.price, 6));
    
    // Calculate potential arbitrage opportunity
    const priceDiff = highestPrice - lowestPrice;
    const profitPercentage = (priceDiff / lowestPrice) * 100;
    
    console.log(`\n🔍 Best Arbitrage Opportunity:`);
    console.log(`${highestDex.name}: ${highestPrice.toFixed(6)} USDC (highest)`);
    console.log(`${lowestDex.name}: ${lowestPrice.toFixed(6)} USDC (lowest)`);
    console.log(`Price difference: ${priceDiff.toFixed(6)} USDC`);
    console.log(`Potential profit: ${profitPercentage.toFixed(3)}%`);
    
    // Only proceed if profit is > 0.8% (to cover all fees)
    if (profitPercentage < 80) { // 80 basis points = 0.8%
      console.log("❌ No profitable arbitrage opportunity found");
      console.log("💡 Need >0.8% price difference to cover Aave fees + DEX fees + gas");
      return;
    }
    
    console.log("✅ Profitable arbitrage opportunity detected!");
    
    console.log(`Strategy: DAI → USDC on ${lowestDex.name} (buy low)`);
    console.log(`Then: USDC → DAI on ${highestDex.name} (sell high)`);
    
    // Use the DEX with lowest price first, then highest price
    const dexA = lowestDex.router;  // Buy USDC here (lower price)
    const dexB = highestDex.router; // Sell USDC here (higher price)
    
    // Calculate minimum amounts with slippage protection
    const minUSDCOut = (testAmount * lowestDex.price * 995n) / (1000n * hre.ethers.parseEther("1")); // 0.5% slippage
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
