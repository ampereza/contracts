require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-network-helpers");
require("@nomicfoundation/hardhat-verify");
require('dotenv').config();

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
      forking: {
        url: "https://arbitrum-mainnet.infura.io/v3/1616139d333940faad526809f318e8cc",
        blockNumber: 268000000, // Recent Arbitrum block for consistent testing
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    arbitrum: {
      url: "https://arbitrum-mainnet.infura.io/v3/1616139d333940faad526809f318e8cc",
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64 ? 
        [process.env.PRIVATE_KEY] : 
        [], // Only include if valid private key exists
    },
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || "YourArbiscanApiKey", // API key from .env
    },
    customChains: [
      {
        network: "arbitrumOne",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
};
