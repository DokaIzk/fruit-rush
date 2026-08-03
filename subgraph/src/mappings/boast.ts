import { BoastMinted } from "../../generated/FruitRushBoast/FruitRushBoast";
import { Boast } from "../../generated/schema";

export function handleBoastMinted(event: BoastMinted): void {
  // ID is the boastId decimal string — immutable, never updated
  let id = event.params.boastId.toString();
  let boast = new Boast(id);

  boast.boastId = event.params.boastId;
  boast.player = event.params.player;
  boast.score = event.params.score;
  boast.gameMode = event.params.gameMode;
  boast.timestamp = event.params.timestamp; // contract's block.timestamp
  boast.block = event.block.number;
  boast.txHash = event.transaction.hash;

  boast.save();
}
