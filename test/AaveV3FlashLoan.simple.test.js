const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AaveV3FlashLoan", function () {
  let flashLoanContract;
  let owner;
  let addr1;
  let mockPool;
  let mockAddressesProvider;
  let mockToken;
  
  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    // Deploy mock pool first
    const MockPool = await ethers.getContractFactory("MockPool");
    mockPool = await MockPool.deploy();
    await mockPool.waitForDeployment();
    
    // Deploy mock addresses provider with pool address
    const MockAddressesProvider = await ethers.getContractFactory("MockAddressesProvider");
    mockAddressesProvider = await MockAddressesProvider.deploy(await mockPool.getAddress());
    await mockAddressesProvider.waitForDeployment();
    
    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MOCK");
    await mockToken.waitForDeployment();
    
    // Deploy flash loan contract
    const AaveV3FlashLoan = await ethers.getContractFactory("AaveV3FlashLoan");
    flashLoanContract = await AaveV3FlashLoan.deploy(await mockAddressesProvider.getAddress());
    await flashLoanContract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await flashLoanContract.owner()).to.equal(owner.address);
    });

    it("Should set the correct addresses provider", async function () {
      expect(await flashLoanContract.ADDRESSES_PROVIDER()).to.equal(await mockAddressesProvider.getAddress());
    });

    it("Should set the correct pool address", async function () {
      expect(await flashLoanContract.POOL()).to.equal(await mockPool.getAddress());
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to execute flash loan", async function () {
      await expect(
        flashLoanContract.connect(addr1).executeFlashLoan(await mockToken.getAddress(), ethers.parseEther("1000"))
      ).to.be.revertedWith("Not owner");
    });

    it("Should only allow owner to emergency withdraw", async function () {
      await expect(
        flashLoanContract.connect(addr1).emergencyWithdraw(await mockToken.getAddress(), ethers.parseEther("100"))
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("Utility Functions", function () {
    it("Should return correct balance for mock token", async function () {
      const balance = await flashLoanContract.getBalance(await mockToken.getAddress());
      expect(balance).to.equal(0); // Should be 0 initially
    });

    it("Should be able to receive ETH", async function () {
      const amount = ethers.parseEther("1");
      
      const tx = await owner.sendTransaction({
        to: await flashLoanContract.getAddress(),
        value: amount
      });
      
      await tx.wait();
      
      const contractBalance = await ethers.provider.getBalance(await flashLoanContract.getAddress());
      expect(contractBalance).to.equal(amount);
    });

    it("Should allow emergency withdraw of tokens", async function () {
      // Mint some tokens to the contract
      await mockToken.mint(await flashLoanContract.getAddress(), ethers.parseEther("100"));
      
      const initialBalance = await mockToken.balanceOf(owner.address);
      const contractBalance = await mockToken.balanceOf(await flashLoanContract.getAddress());
      
      expect(contractBalance).to.equal(ethers.parseEther("100"));
      
      // Emergency withdraw
      await flashLoanContract.emergencyWithdraw(await mockToken.getAddress(), ethers.parseEther("50"));
      
      const finalBalance = await mockToken.balanceOf(owner.address);
      const finalContractBalance = await mockToken.balanceOf(await flashLoanContract.getAddress());
      
      expect(finalBalance).to.equal(initialBalance + ethers.parseEther("50"));
      expect(finalContractBalance).to.equal(ethers.parseEther("50"));
    });
  });

  describe("Flash Loan Execution", function () {
    it("Should execute flash loan call", async function () {
      // This will call the mock pool which doesn't do anything
      // In a real test with forking, this would actually execute the flash loan
      const tx = await flashLoanContract.executeFlashLoan(await mockToken.getAddress(), ethers.parseEther("1000"));
      const receipt = await tx.wait();
      
      expect(receipt.status).to.equal(1);
    });
  });

  describe("Error Handling", function () {
    it("Should revert if executeOperation is called by unauthorized address", async function () {
      await expect(
        flashLoanContract.executeOperation(
          [await mockToken.getAddress()],
          [ethers.parseEther("1000")],
          [ethers.parseEther("1")],
          owner.address,
          "0x"
        )
      ).to.be.revertedWith("Untrusted lender");
    });
  });
});
