"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.createTable("UserSessions", {
        sessionId: {
          type: Sequelize.DataTypes.UUID,
          defaultValue: Sequelize.DataTypes.UUIDV1,
          allowNull: false,
          primaryKey: true,
        },
        key: {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
        },
        value: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        expiresAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
        },
      });

      // Add index on key for faster lookups
      await queryInterface.addIndex("UserSessions", ["key"], {
        name: "user_sessions_key_index",
      });
    } catch (error) {
      console.log("Error in creating table UserSessions");
      if (error.errors) {
        error.errors.forEach((errorItem) => {
          console.error(errorItem.message);
        });
      } else {
        console.error(error);
      }
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("UserSessions", "user_sessions_key_index");
    await queryInterface.dropTable("UserSessions");
  },
};

