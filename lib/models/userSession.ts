import { DataTypes, Model, Sequelize } from 'sequelize';

export interface UserSessionAttributes {
  sessionId: string;
  key: string;
  value: string | null;
  expiresAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserSessionInstance extends Model<UserSessionAttributes>, UserSessionAttributes {
  associate?: (models: any) => void;
}

export default function UserSessionModel(sequelize: Sequelize) {
  const UserSession = sequelize.define<UserSessionInstance>(
    'UserSession',
    {
      sessionId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
        allowNull: false,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true },
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'UserSession',
      timestamps: true,
      indexes: [
        {
          fields: ['key'],
        },
      ],
    }
  );

  return UserSession;
}

