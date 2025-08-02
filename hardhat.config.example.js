require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // Uncomment and configure for mainnet forking
      // forking: {
      //   url: "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY", // Replace with your RPC URL
      //   blockNumber: 18500000, // Optional: pin to specific block for consistent testing
      // },
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    // Example mainnet configuration for deployment
    // mainnet: {
    //   url: "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
    //   accounts: [process.env.PRIVATE_KEY] // Never commit private keys!
    // }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
};
