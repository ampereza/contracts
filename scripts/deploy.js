const hre = require("hardhat");

async function main() {
  console.log("Deploying AaveV3FlashLoan contract...");

  // Arbitrum Aave V3 Pool Addresses Provider
  const POOL_ADDRESSES_PROVIDER = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  const AaveV3FlashLoan = await hre.ethers.getContractFactory("AaveV3FlashLoan");
  const flashLoan = await AaveV3FlashLoan.deploy(POOL_ADDRESSES_PROVIDER);

  await flashLoan.waitForDeployment();

  const contractAddress = await flashLoan.getAddress();
  console.log("AaveV3FlashLoan deployed to:", contractAddress);
  console.log("Pool Addresses Provider:", await flashLoan.ADDRESSES_PROVIDER());
  console.log("Pool Address:", await flashLoan.POOL());
  
  // Log explorer URLs
  console.log("\n🔍 View on Arbitrum Explorer:");
  console.log(`https://arbiscan.io/address/${contractAddress}`);
  
  // If deploying to mainnet, show transaction hash for explorer
  if (hre.network.name === "arbitrum") {
    const deployTx = flashLoan.deploymentTransaction();
    console.log(`https://arbiscan.io/tx/${deployTx.hash}`);
    
    // Wait for confirmations before verification
    console.log("\nWaiting for block confirmations...");
    await deployTx.wait(5);
    
    // Verify the contract on Arbiscan
    console.log("\nVerifying contract on Arbiscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [POOL_ADDRESSES_PROVIDER],
      });
      console.log("✅ Contract verified successfully!");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
