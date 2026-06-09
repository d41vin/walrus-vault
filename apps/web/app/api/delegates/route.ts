import { NextResponse } from "next/server";
import { generateDelegateKey } from "@mysten-incubation/memwal/account";

// GET: fetch delegate keys from the on-chain MemWalAccount object
export async function GET(request: Request) {
  const accountId = request.headers.get("x-memwal-account-id");
  if (!accountId) {
    return NextResponse.json({ error: "Missing x-memwal-account-id header" }, { status: 400 });
  }

  // Sui JSON-RPC fullnode endpoints to query the MemWalAccount object
  const fullnodes = [
    "https://fullnode.mainnet.sui.io",
    "https://fullnode.testnet.sui.io",
  ];

  let delegateKeys: any[] = [];
  let found = false;

  for (const endpoint of fullnodes) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sui_getObject",
          params: [
            accountId,
            {
              showContent: true,
            },
          ],
        }),
      });

      if (!response.ok) continue;
      const json = await response.json();
      if (json.error) continue;

      const fields = json.result?.data?.content?.fields;
      if (fields) {
        found = true;
        const dkList = fields.delegate_keys || [];
        delegateKeys = dkList.map((dk: any) => {
          const pubKeyBytes = dk.fields?.public_key || [];
          // Convert vector<u8> to hex string
          const hex = Buffer.from(pubKeyBytes).toString("hex");
          return {
            publicKey: hex,
            suiAddress: dk.fields?.sui_address,
            label: dk.fields?.label || "Unnamed Delegate",
          };
        });
        break; // Successfully fetched
      }
    } catch (err) {
      console.warn(`Failed to fetch from ${endpoint}:`, err);
    }
  }

  if (!found) {
    return NextResponse.json(
      { error: `Could not find MemWalAccount object on Sui with ID ${accountId}` },
      { status: 404 }
    );
  }

  return NextResponse.json(delegateKeys);
}

// POST: generate a new delegate key pair
export async function POST(request: Request) {
  try {
    const delegate = await generateDelegateKey();
    return NextResponse.json({
      privateKey: delegate.privateKey,
      publicKey: Buffer.from(delegate.publicKey).toString("hex"),
      suiAddress: delegate.suiAddress,
    });
  } catch (err: any) {
    console.error("Error generating delegate key:", err);
    return NextResponse.json({ error: err.message || "Failed to generate key" }, { status: 500 });
  }
}
