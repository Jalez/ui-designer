import { DataTypes, Model, Sequelize } from 'sequelize';

export interface LevelAttributes {
  identifier: string;
  name: string;
  json: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LevelInstance extends Model<LevelAttributes>, LevelAttributes {
  associate?: (models: any) => void;
}

export default function LevelModel(sequelize: Sequelize) {
  const Level = sequelize.define<LevelInstance>(
    'Level',
    {
      identifier: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true },
      },
      json: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Level',
      timestamps: true,
    }
  );

  (Level as any).associate = (models: any) => {
    Level.belongsToMany(models.Map, { through: 'MapLevels' });
  };

  return Level;
}

