const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();
const JSON = require('circular-json');

const axios = require("axios");

const Store = require('data-store');
const store = new Store({ path: 'config.json' });


const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(pino);



app.get('/seasons', async (req, res) => {
  try {
    const response = await axios.get('https://api.pubg.com/shards/steam/seasons',{
      headers: {
        Accept: "application/vnd.api+json",
        Authorization:
      }
    });
    const data = response;
    res.setHeader('Content-Type', 'application/vnd.api+json');
    res.send(JSON.stringify(response.data.data));
  } catch (error) {
    console.log(error);
  }
});



app.get('/seasons', async (req, res) => {
  try {
    const response = await axios.get('https://api.pubg.com/shards/steam/seasons',{
      headers: {
        Accept: "application/vnd.api+json",
        Authorization:
      }
    });
    const data = response;
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