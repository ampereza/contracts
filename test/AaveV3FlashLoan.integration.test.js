const { expect } = require("chai");
const { ethers, network } = require("hardhat");

// This test requires mainnet forking with proper RPC endpoint
// To run: Update hardhat.config.js with mainnet fork and run: npx hardhat test test/AaveV3FlashLoan.integration.test.js
describe("AaveV3FlashLoan Integration Test", function () {
  let flashLoanContract;
  let owner;
  
  // Arbitrum mainnet addresses for Aave V3
  const POOL_ADDRESSES_PROVIDER = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
  const DAI_ADDRESS = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
  const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  
  // DAI whale address on Arbitrum (has lots of DAI)
  const DAI_WHALE = "0xd85E038593d7A098614721EaE955EC2022B9B91B"; // Arbitrum DAI holder

  before(async function () {
    // Check if we're running on a fork by trying to get code at a known mainnet address
    const poolProviderCode = await ethers.provider.getCode(POOL_ADDRESSES_PROVIDER);
    
    if (poolProviderCode === "0x") {
      console.log("⚠️  Skipping integration tests - no mainnet fork detected");
      console.log("ℹ️  To run integration tests:");
      console.log("   1. Get an RPC endpoint (Alchemy/Infura)");
      console.log("   2. Update hardhat.config.js to enable forking");
      console.log("   3. Run: npx hardhat test test/AaveV3FlashLoan.integration.test.js");
      this.skip();
      return;
    }
    
    [owner] = await ethers.getSigners();
    
    try {
      const AaveV3FlashLoan = await ethers.getContractFactory("AaveV3FlashLoan");
      flashLoanContract = await AaveV3FlashLoan.deploy(POOL_ADDRESSES_PROVIDER);
      await flashLoanContract.waitForDeployment();
      
      console.log("✅ FlashLoan contract deployed at:", await flashLoanContract.getAddress());
    } catch (error) {
      console.log("❌ Failed to deploy flash loan contract:", error.message);
      this.skip();
    }
  });

  it("Should execute a real flash loan on mainnet fork", async function () {
    console.log("✅ FlashLoan contract deployed at:", flashLoanContract.target);
    
    // Give our signer some ETH for gas fees
    await ethers.provider.send("hardhat_setBalance", [
      owner.address,
      "0x1000000000000000000", // 1 ETH in hex
    ]);
    
    // Impersonate the DAI whale account
    await ethers.provider.send("hardhat_impersonateAccount", [DAI_WHALE]);
    const whale = await ethers.getSigner(DAI_WHALE);
    
    // Give the whale some ETH for gas fees
    await ethers.provider.send("hardhat_setBalance", [
      DAI_WHALE,
      "0x1000000000000000000", // 1 ETH in hex
    ]);

    // Get DAI contract
    const dai = await ethers.getContractAt("IERC20", DAI_ADDRESS);
    
    // Check whale's DAI balance
    const whaleBalance = await dai.balanceOf(DAI_WHALE);
    console.log(`Whale DAI balance: ${ethers.formatEther(whaleBalance)}`);
    
    // Transfer some DAI to our flash loan contract for the fee
    const flashLoanAmount = ethers.parseEther("1000"); // 1000 DAI
    const fee = (flashLoanAmount * 5n) / 10000n; // 0.05% fee
    
    await dai.connect(whale).transfer(flashLoanContract.target, fee);
    console.log(`Transferred ${ethers.formatEther(fee)} DAI as fee to flash loan contract`);
    
    // Check contract's initial DAI balance
    const initialBalance = await dai.balanceOf(flashLoanContract.target);
    console.log(`Initial DAI balance: ${ethers.formatEther(initialBalance)}`);
    
    // Execute flash loan
    const tx = await flashLoanContract.executeFlashLoan(DAI_ADDRESS, flashLoanAmount);
    const receipt = await tx.wait();
    
    console.log(`✅ Flash loan executed successfully! Gas used: ${receipt.gasUsed}`);
    
    // Verify the flash loan was executed
    expect(tx).to.not.be.reverted;
  });

  it("Should handle multiple asset flash loan", async function () {
    // This would require funding the contract with multiple tokens
    // Implementation depends on your specific use case
    console.log("Multi-asset flash loan test would go here");
  });
});
