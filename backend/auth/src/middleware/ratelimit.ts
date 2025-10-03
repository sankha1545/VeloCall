const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "User",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: true },
      provider: { type: DataTypes.STRING(100), allowNull: true },
      providerId: { type: DataTypes.STRING(255), allowNull: true },
      emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    {
      tableName: "users",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );
