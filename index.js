const express = require("express");
const bodyParser = require("body-parser");
const pino = require("express-pino-logger")();
const JSON = require("circular-json");
require("dotenv").config();
//nodemon --ignore config.json
const axios = require("axios");

const Store = require("data-store");
const store = new Store({ path: "config.json" });

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(pino);

app.get("/seasons", async (req, res) => {
	try {
	const response = await axios.get(
		"https://api.pubg.com/shards/steam/seasons",
		{
		headers: {
			Accept: "application/vnd.api+json",
			Authorization: `Bearer ${process.env.apikey}`
		}
		}
	);
	const data = response;
	res.setHeader("Content-Type", "application/vnd.api+json");
	res.send(JSON.stringify(response.data.data));
	} catch (error) {
	x;
	console.log(error);
	}
});

app.get("/player", async (req, res) => {
	try {
	if (store.get(`playerData-${req.query.playerName}`) != null) {
		res.send(store.get(`playerData-${req.query.playerName}`));
	} else {
		const response = await axios.get(
		`https://api.pubg.com/shards/steam/players?filter[playerNames]=${
			req.query.playerName
		}`,
		{
			headers: {
			Accept: "application/vnd.api+json",
			Authorization: `Bearer ${process.env.apikey}`
			}
		}
		);
		let cleanResponse = response.data.data[0];
		let matchIds = cleanResponse;
		store.set(`playerData-${req.query.playerName}`, {
		accountId: cleanResponse.id,
		...cleanResponse.attributes,
		matches: cleanResponse.relationships.matches.data
		});
		res.setHeader("Content-Type", "application/vnd.api+json");
		res.send(store.get("playerData-${req.query.playerName}"));
	}
	} catch (error) {
	console.log(error);
	}
});

app.get("/matches", async (req, res) => {
	try {
	let storeData = store.get(`playerData-${req.query.playerName}`);
	let rangeStart = req.query.rangeStart;
	let rangeEnd = req.query.rangeEnd;
	let query, matchId, response, matches = [];
	let accountId = store.get(`playerData-${req.query.playerName}`);
	for (let i = rangeStart; i <= rangeEnd; i++) {
		matchId = storeData.matches[i].id;
		query = `https://api.pubg.com/shards/steam/matches/${matchId}`;
		response = await axios.get(query, {
		headers: {
			Accept: "application/vnd.api+json"
		}
		});
		matches.push({...response.data, matchId: matchId});
	}
	matchesReduced = matches.map(match => ({
		attributes: match.data.attributes,
		matchId: matchId,
		stats: match.included
		.map(players => players.type == "participant" && players)
		.filter(
			player =>
			player && player.attributes.stats.name == req.query.playerName
		)
	}));
	store.set(`playerData-${req.query.playerName}`, {
		...storeData,
		matchDataArray: matchesReduced
	});
	res.setHeader("Content-Type", "application/vnd.api+json");
	res.send(matchesReduced);
	} catch (error) {
	console.log(error);
	}
});

app.get("/clear", (req, res) => {
	store.clear();
	res.send(JSON.stringify({ ...store.data }));
});

app.listen(3001, () =>
	console.log("Express server is running on localhost:3001")
);
