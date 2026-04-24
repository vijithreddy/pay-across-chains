"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Card = {
  title: string;
  description: string;
  evmCode: string;
  tempoCode: string;
  evmHighlight: number[];
  tempoHighlight: number[];
};

const cards: Card[] = [
  {
    title: "Balance Check",
    description:
      "eth_getBalance returns a dummy value on Tempo. Always use token.balanceOf() instead.",
    evmCode: `// EVM — check ETH balance
const balance = await provider.getBalance(address);
// Works on Ethereum & Base`,
    tempoCode: `// Tempo — check USDC balance
const balance = await token.read.balanceOf([address]);
// eth_getBalance returns dummy value on Tempo!`,
    evmHighlight: [1],
    tempoHighlight: [1],
  },
  {
    title: "Transfer with Memo",
    description:
      "TIP-20 has a native memo field. No need to encode data in the transfer call.",
    evmCode: `// EVM — ERC-20 transfer (no memo)
await token.write.transfer([to, amount]);
// Memo requires separate event or custom contract`,
    tempoCode: `// Tempo — TIP-20 transfer with memo
const memo = toHex("INV-1042", { size: 32 });
await token.write.transferWithMemo([to, amount, memo]);
// Memo is indexed & queryable natively`,
    evmHighlight: [1],
    tempoHighlight: [1, 2],
  },
  {
    title: "Fee Token",
    description:
      "Tempo fees are paid in the stablecoin itself — no ETH needed for gas.",
    evmCode: `// EVM — need ETH for gas
// User must hold ETH + USDC
const ethBalance = await provider.getBalance(addr);
if (ethBalance < gasEstimate) throw "Need ETH for gas";`,
    tempoCode: `// Tempo — fees paid in USDC
// User only needs USDC
const usdcBalance = await token.read.balanceOf([addr]);
// Fee deducted from USDC automatically`,
    evmHighlight: [1, 3],
    tempoHighlight: [1, 3],
  },
  {
    title: "Gas Estimation",
    description:
      "New storage slots cost 250,000 gas on Tempo vs 20,000 on Ethereum. Always estimate.",
    evmCode: `// EVM — new storage slot: 20,000 gas
const gas = 21000 + 20000; // common hardcode
await token.write.transfer([to, amt], { gas });`,
    tempoCode: `// Tempo — new storage slot: 250,000 gas
// NEVER hardcode — always estimate
const gas = await publicClient.estimateContractGas({
  address: token, functionName: "transfer",
  args: [to, amt],
});`,
    evmHighlight: [1],
    tempoHighlight: [0, 1, 2],
  },
  {
    title: "Finality",
    description:
      "Tempo has deterministic ~500ms BFT finality. No re-org risk, no waiting for confirmations.",
    evmCode: `// EVM — probabilistic finality
const receipt = await tx.wait(12); // 12 blocks
// Still not truly final — re-orgs possible
// Ethereum: ~12 min, Base: 7-day window`,
    tempoCode: `// Tempo — deterministic finality
const receipt = await publicClient
  .waitForTransactionReceipt({ hash });
// Done. ~500ms. No re-org risk.`,
    evmHighlight: [1, 2],
    tempoHighlight: [2, 3],
  },
  {
    title: "CALLVALUE Removal",
    description:
      "CALLVALUE always returns 0 on Tempo. Remove all payable patterns and msg.value checks.",
    evmCode: `// EVM — payable pattern
function deposit() payable {
  require(msg.value > 0, "Send ETH");
  balances[msg.sender] += msg.value;
}`,
    tempoCode: `// Tempo — no payable, use token transfer
function deposit(uint256 amount) {
  token.transferFrom(msg.sender, address(this), amount);
  balances[msg.sender] += amount;
}`,
    evmHighlight: [1, 2, 3],
    tempoHighlight: [1, 2],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-700/50 hover:bg-zinc-600/50 transition-colors"
      aria-label="Copy code"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" />
      ) : (
        <Copy className="size-3.5 text-zinc-400" />
      )}
    </button>
  );
}

function CodeBlock({
  code,
  highlights,
  side,
}: {
  code: string;
  highlights: number[];
  side: "evm" | "tempo";
}) {
  const lines = code.split("\n");
  const borderColor = side === "evm" ? "border-zinc-700" : "border-purple-700/50";
  const label = side === "evm" ? "EVM" : "Tempo";
  const labelColor = side === "evm" ? "text-zinc-500" : "text-purple-400";

  return (
    <div className={`relative rounded-lg border ${borderColor} bg-zinc-900 overflow-hidden`}>
      <div className={`px-3 py-1.5 border-b ${borderColor} flex items-center justify-between`}>
        <span className={`text-xs font-medium ${labelColor}`}>{label}</span>
      </div>
      <div className="relative">
        <CopyButton text={code} />
        <pre className="p-3 text-xs leading-relaxed overflow-x-auto">
          {lines.map((line, i) => (
            <div
              key={i}
              className={
                highlights.includes(i)
                  ? side === "tempo"
                    ? "bg-purple-500/15 -mx-3 px-3"
                    : "bg-zinc-700/30 -mx-3 px-3"
                  : ""
              }
            >
              <code className="text-zinc-300">{line}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export function MigrationCards() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-zinc-100">
          EVM → Tempo Migration Patterns
        </h2>
        <p className="text-sm text-zinc-400 mt-2">
          6 patterns every EVM developer needs to know
        </p>
      </div>
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">
                {i + 1}
              </span>
              <h3 className="text-sm font-semibold text-zinc-100">
                {card.title}
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-1 ml-8">
              {card.description}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">
            <div className="p-3 md:border-r border-zinc-800">
              <CodeBlock
                code={card.evmCode}
                highlights={card.evmHighlight}
                side="evm"
              />
            </div>
            <div className="p-3">
              <CodeBlock
                code={card.tempoCode}
                highlights={card.tempoHighlight}
                side="tempo"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
