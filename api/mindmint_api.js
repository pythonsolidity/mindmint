const express = require("express");
const { ethers } = require("ethers");
require("dotenv").config();

const app = express();
app.use(express.json());

// Load environment variables
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = "0x40c9f95c6c4a1770a38549ce8c07bb6d7a706897";
const abi = [
  "function mintTokens(uint256 amount, address to) external",
  "function totalSupply() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
];
const contract = new ethers.Contract(contractAddress, abi, wallet);

app.post("/mint", async (req, res) => {
  const { amount, address } = req.body;

  // Input validation
  if (!amount || !ethers.isAddress(address)) {
    return res
      .status(400)
      .send({ success: false, error: "Invalid input parameters" });
  }

  try {
    const amountBN = ethers.getBigInt(amount);

    // Fetch the total supply and max supply in parallel
    const [totalSupply, maxSupply] = await Promise.all([
      contract.totalSupply(),
      contract.MAX_SUPPLY(),
    ]);

    // Ensure minting won't exceed the max supply
    if (totalSupply + amountBN > maxSupply) {
      return res
        .status(400)
        .send({ success: false, error: "Exceeds max supply" });
    }

    // Estimate gas for the transaction
    const gasEstimate = await contract.mintTokens.estimateGas(
      amountBN,
      address
    );

    // Mint the tokens with 20% more gas than the estimate
    const tx = await contract.mintTokens(amountBN, address, {
      gasLimit: (gasEstimate * 120n) / 100n,
    });

    const receipt = await tx.wait();
    res.status(200).send({
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (error) {
    console.error("Minting error:", error);
    if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
      res.status(500).send({
        success: false,
        error: "Failed to estimate gas. The transaction may revert.",
      });
    } else if (error.code === "INSUFFICIENT_FUNDS") {
      res.status(400).send({
        success: false,
        error: "Insufficient funds for gas * price + value",
      });
    } else {
      res.status(500).send({ success: false, error: error.message });
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
