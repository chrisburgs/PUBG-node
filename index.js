const express = require("express")
const bodyParser = require("body-parser")
const pino = require("express-pino-logger")()
const JSON = require("circular-json")
require("dotenv").config()
//nodemon --ignore config.json
const axios = require("axios")

const Store = require("data-store")
const store = new Store({
	path: "config.json"
})
const tempStore = new Store({
	path: "tempConfig.json"
})

const app = express()
app.use(bodyParser.urlencoded({
	extended: false
}))
app.use(pino)
//2019-12-01T02:38:00Z

//util?
function differenceMinutes(timeA, timeB) {
	return (timeA - timeB) / 60000
}

//util?
function checkExpired(obj, expirationTime) {
	return obj && obj.lastUpdatedAt && differenceMinutes(Date.now(), obj.lastUpdatedAt) < expirationTime
}


app.get("/seasons", async (req, res) => {
	try {
		let seasons = store.get('seasons')
		if (seasons && seasons.lastUpdatedAt && differenceMinutes(Date.now(), seasons.lastUpdatedAt) < 60) {
			console.log('we already had seasons')
			res.setHeader("Content-Type", "application/vnd.api+json")
			res.send(JSON.stringify(seasons.seasons))
		}
		const response = await axios.get(
			"https://api.pubg.com/shards/steam/seasons", {
				headers: {
					Accept: "application/vnd.api+json",
					Authorization: `Bearer ${process.env.apikey}`
				}
			}
		)
		const data = response
		res.setHeader("Content-Type", "application/vnd.api+json")
		res.send(JSON.stringify(response.data.data))
		store.set(`seasons`, {
			lastUpdatedAt: Date.now(),
			seasons: response.data.data
		})
	} catch (error) {
		console.log('seasons error', error)
	}
})



async function individualPlayer(playerName) {
	let player = store.get(`playerData-${playerName}`)
	return checkExpired(player, 5)
	
	const response = await axios.get(`https://api.pubg.com/shards/steam/players?filter[playerNames]=${playerName}`, {
		headers: {
			Accept: "application/vnd.api+json",
			Authorization: `Bearer ${process.env.apikey}`
		}
	})
	let cleanResponse = response.data.data[0]

	store.set(`playerData-${playerName}`, {
		lastlastUpdatedAt: Date.now(),
		accountId: cleanResponse.id,
		...cleanResponse.attributes,
		matches: cleanResponse.relationships.matches.data
	})
}

app.get("/player", async (req, res) => {
	try {
		const { playerName } = req.query
		individualPlayer(playerName)
		res.setHeader("Content-Type", "application/vnd.api+json")
		res.send(store.get(`playerData-${playerName}`))
	} catch (error) {
		console.log('player error', error)
	}
})



app.get("/matches", async (req, res) => {
	try {
		const { rangeStart, rangeEnd, playerName } = req.query
		let storeData = store.get(`playerData-${playerName}`)
		if (differenceMinutes(Date.now(), Date.parse(storeData.createdAt)) > 5) {
			individualPlayer(playerName)
			storeData = store.get(`playerData-${playerName}`)
		}
		let query, matchId, response, matches = []
		let accountId = store.get(`playerData-${playerName}`)
		for (let i = rangeStart; i <= rangeEnd; i++) {
			matchId = storeData.matches[i].id
			query = `https://api.pubg.com/shards/steam/matches/${matchId}`
			response = await axios.get(query, {
				headers: {
					Accept: "application/vnd.api+json"
				}
			})
			matches.push({
				...response.data,
				matchId: matchId
			})
		}
		matches = matches.sort((a, b) => a.data.attributes.createdAt > b.data.attributes.createdAt)
		let matchesReduced = {}
		matches.forEach(match => matchesReduced[match.data.id] = {
			matchId: match.matchId,
			attributes: match.data.attributes,
			stats: match.included.map(players => players.type == "participant" && players)
				.filter(player =>
					player && player.attributes.stats.name == req.query.playerName
			),
			asset: match.included.filter(inc => inc.type == "asset")
		})

		store.set(`playerData-${req.query.playerName}.matchesReduced`, matchesReduced)

		res.setHeader("Content-Type", "application/vnd.api+json");
		res.send(matchesReduced);
	} catch (error) {
		console.log('matches error', error);
	}
});

