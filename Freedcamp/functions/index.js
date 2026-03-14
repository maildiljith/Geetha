const functions = require('firebase-functions');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors')({ origin: true });

const API_KEY    = 'e73ea921952c4777e10be30ec793968f4b61fc08';
const API_SECRET = '0dac4c7f5ea5018bdfbfcc4678b3b83b16166dee';
const BASE_URL   = 'https://freedcamp.com/api';

exports.apiProxy = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Remove /api from the path if it exists (Hosting rewrites it)
      const apiPath = req.path.replace(/^\/api/, '');
      
      // Calculate Auth Params
      const timestamp = Math.floor(Date.now() / 1000);
      const hash = crypto
        .createHmac('sha1', API_SECRET)
        .update(API_KEY + timestamp)
        .digest('hex');

      // Forward request to Freedcamp
      const response = await axios({
        method: req.method,
        url: `${BASE_URL}${apiPath}`,
        params: {
          ...req.query,
          api_key: API_KEY,
          timestamp,
          hash
        }
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      console.error('Proxy Error:', error.message);
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });
});
