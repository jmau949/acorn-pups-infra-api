import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client with proper configuration
const dynamoDBClient = new DynamoDBClient({
  region: process.env.REGION || 'us-east-1',
  maxAttempts: 3,
  retryMode: 'adaptive',
});

// Create Document Client for easier JSON handling
const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    // Whether to automatically convert empty strings, blobs, and sets to `null`.
    convertEmptyValues: false,
    // Whether to remove undefined values while marshalling.
    removeUndefinedValues: true,
    // Whether to convert typeof object to map attribute.
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
    wrapNumbers: false,
  },
});

// GSI Index Constants
const GSI_INDEXES = {
  // Users table indexes
  USERS_EMAIL: 'GSI1',
  USERS_COGNITO_SUB: 'GSI2',
  // Devices table indexes  
  DEVICES_OWNER: 'GSI1',
  DEVICES_SERIAL: 'GSI2',
  // DeviceUsers table indexes
  DEVICE_USERS_BY_USER: 'GSI1',
  // Invitations table indexes
  INVITATIONS_BY_DEVICE: 'GSI1',
  INVITATIONS_BY_EMAIL: 'GSI2',
} as const;

// Table name constants
const TABLES = {
  USERS: 'Users',
  DEVICES: 'Devices', 
  DEVICE_USERS: 'DeviceUsers',
  INVITATIONS: 'Invitations',
  DEVICE_STATUS: 'DeviceStatus',
} as const;

// Custom error classes for better error handling
export class DynamoDBError extends Error {
  constructor(message: string, public readonly operation: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DynamoDBError';
  }
}

export class ItemNotFoundError extends DynamoDBError {
  constructor(tableName: string, key: Record<string, any>) {
    super(`Item not found in table ${tableName}`, 'GetItem');
    this.name = 'ItemNotFoundError';
  }
}

/**
 * DynamoDB utilities for Acorn Pups Lambda functions
 * Uses AWS SDK v3.844.0 from shared layer
 */
export class DynamoDBHelper {
  private static environment = process.env.ENVIRONMENT || 'dev';
  
  /**
   * Get the full table name with environment prefix
   */
  static getTableName(tableName: string): string {
    return `acorn-pups-${this.environment}-${tableName}`;
  }

