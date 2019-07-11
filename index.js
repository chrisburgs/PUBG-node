const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();
const JSON = require('circular-json');
require('dotenv').config()

const axios = require("axios");

const Store = require('data-store');
const store = new Store({ path: 'config.json' });


const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(pino);


// console.log('process-------', process.env.DB_HOST)
app.get('/seasons', async (req, res) => {
  try {
    const response = await axios.get('https://api.pubg.com/shards/steam/seasons',{
      headers: {
        Accept: "application/vnd.api+json",
        Authorization:
          `Bearer ${process.env.apikey}`
      }
    });
    const data = response;
    res.setHeader('Content-Type', 'application/vnd.api+json');
    res.send(JSON.stringify(response.data.data));
  } catch (error) {
    console.log(error);
  }
});



app.get('/player', async (req, res) => {
  try {
    console.log('----------------')
    console.log('player', req.query.playerName)
    console.log('----------------')
    const response = await axios.get(`https://api.pubg.com/shards/steam/players?filter[playerNames]=${req.query.playerName}`,{
      headers: {
        Accept: "application/vnd.api+json",
        Authorization:
        `Bearer ${process.env.apikey}`
      }
    });
    store.set(`playerData-${req.query.playerName}`, JSON.stringify(response.data.data))
    res.setHeader('Content-Type', 'application/vnd.api+json');
    res.send(JSON.stringify(response.data.data));
  } catch (error) {
    console.log(error);
  }
});




app.get('/clear', (req, res) => {
  store.clear();
  res.send(JSON.stringify({ ...store.data }));
});




app.listen(3001, () =>
  console.log('Express server is running on localhost:3001')
);