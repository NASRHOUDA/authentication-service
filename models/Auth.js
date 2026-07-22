const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = function defineAuthModel(sequelize) {
  const Auth = sequelize.define(
    "Auth",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      passwordHash: { type: DataTypes.STRING, allowNull: true },
      provider: { type: DataTypes.ENUM("local", "google"), defaultValue: "local" },
      providerId: { type: DataTypes.STRING, allowNull: true },
    },
    {
      hooks: {
        beforeCreate: async (auth) => {
          if (auth.passwordHash) {
            auth.passwordHash = await bcrypt.hash(auth.passwordHash, 10);
          }
        },
        beforeUpdate: async (auth) => {
          if (auth.changed("passwordHash") && auth.passwordHash) {
            auth.passwordHash = await bcrypt.hash(auth.passwordHash, 10);
          }
        },
      },
    }
  );

  Auth.prototype.validatePassword = async function (password) {
    if (!this.passwordHash) return false;
    return bcrypt.compare(password, this.passwordHash);
  };

  return Auth;
};
