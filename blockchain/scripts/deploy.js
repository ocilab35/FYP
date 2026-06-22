const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const admin = deployer.address;
  const registrar = deployer.address;

  console.log("Deploying with account:", deployer.address);

  const Registry = await hre.ethers.getContractFactory("HealthcareVerificationRegistry");
  const registry = await Registry.deploy(admin, registrar);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("HealthcareVerificationRegistry deployed to:", address);

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/HealthcareVerificationRegistry.sol/HealthcareVerificationRegistry.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const backendDir = path.join(__dirname, "../../backend/app/blockchain");
  fs.mkdirSync(backendDir, { recursive: true });

  fs.writeFileSync(
    path.join(backendDir, "contract.json"),
    JSON.stringify(
      {
        contractName: "HealthcareVerificationRegistry",
        address,
        abi: artifact.abi,
        network: hre.network.name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
        deployedAt: new Date().toISOString(),
        registrar,
        admin,
      },
      null,
      2
    )
  );

  console.log("Wrote backend/app/blockchain/contract.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
