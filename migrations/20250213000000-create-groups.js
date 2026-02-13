"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.createTable("Groups", {
        id: {
          type: Sequelize.DataTypes.UUID,
          defaultValue: Sequelize.DataTypes.UUIDV4,
          allowNull: false,
          primaryKey: true,
        },
        name: {
          type: Sequelize.DataTypes.STRING(255),
          allowNull: false,
        },
        ltiContextId: {
          type: Sequelize.DataTypes.STRING(255),
          allowNull: true,
          unique: true,
        },
        ltiContextTitle: {
          type: Sequelize.DataTypes.STRING(255),
          allowNull: true,
        },
        resourceLinkId: {
          type: Sequelize.DataTypes.STRING(255),
          allowNull: true,
        },
        createdBy: {
          type: Sequelize.DataTypes.UUID,
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

      await queryInterface.createTable("GroupMembers", {
        id: {
          type: Sequelize.DataTypes.UUID,
          defaultValue: Sequelize.DataTypes.UUIDV4,
          allowNull: false,
          primaryKey: true,
        },
        groupId: {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
          references: {
            model: "Groups",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        userId: {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
        },
        role: {
          type: Sequelize.DataTypes.STRING(50),
          allowNull: false,
          defaultValue: "member",
        },
        joinedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
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

      await queryInterface.addIndex("Groups", ["ltiContextId"], {
        name: "groups_lti_context_id_index",
      });

      await queryInterface.addIndex("Groups", ["createdBy"], {
        name: "groups_created_by_index",
      });

      await queryInterface.addIndex("GroupMembers", ["groupId"], {
        name: "group_members_group_id_index",
      });

      await queryInterface.addIndex("GroupMembers", ["userId"], {
        name: "group_members_user_id_index",
      });

      await queryInterface.addIndex("GroupMembers", ["groupId", "userId"], {
        name: "group_members_group_user_unique_index",
        unique: true,
      });

      console.log("✅ Groups and GroupMembers tables created successfully");
    } catch (error) {
      console.log("❌ Error in creating Groups/GroupMembers tables");
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
      await queryInterface.removeIndex("GroupMembers", "group_members_group_user_unique_index");
      await queryInterface.removeIndex("GroupMembers", "group_members_user_id_index");
      await queryInterface.removeIndex("GroupMembers", "group_members_group_id_index");
      await queryInterface.removeIndex("Groups", "groups_created_by_index");
      await queryInterface.removeIndex("Groups", "groups_lti_context_id_index");
      await queryInterface.dropTable("GroupMembers");
      await queryInterface.dropTable("Groups");
      console.log("✅ Groups and GroupMembers tables dropped successfully");
    } catch (error) {
      console.error("❌ Error dropping Groups/GroupMembers tables:", error);
      throw error;
    }
  },
};
