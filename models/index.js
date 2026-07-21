const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "postgres",
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    retry: { max: 5, match: [/ConnectionError/, /ConnectionRefusedError/, /ConnectionTimedOutError/, /TimeoutError/] },
  }
);

const Auth = require("./Auth")(sequelize);

module.exports = { sequelize, Auth };
