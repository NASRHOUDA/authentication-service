const dotenv = require('dotenv');
dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection (non-fatal):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception (non-fatal):', err.message);
});

const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 5001;

sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected');
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Authentication service running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Database error:', err);
    process.exit(1);
  });