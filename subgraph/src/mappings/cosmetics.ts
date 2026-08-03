import {
  CosmeticMinted,
  ItemTypeAdded,
  TransferSingle,
  TransferBatch,
} from "../../generated/FruitRushCosmetics/FruitRushCosmetics";
import {
  CosmeticItem,
  CosmeticBalance,
  CosmeticTransfer,
} from "../../generated/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";

// ─── Token ID helpers ─────────────────────────────────────────────────────────
// Schema: [255..248] category (8 bits), [247..240] rarity (8 bits), [239..0] serial
const CATEGORY_SHIFT = 248;
const RARITY_SHIFT = 240;
const RARITY_MASK = BigInt.fromI32(0xff);
const CATEGORY_MASK = BigInt.fromI32(0xff);

function extractCategory(tokenId: BigInt): i32 {
  return tokenId
    .rightShift(u8(CATEGORY_SHIFT))
    .bitAnd(CATEGORY_MASK)
    .toI32();
}

function extractRarity(tokenId: BigInt): i32 {
  return tokenId
    .rightShift(u8(RARITY_SHIFT))
    .bitAnd(RARITY_MASK)
    .toI32();
}

// ─── CosmeticItem helpers ─────────────────────────────────────────────────────

function loadOrCreateItem(tokenId: BigInt): CosmeticItem {
  let id = tokenId.toHexString();
  let item = CosmeticItem.load(id);
  if (item == null) {
    item = new CosmeticItem(id);
    item.tokenId = tokenId;
    item.category = extractCategory(tokenId);
    item.rarity = extractRarity(tokenId);
    item.maxSupply = BigInt.zero();
    item.tokenURI = "";
    item.totalMinted = BigInt.zero();
    item.createdAtBlock = BigInt.zero();
    item.createdAtTx = Bytes.empty();
  }
  return item as CosmeticItem;
}

function loadOrCreateBalance(tokenId: BigInt, owner: Bytes): CosmeticBalance {
  let id = tokenId.toHexString() + "-" + owner.toHexString();
  let bal = CosmeticBalance.load(id);
  if (bal == null) {
    bal = new CosmeticBalance(id);
    bal.item = tokenId.toHexString();
    bal.owner = owner;
    bal.balance = BigInt.zero();
    bal.lastUpdatedBlock = BigInt.zero();
  }
  return bal as CosmeticBalance;
}

// ─── Event handlers ───────────────────────────────────────────────────────────

export function handleItemTypeAdded(event: ItemTypeAdded): void {
  let item = loadOrCreateItem(event.params.tokenId);
  item.maxSupply = event.params.maxSupply;
  item.tokenURI = event.params.tokenURI;
  item.createdAtBlock = event.block.number;
  item.createdAtTx = event.transaction.hash;
  item.save();
}

export function handleCosmeticMinted(event: CosmeticMinted): void {
  // Ensure item exists (addItemType may have been called before indexing started)
  let item = loadOrCreateItem(event.params.tokenId);
  item.totalMinted = item.totalMinted.plus(event.params.amount);
  if (item.createdAtBlock.equals(BigInt.zero())) {
    item.createdAtBlock = event.block.number;
    item.createdAtTx = event.transaction.hash;
  }
  item.save();

  // Update recipient balance
  let bal = loadOrCreateBalance(event.params.tokenId, event.params.to);
  bal.balance = bal.balance.plus(event.params.amount);
  bal.lastUpdatedBlock = event.block.number;
  bal.save();
}

function recordTransfer(
  txHash: Bytes,
  logIndex: BigInt,
  itemIndex: i32,
  tokenId: BigInt,
  operator: Bytes,
  from: Bytes,
  to: Bytes,
  amount: BigInt,
  block: BigInt,
  timestamp: BigInt
): void {
  let id =
    txHash.toHexString() +
    "-" +
    logIndex.toString() +
    "-" +
    itemIndex.toString();

  let transfer = new CosmeticTransfer(id);
  transfer.item = tokenId.toHexString();
  transfer.operator = operator;
  transfer.from = from;
  transfer.to = to;
  transfer.amount = amount;
  transfer.block = block;
  transfer.timestamp = timestamp;
  transfer.txHash = txHash;
  transfer.save();

  // Ensure item exists
  let item = loadOrCreateItem(tokenId);
  if (item.createdAtBlock.equals(BigInt.zero())) {
    item.createdAtBlock = block;
    item.createdAtTx = txHash;
    item.save();
  }

  // Update balances
  let ZERO_ADDRESS = Bytes.fromHexString(
    "0x0000000000000000000000000000000000000000"
  ) as Bytes;

  if (!from.equals(ZERO_ADDRESS)) {
    let fromBal = loadOrCreateBalance(tokenId, from);
    if (fromBal.balance.ge(amount)) {
      fromBal.balance = fromBal.balance.minus(amount);
    } else {
      fromBal.balance = BigInt.zero();
    }
    fromBal.lastUpdatedBlock = block;
    fromBal.save();
  }

  if (!to.equals(ZERO_ADDRESS)) {
    let toBal = loadOrCreateBalance(tokenId, to);
    toBal.balance = toBal.balance.plus(amount);
    toBal.lastUpdatedBlock = block;
    toBal.save();
  }
}

export function handleTransferSingle(event: TransferSingle): void {
  recordTransfer(
    event.transaction.hash,
    event.logIndex,
    0,
    event.params.id,
    event.params.operator,
    event.params.from,
    event.params.to,
    event.params.value,
    event.block.number,
    event.block.timestamp
  );
}

export function handleTransferBatch(event: TransferBatch): void {
  let ids = event.params.ids;
  let values = event.params.values;
  for (let i = 0; i < ids.length; i++) {
    recordTransfer(
      event.transaction.hash,
      event.logIndex,
      i,
      ids[i],
      event.params.operator,
      event.params.from,
      event.params.to,
      values[i],
      event.block.number,
      event.block.timestamp
    );
  }
}
