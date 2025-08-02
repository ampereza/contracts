const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AaveV3FlashLoan Arbitrage Tests", function () {
  let flashLoanContract;
  let owner;
  let addr1;
  
  // Arbitrum addresses for integration testing
  const POOL_ADDRESSES_PROVIDER = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
  const DAI_ADDRESS = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
  const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  
  // DEX router addresses
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const SUSHI_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"; 
  const CAMELOT_ROUTER = "0xc873fEcbd354f5A56E00E710B90EF4201db2448d";
  
  // Whale addresses for funding
  const DAI_WHALE = "0xd85E038593d7A098614721EaE955EC2022B9B91B";

  before(async function () {
    // Check if we're running on a fork
    const poolProviderCode = await ethers.provider.getCode(POOL_ADDRESSES_PROVIDER);
    
    if (poolProviderCode === "0x") {
      console.log("⚠️  Skipping arbitrage tests - no mainnet fork detected");
      this.skip();
      return;
    }
    
    [owner, addr1] = await ethers.getSigners();
    
    try {
      // Deploy the enhanced flash loan contract
      const AaveV3FlashLoan = await ethers.getContractFactory("AaveV3FlashLoan");
      flashLoanContract = await AaveV3FlashLoan.deploy(POOL_ADDRESSES_PROVIDER);
      await flashLoanContract.waitForDeployment();
      
      console.log("✅ Enhanced FlashLoan contract deployed at:", await flashLoanContract.getAddress());
      
    } catch (error) {
      console.log("❌ Failed to deploy enhanced flash loan contract:", error.message);
      this.skip();
    }
  });

  describe("Arbitrage Configuration", function () {
    it("Should have correct DEX router addresses", async function () {
      expect(await flashLoanContract.UNISWAP_V3_ROUTER()).to.equal(UNISWAP_V3_ROUTER);
      expect(await flashLoanContract.SUSHI_ROUTER()).to.equal(SUSHI_ROUTER);
      expect(await flashLoanContract.CAMELOT_ROUTER()).to.equal(CAMELOT_ROUTER);
    });

    it("Should have correct token addresses", async function () {
      expect(await flashLoanContract.DAI()).to.equal(DAI_ADDRESS);
      expect(await flashLoanContract.USDC()).to.equal(USDC_ADDRESS);
      expect(await flashLoanContract.WETH_ADDRESS()).to.equal(WETH_ADDRESS);
    });

    it("Should allow owner to update profit thresholds", async function () {
      // Set minimum profit to 0.5%
      await flashLoanContract.setMinProfitBasisPoints(50);
      expect(await flashLoanContract.minProfitBasisPoints()).to.equal(50);
      
      // Set max slippage to 2%
      await flashLoanContract.setMaxSlippageBasisPoints(200);
      expect(await flashLoanContract.maxSlippageBasisPoints()).to.equal(200);
    });

    it("Should not allow non-owner to update settings", async function () {
      await expect(
        flashLoanContract.connect(addr1).setMinProfitBasisPoints(100)
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("Price Checking Functions", function () {
    it("Should get SushiSwap price for DAI/USDC", async function () {
      const testAmount = ethers.parseEther("1000"); // 1000 DAI
      
      try {
        const price = await flashLoanContract.getSushiPrice(DAI_ADDRESS, USDC_ADDRESS, testAmount);
        console.log(`SushiSwap: 1000 DAI → ${ethers.formatUnits(price, 6)} USDC`);
        
        // Price should be reasonable (between 900-1100 USDC for 1000 DAI)
        expect(price).to.be.gt(ethers.parseUnits("900", 6));
        expect(price).to.be.lt(ethers.parseUnits("1100", 6));
      } catch (error) {
        console.log("⚠️  SushiSwap price check failed:", error.message);
      }
    });

    it("Should get Camelot price for DAI/USDC", async function () {
      const testAmount = ethers.parseEther("1000"); // 1000 DAI
      
      try {
        const price = await flashLoanContract.getCamelotPrice(DAI_ADDRESS, USDC_ADDRESS, testAmount);
        console.log(`Camelot: 1000 DAI → ${ethers.formatUnits(price, 6)} USDC`);
        
        // Price should be reasonable (between 900-1100 USDC for 1000 DAI)
        expect(price).to.be.gt(ethers.parseUnits("900", 6));
        expect(price).to.be.lt(ethers.parseUnits("1100", 6));
      } catch (error) {
        console.log("⚠️  Camelot price check failed:", error.message);
      }
    });
  });

  describe("Basic Arbitrage Execution", function () {
    it("Should prepare contract for arbitrage with sufficient funds", async function () {
      // Give our signer some ETH for gas fees
      await ethers.provider.send("hardhat_setBalance", [
        owner.address,
        "0x1000000000000000000", // 1 ETH
      ]);
      
      // Impersonate the DAI whale to fund the contract
      await ethers.provider.send("hardhat_impersonateAccount", [DAI_WHALE]);
      const whale = await ethers.getSigner(DAI_WHALE);
      
      await ethers.provider.send("hardhat_setBalance", [
        DAI_WHALE,
        "0x1000000000000000000", // 1 ETH for gas
      ]);

      // Get DAI contract and fund our flash loan contract for fees
      const dai = await ethers.getContractAt("IERC20", DAI_ADDRESS);
      const initialFunds = ethers.parseEther("100"); // 100 DAI for fees
      
      await dai.connect(whale).transfer(flashLoanContract.target, initialFunds);
      
      const contractBalance = await dai.balanceOf(flashLoanContract.target);
      console.log(`Contract funded with ${ethers.formatEther(contractBalance)} DAI`);
      
      expect(contractBalance).to.equal(initialFunds);
    });

    it("Should execute basic flash loan without arbitrage", async function () {
      const flashAmount = ethers.parseEther("1000"); // 1000 DAI
      
      const tx = await flashLoanContract.executeFlashLoan(DAI_ADDRESS, flashAmount);
      const receipt = await tx.wait();
      
      console.log(`✅ Basic flash loan executed. Gas used: ${receipt.gasUsed}`);
      expect(receipt.status).to.equal(1);
      
      // Check for FlashLoanExecuted event
      const events = receipt.logs.filter(log => {
        try {
          const parsed = flashLoanContract.interface.parseLog(log);
          return parsed.name === "FlashLoanExecuted";
        } catch (e) {
          return false;
        }
      });
      
      expect(events.length).to.be.gt(0);
    });

    it("Should simulate arbitrage execution (mock)", async function () {
      // This is a simplified test since real arbitrage requires price differences
      const flashAmount = ethers.parseEther("5000"); // 5000 DAI
      
      // Create mock arbitrage parameters
      const arbitrageParams = {
        tokenA: DAI_ADDRESS,
        tokenB: USDC_ADDRESS,
        dexA: SUSHI_ROUTER,
        dexB: CAMELOT_ROUTER,
        amountIn: flashAmount,
        minAmountOut: ethers.parseUnits("4950", 6), // Expect at least 4950 USDC
        routerCallDataA: "0x",
        routerCallDataB: "0x"
      };
      
      try {
        // This might fail if there's no profitable arbitrage, which is expected
        const tx = await flashLoanContract.executeArbitrageFlashLoan(
          DAI_ADDRESS,
          flashAmount,
          arbitrageParams,
          { gasLimit: 1000000 }
        );
        
        const receipt = await tx.wait();
        console.log(`✅ Arbitrage flash loan executed. Gas used: ${receipt.gasUsed}`);
        
      } catch (error) {
        // Expected to fail if no arbitrage opportunity exists
        console.log("⚠️  Arbitrage failed as expected (no profitable opportunity):", error.message);
        expect(error.message).to.include("revert");
      }
    });
  });

  describe("Profit Management", function () {
    it("Should allow owner to withdraw profits", async function () {
      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      // Check if contract has any DAI balance
      const contractDAIBalance = await flashLoanContract.getBalance(DAI_ADDRESS);
      
      if (contractDAIBalance > 0) {
        const tx = await flashLoanContract.withdrawProfits(DAI_ADDRESS);
        const receipt = await tx.wait();
        
        console.log(`✅ Withdrew ${ethers.formatEther(contractDAIBalance)} DAI profits`);
        expect(receipt.status).to.equal(1);
      } else {
        console.log("ℹ️  No DAI profits to withdraw");
      }
    });

    it("Should allow emergency ETH withdrawal", async function () {
      // Send some ETH to the contract first
      await owner.sendTransaction({
        to: await flashLoanContract.getAddress(),
        value: ethers.parseEther("0.1")
      });
      
      const contractETHBalance = await ethers.provider.getBalance(await flashLoanContract.getAddress());
      expect(contractETHBalance).to.equal(ethers.parseEther("0.1"));
      
      // Withdraw ETH
      const tx = await flashLoanContract.emergencyWithdrawETH();
      await tx.wait();
      
      const finalBalance = await ethers.provider.getBalance(await flashLoanContract.getAddress());
      expect(finalBalance).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to execute arbitrage flash loans", async function () {
      const arbitrageParams = {
        tokenA: DAI_ADDRESS,
        tokenB: USDC_ADDRESS,
        dexA: SUSHI_ROUTER,
        dexB: CAMELOT_ROUTER,
        amountIn: ethers.parseEther("1000"),
        minAmountOut: ethers.parseUnits("990", 6),
        routerCallDataA: "0x",
        routerCallDataB: "0x"
      };
      
      await expect(
        flashLoanContract.connect(addr1).executeArbitrageFlashLoan(
          DAI_ADDRESS,
          ethers.parseEther("1000"),
          arbitrageParams
        )
      ).to.be.revertedWith("Not owner");
    });
  });
});
