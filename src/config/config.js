const path = require("path");

require("dotenv").config(path.resolve(__dirname, "../.env"));

const config = {
  server: {
    port: process.env.PORT,
    env: process.env.NODE_ENV,
    apiPrefix: process.env.API_PREFIX,
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRES_IN,
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRES_IN,
  },
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
  },

  logging: {
    level: process.env.LOG_LEVEL,
  },

  essl: {
    timeTrackingUrl: process.env.ESSL_TIME_TRACKING_URL,
    bioServerUrl: process.env.ESSL_BIO_SERVER_URL,
    username: process.env.ESSL_USERNAME,
    password: process.env.ESSL_PASSWORD,
  },
};

module.exports = config;
