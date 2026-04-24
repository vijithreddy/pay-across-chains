"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { MigrationCard } from "@/types";

const cards: MigrationCard[] = [
  {
    title: "Balance Check",
    description: "eth_getBalance returns a dummy value on Tempo. Always use token.balanceOf() instead.",
    evmCode: `// EVM — check ETH balance\nconst balance = await provider.getBalance(address);\n// Works on Ethereum & Base`,
    tempoCode: `// Tempo — check USDC balance\nconst balance = await token.read.balanceOf([address]);\n// eth_getBalance returns dummy value on Tempo!`,
    evmHighlight: [1],
    tempoHighlight: [1],
  },
  {
    title: "Transfer with Memo",
    description: "TIP-20 has a native memo field. No need to encode data in the transfer call.",
    evmCode: `// EVM — ERC-20 transfer (no memo)\nawait token.write.transfer([to, amount]);\n// Memo requires separate event or custom contract`,
    tempoCode: `// Tempo — TIP-20 transfer with memo\nconst memo = toHex("INV-1042", { size: 32 });\nawait token.write.transferWithMemo([to, amount, memo]);\n// Memo is indexed & queryable natively`,
    evmHighlight: [1],
    tempoHighlight: [1, 2],
  },
  {
    title: "Fee Token",
    description: "Tempo fees are paid in the stablecoin itself — no ETH needed for gas.",
    evmCode: `// EVM — need ETH for gas\n// User must hold ETH + USDC\nconst ethBalance = await provider.getBalance(addr);\nif (ethBalance < gasEstimate) throw "Need ETH for gas";`,
    tempoCode: `// Tempo — fees paid in USDC\n// User only needs USDC\nconst usdcBalance = await token.read.balanceOf([addr]);\n// Fee deducted from USDC automatically`,
    evmHighlight: [1, 3],
    tempoHighlight: [1, 3],
  },
  {
    title: "Gas Estimation",
    description: "New storage slots cost 250,000 gas on Tempo vs 20,000 on Ethereum. Always estimate.",
    evmCode: `// EVM — new storage slot: 20,000 gas\nconst gas = 21000 + 20000; // common hardcode\nawait token.write.transfer([to, amt], { gas });`,
    tempoCode: `// Tempo — new storage slot: 250,000 gas\n// NEVER hardcode — always estimate\nconst gas = await publicClient.estimateContractGas({\n  address: token, functionName: "transfer",\n  args: [to, amt],\n});`,
    evmHighlight: [1],
    tempoHighlight: [0, 1, 2],
  },
  {
    title: "Finality",
    description: "Tempo has deterministic ~500ms BFT finality. No re-org risk, no waiting for confirmations.",
    evmCode: `// EVM — probabilistic finality\nconst receipt = await tx.wait(12); // 12 blocks\n// Still not truly final — re-orgs possible\n// Ethereum: ~12 min, Base: 7-day window`,
    tempoCode: `// Tempo — deterministic finality\nconst receipt = await publicClient\n  .waitForTransactionReceipt({ hash });\n// Done. ~500ms. No re-org risk.`,
    evmHighlight: [1, 2],
    tempoHighlight: [2, 3],
  },
  {
    title: "CALLVALUE Removal",
    description: "CALLVALUE always returns 0 on Tempo. Remove all payable patterns and msg.value checks.",
    evmCode: `// EVM — payable pattern\nfunction deposit() payable {\n  require(msg.value > 0, "Send ETH");\n  balances[msg.sender] += msg.value;\n}`,
    tempoCode: `// Tempo — no payable, use token transfer\nfunction deposit(uint256 amount) {\n  token.transferFrom(msg.sender, address(this), amount);\n  balances[msg.sender] += amount;\n}`,
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
      className="absolute top-2 right-2 p-1.5 rounded-sm border border-[var(--border)] bg-[var(--bg-raised)] hover:border-[var(--border-bright)] transition-colors"
      aria-label="Copy code"
    >
      {copied ? (
        <Check className="size-3 text-[var(--success)]" />
      ) : (
        <Copy className="size-3 text-[var(--text-dim)]" />
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
  const borderColor = side === "evm" ? "#EF444420" : "#10B98120";
  const label = side === "evm" ? "EVM" : "TEMPO";
  const labelColor = side === "evm" ? "var(--destructive)" : "var(--success)";
  const highlightBg = side === "evm" ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)";

  return (
    <div
      className="relative rounded-sm border bg-[var(--bg-base)] overflow-hidden"
      style={{ borderColor }}
    >
      <div
        className="px-3 py-1.5 border-b flex items-center"
        style={{ borderColor }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: labelColor }}>
          {label}
        </span>
      </div>
      <div className="relative">
        <CopyButton text={code} />
        <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto" style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>
          {lines.map((line, i) => {
            const isHL = highlights.includes(i);
            const barColor = side === "evm" ? "#EF4444" : "#10B981";
            return (
              <div
                key={i}
                className="-mx-3 px-3"
                style={isHL ? {
                  backgroundColor: highlightBg,
                  borderLeft: `3px solid ${barColor}`,
                  paddingLeft: "9px",
                } : undefined}
              >
                <code className="text-[var(--text-secondary)]">{line}</code>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

export function MigrationCards() {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="font-mono text-lg uppercase tracking-[0.15em] text-[var(--text-primary)]">
          EVM to Tempo Migration
        </h2>
        <p className="text-xs text-[var(--text-dim)] mt-2 font-mono">
          6 patterns every EVM developer needs to know
        </p>
      </div>
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-sm bg-[var(--tempo-dim)] font-mono text-[10px] font-bold text-[var(--tempo-bright)]">
                {i + 1}
              </span>
              <h3 className="font-mono text-sm font-medium text-[var(--text-primary)] uppercase tracking-wider">
                {card.title}
              </h3>
            </div>
            <p className="text-[11px] text-[var(--text-dim)] mt-1.5 ml-7 italic">
              {card.description}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-3 md:border-r border-[var(--border)]">
              <CodeBlock code={card.evmCode} highlights={card.evmHighlight} side="evm" />
            </div>
            <div className="p-3">
              <CodeBlock code={card.tempoCode} highlights={card.tempoHighlight} side="tempo" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
