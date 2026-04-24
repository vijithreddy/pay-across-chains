"use client";

/** Radio toggle for sponsored vs self-pay Tempo fees */
export function SponsorToggle({
  sponsored,
  setSponsored,
  relayPassword,
  setRelayPassword,
}: {
  sponsored: boolean;
  setSponsored: (v: boolean) => void;
  relayPassword: string;
  setRelayPassword: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
          Tempo Gas Fee{" "}
          <span className="ml-1.5 px-1.5 py-0.5 rounded-xl text-[8px] bg-[var(--tempo-dim)] text-[var(--tempo-bright)] border border-[var(--tempo-primary)]/30">
            TEMPO EXCLUSIVE
          </span>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setSponsored(false)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            !sponsored
              ? "bg-[var(--bg-raised)] text-white border border-[var(--border-bright)]"
              : "text-[var(--text-dim)] border border-transparent hover:text-[var(--text-secondary)]"
          }`}
        >
          Self-pay
        </button>
        <button
          onClick={() => setSponsored(true)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            sponsored
              ? "bg-[var(--tempo-dim)] text-[var(--tempo-bright)] border border-[var(--tempo-primary)]/30"
              : "text-[var(--text-dim)] border border-transparent hover:text-[var(--text-secondary)]"
          }`}
        >
          Sponsored
        </button>
      </div>
      {sponsored && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-[var(--text-dim)]">
            A relay server co-signs and pays the Tempo gas fee on your behalf.
          </p>
          <input
            type="password"
            value={relayPassword}
            onChange={(e) => setRelayPassword(e.target.value)}
            placeholder="Relay password"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-1.5 text-xs text-[var(--text-primary)] font-mono placeholder:text-[var(--text-dim)] focus:border-[var(--tempo-primary)] focus:outline-none transition-colors"
          />
        </div>
      )}
    </div>
  );
}
