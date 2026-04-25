import { useState } from "react";
import { MALAYSIAN_BANKS } from "../lib/detect";

export default function DemoTransfer() {
  const [bankCode, setBankCode] = useState("MBB");
  const [account, setAccount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center font-bold text-slate-900">
              DB
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">Demo Bank</div>
              <div className="text-[11px] text-slate-500">
                Online banking · sandbox demo
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            Logged in as <span className="font-semibold">Aisyah B.</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Transfer money</h1>
          <p className="text-sm text-slate-600 mt-1">
            Send funds to another bank account in Malaysia.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Recipient bank
              </label>
              <select
                data-semak-watch="bank-code"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                {MALAYSIAN_BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Account number
              </label>
              <input
                data-semak-watch="account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="e.g. 1234567890"
                inputMode="numeric"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Recipient name
              </label>
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="As shown on the recipient's account"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Amount (MYR)
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Reference (optional)
              </label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="What's this for?"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 pt-5 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Daily transfer limit: RM 50,000.00
            </div>
            <button
              data-semak-watch="transfer-btn"
              onClick={() => setSubmitted(true)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 text-sm font-semibold transition"
            >
              Transfer now
            </button>
          </div>

          {submitted && (
            <div className="mt-5 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              <strong>Demo only:</strong> no real transfer was made. This is a
              sandbox page used to demonstrate the Semak browser extension.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl bg-slate-200/60 border border-slate-300 px-4 py-3 text-xs text-slate-600">
          <strong className="font-semibold text-slate-700">Demo notice.</strong>{" "}
          This page imitates a generic Malaysian online banking transfer screen
          for the Semak extension demo. No real bank trademarks are used and no
          money will be moved.
        </div>
      </main>
    </div>
  );
}
