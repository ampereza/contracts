const hre = require("hardhat");

async function main() {
  console.log("📊 Arbitrage Opportunity Monitor for Arbitrum");
  console.log("===========================================");
  
  // Contract address (replace with your deployed contract)
  const FLASH_LOAN_CONTRACT = "YOUR_DEPLOYED_CONTRACT_ADDRESS"; 
  
  // DEX router addresses
  const dexRouters = {
    UNISWAP_V3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    SUSHISWAP: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    CAMELOT: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
    BALANCER: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    WOMBAT: "0x19609B03c976ccA288FbdAE5C21D4290CA2b17DC",
    ARBSWAP: "0x2F87511F76e6fabDa4Fd4BBf01f0ED8bb2A037F4",
    TRADERJOE: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
  };
  const tokens = {
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
  };
  
  // Trading pairs to monitor
  const pairs = [
    { tokenA: "DAI", tokenB: "USDC", decimalsA: 18, decimalsB: 6 },
    { tokenA: "DAI", tokenB: "USDT", decimalsA: 18, decimalsB: 6 },
    { tokenA: "USDC", tokenB: "USDT", decimalsA: 6, decimalsB: 6 },
    { tokenA: "DAI", tokenB: "WETH", decimalsA: 18, decimalsB: 18 }
  ];
  
  try {
    // Get the deployed contract
    const flashLoan = await hre.ethers.getContractAt("AaveV3FlashLoan", FLASH_LOAN_CONTRACT);
    
    console.log("\n🔍 Scanning for arbitrage opportunities...\n");
    
    for (const pair of pairs) {
      await analyzePair(flashLoan, tokens, pair);
    }
    
  } catch (error) {
    console.log("⚠️  Could not connect to contract. Make sure it's deployed.");
    console.log("Error:", error.message);
  }
}

async function analyzePair(flashLoan, tokens, pair) {
  const testAmount = hre.ethers.parseUnits("1000", pair.decimalsA); // Test with 1000 units
  
  console.log(`📈 ${pair.tokenA}/${pair.tokenB} Analysis`);
  console.log("─".repeat(40));
  
  try {
    // Get prices from different DEXs
    const [
      sushiPrice, 
      camelotPrice, 
      balancerPrice, 
      wombatPrice, 
      arbswapPrice, 
      traderJoePrice
    ] = await Promise.all([
      flashLoan.getSushiPrice(tokens[pair.tokenA], tokens[pair.tokenB], testAmount),
      flashLoan.getCamelotPrice(tokens[pair.tokenA], tokens[pair.tokenB], testAmount),
      flashLoan.getBalancerPrice(tokens[pair.tokenA], tokens[pair.tokenB], testAmount),
      flashLoan.getWombatPrice(tokens[pair.tokenA], tokens[pair.tokenB], testAmount),
      flashLoan.getArbswapPrice(tokens[pair.tokenA], tokens[pair.tokenB], testAmount),
      flashLoan.getTraderJoePrice(tokens[pair.tokenA], tokens[pair.tokenB], testAmount)
    ]);
    
    // Format prices
    const prices = {
      SushiSwap: parseFloat(hre.ethers.formatUnits(sushiPrice, pair.decimalsB)),
      Camelot: parseFloat(hre.ethers.formatUnits(camelotPrice, pair.decimalsB)),
      Balancer: parseFloat(hre.ethers.formatUnits(balancerPrice, pair.decimalsB)),
      Wombat: parseFloat(hre.ethers.formatUnits(wombatPrice, pair.decimalsB)),
      Arbswap: parseFloat(hre.ethers.formatUnits(arbswapPrice, pair.decimalsB)),
      TraderJoe: parseFloat(hre.ethers.formatUnits(traderJoePrice, pair.decimalsB))
    };
    
    // Display prices for all DEXs
    Object.entries(prices).forEach(([dex, price]) => {
      if (price > 0) {
        console.log(`${dex.padEnd(12)}: 1000 ${pair.tokenA} → ${price.toFixed(4)} ${pair.tokenB}`);
      } else {
        console.log(`${dex.padEnd(12)}: ❌ No liquidity or error`);
      }
    });
    
    // Find best arbitrage opportunities
    const validPrices = Object.entries(prices).filter(([_, price]) => price > 0);
    
    if (validPrices.length >= 2) {
      const sortedPrices = validPrices.sort((a, b) => b[1] - a[1]);
      const highestDex = sortedPrices[0][0];
      const lowestDex = sortedPrices[sortedPrices.length - 1][0];
      const highestPrice = sortedPrices[0][1];
      const lowestPrice = sortedPrices[sortedPrices.length - 1][1];
      
      const priceDiff = Math.abs(highestPrice - lowestPrice);
      const avgPrice = (highestPrice + lowestPrice) / 2;
      const profitPercentage = (priceDiff / avgPrice) * 100;
      
      console.log(`\n🔍 Best Arbitrage Opportunity:`);
      console.log(`Price Diff: ${priceDiff.toFixed(4)} ${pair.tokenB} (${profitPercentage.toFixed(3)}%)`);
      
      // Determine direction and profitability
      if (profitPercentage > 0.1) { // > 0.1% difference
        const direction = `🔄 ${highestDex} → ${lowestDex}`;
        
        if (profitPercentage > 0.8) { // Profitable after fees
          console.log(`🟢 HIGHLY PROFITABLE: ${direction}`);
          console.log(`💰 Estimated profit: ${profitPercentage.toFixed(3)}%`);
          
          // Calculate potential profit for larger amounts
          const flashLoanSizes = [10000, 50000, 100000];
          console.log("💡 Potential profits for different flash loan sizes:");
          
          for (const size of flashLoanSizes) {
            const grossProfit = (size * profitPercentage) / 100;
            const aaveFee = size * 0.0005; // 0.05% Aave fee
            const dexFees = size * 0.006; // ~0.6% total DEX fees
            const netProfit = grossProfit - aaveFee - dexFees;
            
            if (netProfit > 0) {
              console.log(`   ${size.toLocaleString()} ${pair.tokenA}: ~$${netProfit.toFixed(2)} profit`);
            }
          }
        } else if (profitPercentage > 0.3) {
          console.log(`🟡 MODERATE OPPORTUNITY: ${direction}`);
          console.log(`💰 Estimated profit: ${profitPercentage.toFixed(3)}% (check gas costs)`);
        } else {
          console.log(`🟠 SMALL OPPORTUNITY: ${direction}`);
          console.log(`⚠️  Might not be profitable after gas costs`);
        }
      } else {
        console.log("🔴 No significant arbitrage opportunity");
      }
    } else {
      console.log("⚠️  Insufficient liquidity across DEXs for meaningful arbitrage");
    }
    
  } catch (error) {
    console.log("❌ Error analyzing pair:", error.message);
  }
  
  console.log(""); // Empty line for spacing
}

// Real-time monitoring function
async function startMonitoring() {
  console.log("🔄 Starting real-time monitoring (every 30 seconds)...");
  console.log("Press Ctrl+C to stop\n");
  
  setInterval(async () => {
    console.log(`\n⏰ ${new Date().toLocaleTimeString()} - Checking opportunities...`);
    await main();
  }, 30000); // Check every 30 seconds
}

// Run once or start monitoring
if (process.argv[2] === "--monitor") {
  startMonitoring();
} else {
  main()
    .then(() => {
      console.log("\n✅ Arbitrage analysis complete!");
      console.log("💡 Run with --monitor flag for continuous monitoring");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Analysis failed:", error);
      process.exit(1);
    });
}
