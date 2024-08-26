const express = require("express");
const { ethers } = require("ethers");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config();

const app = express();
app.use(express.json());

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Mindmint API",
    version: "1.0.0",
    description:
      "API for minting ERC20 tokens using a Solidity smart contract on Sepolia testnet.",
  },
  servers: [
    {
      url: "https://mindmint.onrender.com",
      description: "Production server",
    },
  ],
};

// Options for the swagger docs
const options = {
  swaggerDefinition,
  apis: ["./mindmint_api.js"], // Path to the API docs
};

// Initialize swagger-jsdoc -> returns validated swagger spec in json format
const swaggerSpec = swaggerJsdoc(options);

// Use swagger-ui-express for your app documentation endpoint
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const provider = new ethers.providers.JsonRpcProvider(
  process.env.SEPOLIA_RPC_URL
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = "0x40c9f95c6c4a1770a38549ce8c07bb6d7a706897";
const abi = [
  "function mintTokens(uint256 amount, address to) external",
  "function totalSupply() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
];
const contract = new ethers.Contract(contractAddress, abi, wallet);

/**
 * @swagger
 * /mint:
 *   post:
 *     summary: Mint ERC20 tokens
 *     description: Mint a specified number of ERC20 tokens to a given address.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: integer
 *                 example: 1000
 *                 description: The number of tokens to mint.
 *               address:
 *                 type: string
 *                 example: "0xYourWalletAddress"
 *                 description: The Ethereum address to receive the tokens.
 *     responses:
 *       200:
 *         description: Tokens were minted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 txHash:
 *                   type: string
 *                   example: "0xTransactionHash"
 *       400:
 *         description: Bad Request - Invalid parameters or exceeding max supply.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Error message"
 *       500:
 *         description: Internal Server Error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Error message"
 */
app.post("/mint", async (req, res) => {
  const { amount, address } = req.body;

  try {
    const totalSupply = await contract.totalSupply();
    const maxSupply = await contract.MAX_SUPPLY();

    if (totalSupply.add(amount) > maxSupply) {
      return res
        .status(400)
        .send({ success: false, error: "Exceeds max supply" });
    }

    const tx = await contract.mintTokens(amount, address);
    await tx.wait();

    res.status(200).send({ success: true, txHash: tx.hash });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(
    `API documentation available at http://localhost:${port}/api-docs`
  );
});
