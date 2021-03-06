const functions = require("firebase-functions");

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});

// The Firebase Admin SDK to access Cloud Firestore.
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://hexagonal-diplomacy.firebaseio.com",
});

// Take the text parameter passed to this HTTP endpoint and insert it into
// Cloud Firestore under the path /messages/:documentId/original
exports.readGame = functions.https.onRequest(async (req, response) => {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type");

  // Grab the text parameter.
  const original = req.query.text;
  // Push the new message into Cloud Firestore using the Firebase Admin SDK.

  const db = admin.firestore();
  const gameResult = await db
    .collection("games")
    .doc("HIEy5Zum5nd2btabBJnG")
    .get();

  const game = gameResult.data();
  const playerPromises = await game.players.map(async (player) =>
    (await player.player.get()).data()
  );

  const players = await Promise.all(playerPromises);

  game.players = game.players.map((player, index) => ({
    ...player,
    player: { ...players[index], id: player.player.id },
  }));

  response.json({ data: game });
});