  /**
   * Log DynamoDB operations for debugging
   */
  private static log(operation: string, tableName: string, details?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DynamoDB] ${operation} on ${tableName}`, details ? JSON.stringify(details, null, 2) : '');
    }
  }

  /**
   * Get a single item from DynamoDB with error handling
   */
  static async getItem(tableName: string, key: Record<string, any>, throwIfNotFound = false) {
    try {
      this.log('GetItem', tableName, { key });
      
      const command = new GetCommand({
        TableName: this.getTableName(tableName),
        Key: key,
      });
      
      const response = await docClient.send(command);
      
      if (!response.Item && throwIfNotFound) {
        throw new ItemNotFoundError(tableName, key);
      }
      
      return response.Item;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw error;
      }
      throw new DynamoDBError(
        `Failed to get item from ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GetItem',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Put an item into DynamoDB with error handling
   */
  static async putItem(tableName: string, item: Record<string, any>) {
    try {
      this.log('PutItem', tableName, { item });
      
      const command = new PutCommand({
        TableName: this.getTableName(tableName),
        Item: item,
      });
      
      return await docClient.send(command);
    } catch (error) {
      throw new DynamoDBError(
        `Failed to put item to ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PutItem',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update an item in DynamoDB with error handling
   */
  static async updateItem(
    tableName: string, 
    key: Record<string, any>, 
    updateExpression: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>
  ) {
    try {
      this.log('UpdateItem', tableName, { key, updateExpression });
      
      const command = new UpdateCommand({
        TableName: this.getTableName(tableName),
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW',
      });
      
      return await docClient.send(command);
    } catch (error) {
      throw new DynamoDBError(
        `Failed to update item in ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UpdateItem',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete an item from DynamoDB with error handling
   */
  static async deleteItem(tableName: string, key: Record<string, any>) {
    try {
      this.log('DeleteItem', tableName, { key });
      
      const command = new DeleteCommand({
        TableName: this.getTableName(tableName),
        Key: key,
      });
      
      return await docClient.send(command);
    } catch (error) {
      throw new DynamoDBError(
        `Failed to delete item from ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DeleteItem',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Query items from DynamoDB with error handling and optimization
   */
  static async queryItems(
    tableName: string,
    keyConditionExpression: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    indexName?: string,
    limit?: number,
    scanIndexForward?: boolean
  ) {
    try {
      this.log('QueryItems', tableName, { 
        keyConditionExpression, 
        indexName, 
        limit,
        scanIndexForward 
      });
      
      const command = new QueryCommand({
        TableName: this.getTableName(tableName),
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        IndexName: indexName,
        Limit: limit,
        ScanIndexForward: scanIndexForward,
      });
      
      const response = await docClient.send(command);
      return response.Items || [];
    } catch (error) {
      throw new DynamoDBError(
        `Failed to query items from ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'QueryItems',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ========================================
  // OPTIMIZED QUERY METHODS USING INDEXES
  // ========================================

  /**
   * Get user by Cognito sub (for device registration) - Uses GSI2
   */
  static async getUserByCognitoSub(cognitoSub: string) {
    const items = await this.queryItems(
      TABLES.USERS,
      'GSI2PK = :cognitoSub',
      { ':cognitoSub': cognitoSub },
      undefined,
      GSI_INDEXES.USERS_COGNITO_SUB
    );
    return items.length > 0 ? items[0] : null;
  }

  /**
   * Get user by email - Uses GSI1
   */
  static async getUserByEmail(email: string) {
    const items = await this.queryItems(
      TABLES.USERS,
      'GSI1PK = :email',
      { ':email': email },
      undefined,
      GSI_INDEXES.USERS_EMAIL
    );
    return items.length > 0 ? items[0] : null;
  }

  /**
   * Get user's devices - Uses GSI1 on DeviceUsers table
   */
  static async getUserDevices(userId: string) {
    return await this.queryItems(
      TABLES.DEVICE_USERS,
      'GSI1PK = :userId AND begins_with(GSI1SK, :devicePrefix)',
      { 
        ':userId': userId,
        ':devicePrefix': '' // All device IDs
      },
      undefined,
      GSI_INDEXES.DEVICE_USERS_BY_USER
    );
  }

  /**
   * Get device users (for notifications) - Uses main table query
   */
  static async getDeviceUsers(deviceId: string) {
    return await this.queryItems(
      TABLES.DEVICE_USERS,
      'PK = :deviceId AND begins_with(SK, :userPrefix)',
      { 
        ':deviceId': `DEVICE#${deviceId}`,
        ':userPrefix': 'USER#'
      }
    );
  }

  /**
   * Get devices owned by user - Uses GSI1 on Devices table
   */
  static async getDevicesByOwner(userId: string) {
    return await this.queryItems(
      TABLES.DEVICES,
      'GSI1PK = :userId',
      { ':userId': userId },
      undefined,
      GSI_INDEXES.DEVICES_OWNER
    );
  }

  /**
   * Get device by serial number - Uses GSI2 on Devices table
   */
  static async getDeviceBySerial(serialNumber: string) {
    const items = await this.queryItems(
      TABLES.DEVICES,
      'GSI2PK = :serial',
      { ':serial': serialNumber },
      undefined,
      GSI_INDEXES.DEVICES_SERIAL
    );
    return items.length > 0 ? items[0] : null;
  }

  /**
   * Get device metadata - Direct item lookup
   */
  static async getDeviceMetadata(deviceId: string) {
    return await this.getItem(
      TABLES.DEVICES,
      {
        PK: `DEVICE#${deviceId}`,
        SK: 'METADATA'
      }
    );
  }

  /**
   * Get device settings - Direct item lookup
   */
  static async getDeviceSettings(deviceId: string) {
    return await this.getItem(
      TABLES.DEVICES,
      {
        PK: `DEVICE#${deviceId}`,
        SK: 'SETTINGS'
      }
    );
  }

  /**
   * Get user's pending invitations - Uses GSI2 on Invitations table
   */
  static async getUserInvitations(email: string) {
    return await this.queryItems(
      TABLES.INVITATIONS,
      'GSI2PK = :email',
      { ':email': email },
      undefined,
      GSI_INDEXES.INVITATIONS_BY_EMAIL,
      undefined,
      false // Latest first
    );
  }

  /**
   * Get device invitations - Uses GSI1 on Invitations table
   */
  static async getDeviceInvitations(deviceId: string) {
    return await this.queryItems(
      TABLES.INVITATIONS,
      'GSI1PK = :deviceId',
      { ':deviceId': deviceId },
      undefined,
      GSI_INDEXES.INVITATIONS_BY_DEVICE,
      undefined,
      false // Latest first
    );
  }

  /**
   * Get device status by type - Direct item lookup
   */
  static async getDeviceStatus(deviceId: string, statusType: 'CURRENT' | 'HEALTH' | 'CONNECTIVITY') {
    return await this.getItem(
      TABLES.DEVICE_STATUS,
      {
        PK: `DEVICE#${deviceId}`,
        SK: `STATUS#${statusType}`
      }
    );
  }

  /**
   * Get all device status records - Query by device
   */
  static async getAllDeviceStatus(deviceId: string) {
    return await this.queryItems(
      TABLES.DEVICE_STATUS,
      'PK = :deviceId AND begins_with(SK, :statusPrefix)',
      { 
        ':deviceId': `DEVICE#${deviceId}`,
        ':statusPrefix': 'STATUS#'
      }
    );
  }

  /**
   * Get user profile - Direct item lookup
   */
  static async getUserProfile(userId: string) {
    return await this.getItem(
      TABLES.USERS,
      {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    );
  }

  /**
   * Get invitation by ID - Direct item lookup
   */
  static async getInvitation(invitationId: string) {
    return await this.getItem(
      TABLES.INVITATIONS,
      {
        PK: `INVITATION#${invitationId}`,
        SK: 'METADATA'
      }
    );
  }

  /**
   * Check if user has access to device - Direct item lookup
   */
  static async getUserDeviceAccess(deviceId: string, userId: string) {
    return await this.getItem(
      TABLES.DEVICE_USERS,
      {
        PK: `DEVICE#${deviceId}`,
        SK: `USER#${userId}`
      }
    );
  }
}

// Export the raw clients for advanced use cases
export { dynamoDBClient, docClient, GSI_INDEXES, TABLES }; 