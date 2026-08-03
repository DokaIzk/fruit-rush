import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  TournamentCreated,
  PlayerEntered,
  TournamentFinalized,
  TournamentRefunded,
} from "../../generated/FruitRushTournament/FruitRushTournament";
import {
  Tournament,
  TournamentEntry,
  TournamentPayout,
} from "../../generated/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadTournament(tournamentId: BigInt): Tournament {
  let t = Tournament.load(tournamentId.toString());
  if (t == null) {
    // Defensive: should always exist from TournamentCreated, but guard anyway.
    t = new Tournament(tournamentId.toString());
    t.tournamentId = tournamentId;
    t.entryFee = BigInt.zero();
    t.startTime = BigInt.zero();
    t.endTime = BigInt.zero();
    t.prizeSharesBps = [];
    t.status = "OPEN";
    t.totalPool = BigInt.zero();
    t.totalEntrants = BigInt.zero();
    t.createdAtBlock = BigInt.zero();
    t.createdAtTx = Bytes.empty();
  }
  return t as Tournament;
}

// ─── Event handlers ───────────────────────────────────────────────────────────

export function handleTournamentCreated(event: TournamentCreated): void {
  let t = new Tournament(event.params.tournamentId.toString());

  t.tournamentId = event.params.tournamentId;
  t.entryFee = event.params.entryFee;
  t.startTime = event.params.startTime;
  t.endTime = event.params.endTime;
  t.prizeSharesBps = event.params.prizeSharesBps;
  t.status = "OPEN";
  t.totalPool = BigInt.zero();
  t.totalEntrants = BigInt.zero();
  t.createdAtBlock = event.block.number;
  t.createdAtTx = event.transaction.hash;

  t.save();
}

export function handlePlayerEntered(event: PlayerEntered): void {
  let t = loadTournament(event.params.tournamentId);

  // Track pool and entrant count
  t.totalPool = t.totalPool.plus(t.entryFee);
  t.totalEntrants = event.params.totalEntrants;
  t.save();

  // Immutable entry record — ID is "{tournamentId}-{playerAddress}"
  let entryId =
    event.params.tournamentId.toString() +
    "-" +
    event.params.player.toHexString();
  let entry = new TournamentEntry(entryId);

  entry.tournament = t.id;
  entry.player = event.params.player;
  entry.entrantIndex = event.params.totalEntrants; // contract emits post-push length
  entry.enteredAtBlock = event.block.number;
  entry.enteredAtTimestamp = event.block.timestamp;
  entry.enteredAtTx = event.transaction.hash;

  entry.save();
}

export function handleTournamentFinalized(event: TournamentFinalized): void {
  let t = loadTournament(event.params.tournamentId);
  t.status = "FINALIZED";
  t.rake = event.params.rake;
  t.save();

  let winners = event.params.winners;
  let payouts = event.params.payouts;

  for (let i = 0; i < winners.length; i++) {
    // ID is "{tournamentId}-{rank}"
    let payoutId =
      event.params.tournamentId.toString() + "-" + i.toString();
    let payout = new TournamentPayout(payoutId);

    payout.tournament = t.id;
    payout.rank = i;
    payout.winner = winners[i];
    payout.amount = payouts[i];
    payout.block = event.block.number;
    payout.txHash = event.transaction.hash;

    payout.save();
  }
}

export function handleTournamentRefunded(event: TournamentRefunded): void {
  let t = loadTournament(event.params.tournamentId);
  t.status = "REFUNDED";
  t.save();
}
