import { DataTypes, Model, Sequelize } from 'sequelize';

export interface MapAttributes {
  name: string;
  random: number;
  canUseAI: boolean;
  easyLevelPoints: number;
  mediumLevelPoints: number;
  hardLevelPoints: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MapInstance extends Model<MapAttributes>, MapAttributes {
  associate?: (models: any) => void;
}

export default function MapModel(sequelize: Sequelize) {
  const Map = sequelize.define<MapInstance>(
    'Map',
    {
      name: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        validate: {
          notEmpty: true,
          isAlphanumeric: true,
          not: /^names|all$/i,
        },
      },
      random: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { isInt: true, min: 0 },
      },
      canUseAI: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      easyLevelPoints: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: true, min: 1 },
      },
      mediumLevelPoints: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: true, min: 1 },
      },
      hardLevelPoints: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: true, min: 1 },
      },
    },
    {
      sequelize,
      modelName: 'Map',
      timestamps: true,
    }
  );

  (Map as any).associate = (models: any) => {
    Map.belongsToMany(models.Level, { through: 'MapLevels' });
  };

  return Map;
}

