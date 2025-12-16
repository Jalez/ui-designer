"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.createTable("Projects", {
        id: {
          type: Sequelize.DataTypes.UUID,
          defaultValue: Sequelize.DataTypes.UUIDV4,
          allowNull: false,
          primaryKey: true,
        },
        userId: {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
        },
        mapName: {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
          references: {
            model: 'Maps',
            key: 'name',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        title: {
          type: Sequelize.DataTypes.STRING(500),
          allowNull: false,
        },
        progressData: {
          type: Sequelize.DataTypes.JSON,
          allowNull: false,
          defaultValue: {},
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

      // Add indexes
      await queryInterface.addIndex("Projects", ["userId"], {
        name: "projects_user_id_index",
      });

      await queryInterface.addIndex("Projects", ["mapName"], {
        name: "projects_map_name_index",
      });

      await queryInterface.addIndex("Projects", ["userId", "mapName"], {
        name: "projects_user_map_index",
      });

      await queryInterface.addIndex("Projects", ["updatedAt"], {
        name: "projects_updated_at_index",
      });

      console.log("✅ Projects table created successfully");
    } catch (error) {
      console.log("❌ Error in creating table Projects");
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
    try {
      await queryInterface.removeIndex("Projects", "projects_updated_at_index");
      await queryInterface.removeIndex("Projects", "projects_user_map_index");
      await queryInterface.removeIndex("Projects", "projects_map_name_index");
      await queryInterface.removeIndex("Projects", "projects_user_id_index");
      await queryInterface.dropTable("Projects");
      console.log("✅ Projects table dropped successfully");
    } catch (error) {
      console.error("❌ Error dropping Projects table:", error);
      throw error;
    }
  },
};





