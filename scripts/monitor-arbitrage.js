const hre = require("hardhat");

async function main() {
  console.log("📊 Arbitrage Opportunity Monitor for Arbitrum");
  console.log("===========================================");
  
  // Contract address (replace with your deployed contract)
  const FLASH_LOAN_CONTRACT = "YOUR_DEPLOYED_CONTRACT_ADDRESS"; 
  
  // Token addresses
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
    const [sushiPrice, camelotPrice] = await Promise.all([
      flashLoan.getSushiPrice(tokens[pair.tokenA], tokens[pair.tokenB], testAmount),
      flashLoan.getCamelotPrice(tokens[pair.tokenA], tokens[pair.tokenB], testAmount)
    ]);
    
    // Format prices
    const sushiFormatted = parseFloat(hre.ethers.formatUnits(sushiPrice, pair.decimalsB));
    const camelotFormatted = parseFloat(hre.ethers.formatUnits(camelotPrice, pair.decimalsB));
    
    console.log(`SushiSwap:  1000 ${pair.tokenA} → ${sushiFormatted.toFixed(4)} ${pair.tokenB}`);
    console.log(`Camelot:    1000 ${pair.tokenA} → ${camelotFormatted.toFixed(4)} ${pair.tokenB}`);
    
    if (sushiPrice > 0 && camelotPrice > 0) {
      // Calculate arbitrage opportunity
      const priceDiff = Math.abs(sushiFormatted - camelotFormatted);
      const avgPrice = (sushiFormatted + camelotFormatted) / 2;
      const profitPercentage = (priceDiff / avgPrice) * 100;
      
      console.log(`Price Diff: ${priceDiff.toFixed(4)} ${pair.tokenB} (${profitPercentage.toFixed(3)}%)`);
      
      // Determine direction and profitability
      if (profitPercentage > 0.1) { // > 0.1% difference
        const direction = sushiFormatted > camelotFormatted ? 
          "🔄 SushiSwap → Camelot" : "🔄 Camelot → SushiSwap";
        
        if (profitPercentage > 0.5) {
          console.log(`🟢 PROFITABLE: ${direction}`);
          console.log(`💰 Estimated profit: ${profitPercentage.toFixed(3)}%`);
          
          // Calculate potential profit for larger amounts
          const flashLoanSizes = [10000, 50000, 100000];
          console.log("💡 Potential profits for different flash loan sizes:");
          
          for (const size of flashLoanSizes) {
            const grossProfit = (size * profitPercentage) / 100;
            const aaveFee = size * 0.0005; // 0.05% Aave fee
            const netProfit = grossProfit - aaveFee;
            
            if (netProfit > 0) {
              console.log(`   ${size.toLocaleString()} ${pair.tokenA}: ~$${netProfit.toFixed(2)} profit`);
            }
          }
        } else {
          console.log(`🟡 SMALL OPPORTUNITY: ${direction}`);
        }
      } else {
        console.log("🔴 No arbitrage opportunity");
      }
    } else {
      console.log("⚠️  Could not fetch prices from one or both DEXs");
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
