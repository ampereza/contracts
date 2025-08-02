// Simple deployment script that shows transaction details for explorer viewing
const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying AaveV3FlashLoan contract...");
  console.log("Network:", hre.network.name);
  
  // Arbitrum Aave V3 Pool Addresses Provider
  const POOL_ADDRESSES_PROVIDER = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  // Deploy the contract
  const AaveV3FlashLoan = await hre.ethers.getContractFactory("AaveV3FlashLoan");
  console.log("Deploying contract...");
  
  const flashLoan = await AaveV3FlashLoan.deploy(POOL_ADDRESSES_PROVIDER);
  console.log("Transaction submitted!");
  console.log("Transaction Hash:", flashLoan.deploymentTransaction().hash);
  
  // Wait for deployment
  await flashLoan.waitForDeployment();
  const contractAddress = await flashLoan.getAddress();
  
  console.log("\n✅ Deployment Complete!");
  console.log("Contract Address:", contractAddress);
  console.log("Transaction Hash:", flashLoan.deploymentTransaction().hash);
  
  // Show explorer links based on network
  if (hre.network.name === "arbitrum") {
    console.log("\n🔍 View on Arbitrum Explorer:");
    console.log(`Contract: https://arbiscan.io/address/${contractAddress}`);
    console.log(`Transaction: https://arbiscan.io/tx/${flashLoan.deploymentTransaction().hash}`);
  } else if (hre.network.name === "hardhat") {
    console.log("\n📝 Local Fork Deployment - Explorer simulation:");
    console.log(`If this was mainnet, you would see at:`);
    console.log(`Contract: https://arbiscan.io/address/${contractAddress}`);
    console.log(`Transaction: https://arbiscan.io/tx/${flashLoan.deploymentTransaction().hash}`);
  }
  
  return contractAddress;
}

// Run the deployment
main()
  .then((contractAddress) => {
    console.log("\n🎉 Deployment successful!");
    console.log("Contract deployed at:", contractAddress);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
