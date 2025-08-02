#!/bin/bash

echo "🚀 Flash Loan Deployment Guide"
echo "================================"
echo ""

echo "📋 Prerequisites Check:"
echo "1. Do you have ETH on Arbitrum? (Check at https://bridge.arbitrum.io/)"
echo "2. Do you have an Arbiscan API key? (Get from https://arbiscan.io/apis)"
echo "3. Have you added your credentials to .env file?"
echo ""

echo "🔧 Setup Steps:"
echo "1. Copy your private key from wallet: cp .env.example .env"
echo "2. Edit .env file: nano .env"
echo "3. Add your PRIVATE_KEY and ARBISCAN_API_KEY"
echo ""

echo "🚀 Deploy Commands:"
echo "# Test first (free):"
echo "npx hardhat test"
echo ""
echo "# Deploy to REAL Arbitrum (costs ETH):"
echo "npx hardhat run scripts/deploy-simple.js --network arbitrum"
echo ""
echo "# Execute flash loan (costs ETH + fees):"
echo "npx hardhat run scripts/execute-flashloan.js --network arbitrum"
echo ""

echo "🔍 Explorer Links (after real deployment):"
echo "Contract: https://arbiscan.io/address/YOUR_CONTRACT_ADDRESS"
echo "Transaction: https://arbiscan.io/tx/YOUR_TX_HASH"
echo ""

echo "⚠️  WARNING: Real deployment costs real money!"
echo "Always test on fork first with: npx hardhat test"
