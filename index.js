const express = require("express")
const bodyParser = require("body-parser")
const pino = require("express-pino-logger")()
const JSON = require("circular-json")
require("dotenv").config()
//nodemon --ignore config.json
const axios = require("axios")

const Store = require("data-store")
const store = new Store({ path: "config.json" })

const app = express()
app.use(bodyParser.urlencoded({ extended: false }))
app.use(pino)

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
		)
		const data = response
		res.setHeader("Content-Type", "application/vnd.api+json")
		res.send(JSON.stringify(response.data.data))
	} 
	catch (error) {
		console.log(error)
	}
})

app.get("/player", async (req, res) => {
	try {
		if (store.get(`playerData-${req.query.playerName}`) != null) {
			res.send(store.get(`playerData-${req.query.playerName}`))
		} else {
			const response = await axios.get(`https://api.pubg.com/shards/steam/players?filter[playerNames]=${req.query.playerName}`, {
				headers: {
					Accept: "application/vnd.api+json",
					Authorization: `Bearer ${process.env.apikey}`
				}
			})
			let cleanResponse = response.data.data[0]
			let matchIds = cleanResponse
			store.set(`playerData-${req.query.playerName}`, {
				accountId: cleanResponse.id,
				...cleanResponse.attributes,
				matches: cleanResponse.relationships.matches.data
			})
			res.setHeader("Content-Type", "application/vnd.api+json")
			res.send(store.get("playerData-${req.query.playerName}"))
		}
	} catch (error) {
		console.log(error)
	}
})

app.get("/matches", async (req, res) => {
	try {
	let storeData = store.get(`playerData-${req.query.playerName}`)
	let rangeStart = req.query.rangeStart
	let rangeEnd = req.query.rangeEnd
	let query, matchId, response, matches = []
	let accountId = store.get(`playerData-${req.query.playerName}`)
	for (let i = rangeStart; i <= rangeEnd; i++) {
		matchId = storeData.matches[i].id
		query = `https://api.pubg.com/shards/steam/matches/${matchId}`
		response = await axios.get(query, {
			headers: {
				Accept: "application/vnd.api+json"
			}
		})
		matches.push({...response.data, matchId: matchId})
	}
	// console.log('matches', JSON.stringify(matches))
	matchesReduced = matches.map(match => ({
		attributes: match.data.attributes,
		matchId: matchId,
		stats: match.included
		.map(players => players.type == "participant" && players)
		.filter(
			player =>
			player && player.attributes.stats.name == req.query.playerName
		),
		asset: match.included.filter(inc => inc.type == 'asset')
	}))
	store.set(`playerData-${req.query.playerName}`, {
		...storeData,
		matchDataArray: matchesReduced
	})
	res.setHeader("Content-Type", "application/vnd.api+json")
	res.send(matchesReduced)
	} catch (error) {
		console.log(error)
	}
})

app.get('/kd', async (req, res) => {
	try {
		let storeData = store.get(`playerData-${req.query.playerName}`)
		let accountList = await getAccountList(req.query.matchId)
		let playerData = [], data = []
		let response
		for(query of accountList) {
			response = await axios.get(`https://api.pubg.com/shards/steam/seasons/${req.query.season}/gameMode/${req.query.gameMode}/players?filter[playerIds]=${query}`, {
				headers: {
					Accept: "application/vnd.api+json",
					Authorization: `Bearer ${process.env.apikey}`
				},
				validateStatus: function (status) {
					return status >= 200 && status <= 300 || status == 429; // default
				}
			})
			response.status != 429 ? data.push(response.data.data) : null
			
		}
		data = [].concat(...data);
		data = data.map(data => data.attributes.gameModeStats[req.query.gameMode]);

		res.setHeader("Content-Type", "application/vnd.api+json")
		res.send(data)
	} catch (error) {
		console.log(error)
	}
})


async function getAccountList(matchId) {
	let splicedList = []
	query = `https://api.pubg.com/shards/steam/matches/5f4807fa-562c-4a09-854c-b6b9aa473622`
	response = await axios.get(query, {
		headers: {
			Accept: "application/vnd.api+json"
		}
	})
	let accountList = response.data.included.filter(inc => inc.type == 'participant')
	accountList = accountList.map(player => player.attributes.stats.playerId)
	while (accountList.length) {
		splicedList.push(accountList.splice(0,10).join('%2C'))
	}
	return splicedList
}
app.get("/clear", (req, res) => {
	store.clear()
	res.send(JSON.stringify({ ...store.data }))
})


app.get('/telemetryTest', async (req, res) => {
	try {
		let response = axios.get({

		})
	} catch (error) {
		console.log(error)
	}
})
app.listen(3001, () =>
	console.log("Express server is running on localhost:3001")
)