app.get("/allPlayerStatsFromMatch", async (req, res) => {
	try {
		let storeData = store.get(`playerData-${req.query.playerName}`)
		let dataExists = store.get(req.query.matchId)
		console.log(dataExists && dataExists.data.length)
		if (dataExists && dataExists.data.length) {
			res.send(JSON.stringify(dataExists))
		} else {
			let accountList = await getAccountList(req.query.matchId)
			let data = [],
				accountIdList = []
				splicedList = []
			let response
			let matchesAsArray = Object.keys(accountList).forEach(key => accountIdList.push(key));
			while (accountIdList.length)
				splicedList.push(accountIdList.splice(0, 10).join("%2C"))
			for (query of splicedList) {
				response = await axios.get(`https://api.pubg.com/shards/steam/seasons/${req.query.season}/gameMode/${req.query.gameMode}/players?filter[playerIds]=${query}`, {
					headers: {
						Accept: "application/vnd.api+json",
						Authorization: `Bearer ${process.env.apikey}`
					},
					validateStatus: (status) => {
						return (status >= 200 && status <= 300) || status == 429 // default
					}
				})
				response.status != 429 ? data.push(response.data.data) : null
			}
			data = [].concat(...data)
			data = data.map(data => {
				let playerStats = data.attributes.gameModeStats[req.query.gameMode]
				return (
					players = {
						stats: {
							...playerStats,
							kd: playerStats.kills/playerStats.roundsPlayed || 0
						},
						playerId: data.relationships.player.data.id
				})
			})
			store.set(req.query.matchId, {data, accountList})
			res.setHeader("Content-Type", "application/vnd.api+json")
			res.send({data, accountList})
		}
	} catch (error) {
		console.log('bulk player stats error', error)
	}
})

async function getAccountList(matchId) {
	let splicedList = [];
	query = `https://api.pubg.com/shards/steam/matches/${matchId}`;
	response = await axios.get(query, {
		headers: {
			Accept: "application/vnd.api+json"
		}
	})
	let accountList = response.data.included.filter(inc => inc.type == "participant")
	let playersList = {}
	accountList.forEach(player => 
		playersList[player.attributes.stats.playerId] = player.attributes.stats.name
	)
	return playersList
}

app.get("/clear", (req, res) => {
	store.clear()
	res.send(JSON.stringify({
		...store.data
	}))
})

app.get('/rawTelemetry', async (req, res) => {
	try {
		const { matchId, playerName } = req.query
		let logTypes = require('./logTypes')
		let storeData = store.get(`playerData-${playerName}`)
		let telemetryURL = storeData.matchesReduced[matchId].asset[0].attributes.URL
		let response = await axios.get(telemetryURL, {
			headers: {
				'Accept-Encoding': 'gzip'
			}
		})

		let data = response.data
		
		data = req.query.filterByPlayer ? data.filter(data => data.character && data.character.name == req.query.playerName) : data

		let logTypeQuery
		let dataTypes = {}
		if (req.query.logType && !!req.query.logType.length) {
			for (q in req.query.logType) {
				logTypeQuery = req.query.logType[q]
				dataTypes[logTypeQuery] = data.filter(data => data._T == logTypeQuery)
			}
		} else {
			for (logType in logTypes) {
				dataTypes[logTypes[logType]] = data.filter(data => data._T == logTypes[logType])
			}
		}

		res.send(JSON.stringify(dataTypes))
	} catch (error) {
		console.log("telelemetry error", error)
	}
})
app.listen(3001, () =>
	console.log("Express server is running on localhost:3001")
)