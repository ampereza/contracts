const hre = require("hardhat");

async function main() {
  console.log("Executing Flash Loan transaction on Arbitrum...");
  
  // Replace with your deployed contract address
  const FLASH_LOAN_CONTRACT = "YOUR_DEPLOYED_CONTRACT_ADDRESS";
  
  // Arbitrum token addresses
  const DAI_ADDRESS = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
  const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  
  const [signer] = await hre.ethers.getSigners();
  console.log("Executing with account:", signer.address);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  // Get the deployed contract
  const flashLoan = await hre.ethers.getContractAt("AaveV3FlashLoan", FLASH_LOAN_CONTRACT);
  
  // Flash loan amount (1000 DAI)
  const flashLoanAmount = hre.ethers.parseEther("1000");
  
  console.log(`\nExecuting flash loan for ${hre.ethers.formatEther(flashLoanAmount)} DAI...`);
  
  // Execute the flash loan
  const tx = await flashLoan.executeFlashLoan(DAI_ADDRESS, flashLoanAmount, {
    gasLimit: 300000 // Set gas limit to ensure transaction goes through
  });
  
  console.log("\n🚀 Transaction submitted!");
  console.log("Transaction Hash:", tx.hash);
  console.log(`🔍 View on Arbiscan: https://arbiscan.io/tx/${tx.hash}`);
  
  console.log("\nWaiting for confirmation...");
  const receipt = await tx.wait();
  
  console.log("✅ Transaction confirmed!");
  console.log("Block Number:", receipt.blockNumber);
  console.log("Gas Used:", receipt.gasUsed.toString());
  console.log("Gas Price:", hre.ethers.formatUnits(receipt.gasPrice || 0, "gwei"), "gwei");
  
  // Calculate total cost
  const totalCost = receipt.gasUsed * (receipt.gasPrice || 0n);
  console.log("Total Cost:", hre.ethers.formatEther(totalCost), "ETH");
  
  console.log(`\n🔍 Final Explorer Links:`);
  console.log(`Transaction: https://arbiscan.io/tx/${tx.hash}`);
  console.log(`Contract: https://arbiscan.io/address/${FLASH_LOAN_CONTRACT}`);
  console.log(`Block: https://arbiscan.io/block/${receipt.blockNumber}`);
}

main()
  .then(() => {
    console.log("\n✅ Flash loan execution completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Flash loan execution failed:", error);
    process.exit(1);
  });
