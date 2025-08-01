import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// Initialize DynamoDB client with proper configuration
const dynamoDBClient = new DynamoDBClient({
  region: process.env.REGION || 'us-east-1',
  maxAttempts: 3,
  retryMode: 'adaptive',
});

// Initialize SSM client for parameter store access
const ssmClient = new SSMClient({
  region: process.env.REGION || 'us-east-1',
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

// GSI Index Constants - matching actual database schema
const GSI_INDEXES = {
  // Users table indexes
  USERS_EMAIL: 'GSI1',           // email (PK), user_id (SK)
  // Devices table indexes  
  DEVICES_OWNER: 'GSI1',         // owner_user_id (PK), device_id (SK)
  DEVICES_SERIAL: 'GSI2',        // serial_number (PK), device_id (SK)
  // DeviceUsers table indexes
  DEVICE_USERS_BY_USER: 'GSI1',  // user_id (PK), device_id (SK)
  // Invitations table indexes
  INVITATIONS_BY_DEVICE: 'GSI1', // device_id (PK), created_at (SK)
  INVITATIONS_BY_EMAIL: 'GSI2',  // invited_email (PK), created_at (SK)
} as const;

// Table name constants for parameter store paths
const TABLE_PARAMS = {
  USERS: 'users',
  DEVICES: 'devices', 
  DEVICE_USERS: 'device-users',
  INVITATIONS: 'invitations',
  DEVICE_STATUS: 'device-status',
} as const;

// Cache for table names to avoid repeated parameter store calls
const tableNameCache = new Map<string, string>();

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
   * Get the table name from parameter store with caching
   */
  static async getTableName(tableParam: string): Promise<string> {
    // Check cache first
    if (tableNameCache.has(tableParam)) {
      return tableNameCache.get(tableParam)!;
    }

    try {
      const parameterPath = `/acorn-pups/${this.environment}/dynamodb-tables/${tableParam}/name`;
      
      const command = new GetParameterCommand({
        Name: parameterPath,
      });
      
      const response = await ssmClient.send(command);
      
      if (!response.Parameter?.Value) {
        throw new Error(`Parameter ${parameterPath} not found`);
      }
      
      const tableName = response.Parameter.Value;
      // Cache the result
      tableNameCache.set(tableParam, tableName);
      
      return tableName;
    } catch (error) {
      // Fallback to constructed name if parameter store fails
      console.warn(`Failed to get table name from parameter store for ${tableParam}, using fallback`);
      const fallbackName = `acorn-pups-${tableParam}-${this.environment}`;
      tableNameCache.set(tableParam, fallbackName);
      return fallbackName;
    }
  }

  /**
   * Log DynamoDB operations for debugging
   */
  private static log(operation: string, tableName: string, details?: any) {
    if (process.env.LOG_LEVEL === 'DEBUG' || process.env.NODE_ENV !== 'production') {
      console.log(`[DynamoDB] ${operation} on ${tableName}`, details ? JSON.stringify(details, null, 2) : '');
    }
  }

  /**
   * Get a single item from DynamoDB with error handling
   */
  static async getItem(tableParam: string, key: Record<string, any>, throwIfNotFound = false) {
    try {
      const tableName = await this.getTableName(tableParam);
      this.log('GetItem', tableName, { key });
      
      const command = new GetCommand({
        TableName: tableName,
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
        `Failed to get item from ${tableParam}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GetItem',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Put an item into DynamoDB with error handling
   */
  static async putItem(tableParam: string, item: Record<string, any>) {
    try {
      const tableName = await this.getTableName(tableParam);
      this.log('PutItem', tableName, { item });
      
      const command = new PutCommand({
        TableName: tableName,
        Item: item,
      });
      
      return await docClient.send(command);
    } catch (error) {
      throw new DynamoDBError(
        `Failed to put item to ${tableParam}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PutItem',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update an item in DynamoDB with error handling
   */
  static async updateItem(
    tableParam: string, 
    key: Record<string, any>, 
    updateExpression: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    conditionExpression?: string
  ) {
    try {
      const tableName = await this.getTableName(tableParam);
      this.log('UpdateItem', tableName, { key, updateExpression });
      
      const command = new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ConditionExpression: conditionExpression,
        ReturnValues: 'ALL_NEW',
      });
      
      return await docClient.send(command);
    } catch (error) {
      throw new DynamoDBError(
        `Failed to update item in ${tableParam}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UpdateItem',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete an item from DynamoDB with error handling
   */
  static async deleteItem(tableParam: string, key: Record<string, any>) {
    try {
      const tableName = await this.getTableName(tableParam);
      this.log('DeleteItem', tableName, { key });
      
      const command = new DeleteCommand({
        TableName: tableName,
        Key: key,
      });
      
      return await docClient.send(command);
    } catch (error) {
      throw new DynamoDBError(
        `Failed to delete item from ${tableParam}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DeleteItem',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Query items from DynamoDB with error handling and optimization
   */
  static async queryItems(
    tableParam: string,
    keyConditionExpression: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    indexName?: string,
    limit?: number,
    scanIndexForward?: boolean
  ) {
    try {
      const tableName = await this.getTableName(tableParam);
      this.log('QueryItems', tableName, { 
        keyConditionExpression, 
        indexName, 
        limit,
        scanIndexForward 
      });
      
      const command = new QueryCommand({
        TableName: tableName,
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
        `Failed to query items from ${tableParam}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'QueryItems',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute multiple DynamoDB operations as a transaction
   */
  static async transactWrite(operations: Array<{
    action: 'Put' | 'Update' | 'Delete';
    tableParam: string;
    item?: Record<string, any>;
    key?: Record<string, any>;
    updateExpression?: string;
    expressionAttributeValues?: Record<string, any>;
    expressionAttributeNames?: Record<string, string>;
    conditionExpression?: string;
  }>) {
    try {
      const transactItems = [];
      
      for (const op of operations) {
        const tableName = await this.getTableName(op.tableParam);
        
        if (op.action === 'Put' && op.item) {
          transactItems.push({
            Put: {
              TableName: tableName,
              Item: op.item,
              ...(op.conditionExpression && { ConditionExpression: op.conditionExpression }),
              ...(op.expressionAttributeValues && { ExpressionAttributeValues: op.expressionAttributeValues }),
              ...(op.expressionAttributeNames && { ExpressionAttributeNames: op.expressionAttributeNames }),
            },
          });
        } else if (op.action === 'Update' && op.key && op.updateExpression) {
          transactItems.push({
            Update: {
              TableName: tableName,
              Key: op.key,
              UpdateExpression: op.updateExpression,
              ...(op.expressionAttributeValues && { ExpressionAttributeValues: op.expressionAttributeValues }),
              ...(op.expressionAttributeNames && { ExpressionAttributeNames: op.expressionAttributeNames }),
              ...(op.conditionExpression && { ConditionExpression: op.conditionExpression }),
            },
          });
        } else if (op.action === 'Delete' && op.key) {
          transactItems.push({
            Delete: {
              TableName: tableName,
              Key: op.key,
              ...(op.conditionExpression && { ConditionExpression: op.conditionExpression }),
              ...(op.expressionAttributeValues && { ExpressionAttributeValues: op.expressionAttributeValues }),
              ...(op.expressionAttributeNames && { ExpressionAttributeNames: op.expressionAttributeNames }),
            },
          });
        }
      }
      
      this.log('TransactWrite', 'multiple-tables', { operationCount: transactItems.length });
      
      const command = new TransactWriteCommand({
        TransactItems: transactItems,
      });
      
      return await docClient.send(command);
    } catch (error) {
      throw new DynamoDBError(
        `Failed to execute transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TransactWrite',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ============================================================
  // OPTIMIZED QUERY METHODS USING INDEXES - NO SCANS
  // ============================================================



  /**
   * Get user by email using GSI1
   */
  static async getUserByEmail(email: string) {
    return await this.queryItems(
      TABLE_PARAMS.USERS,
      'email = :email',
      { ':email': email },
      undefined,
      GSI_INDEXES.USERS_EMAIL
    );
  }

  /**
   * Get all devices a user has access to using GSI1
   */
  static async getUserDevices(userId: string) {
    return await this.queryItems(
      TABLE_PARAMS.DEVICE_USERS,
      'user_id = :userId',
      { ':userId': userId },
      undefined,
      GSI_INDEXES.DEVICE_USERS_BY_USER
    );
  }

  /**
   * Get device users by device ID (main table query)
   */
  static async getDeviceUsers(deviceId: string) {
    return await this.queryItems(
      TABLE_PARAMS.DEVICE_USERS,
      'PK = :deviceId',
      { ':deviceId': `DEVICE#${deviceId}` }
    );
  }

  /**
   * Get devices owned by user using GSI1
   */
  static async getDevicesByOwner(userId: string) {
    return await this.queryItems(
      TABLE_PARAMS.DEVICES,
      'owner_user_id = :userId',
      { ':userId': userId },
      undefined,
      GSI_INDEXES.DEVICES_OWNER
    );
  }

  /**
   * Get device by serial number using GSI2
   */
  static async getDeviceBySerial(serialNumber: string) {
    return await this.queryItems(
      TABLE_PARAMS.DEVICES,
      'serial_number = :serialNumber',
      { ':serialNumber': serialNumber },
      undefined,
      GSI_INDEXES.DEVICES_SERIAL
    );
  }

  /**
   * Get device metadata by device ID (main table query)
   */
  static async getDeviceMetadata(deviceId: string) {
    return await this.getItem(
      TABLE_PARAMS.DEVICES,
      { PK: `DEVICE#${deviceId}`, SK: 'METADATA' }
    );
  }

  /**
   * Get device settings by device ID (main table query)
   */
  static async getDeviceSettings(deviceId: string) {
    return await this.getItem(
      TABLE_PARAMS.DEVICES,
      { PK: `DEVICE#${deviceId}`, SK: 'SETTINGS' }
    );
  }

  /**
   * Get user invitations by email using GSI2
   */
  static async getUserInvitations(email: string) {
    return await this.queryItems(
      TABLE_PARAMS.INVITATIONS,
      'invited_email = :email',
      { ':email': email },
      undefined,
      GSI_INDEXES.INVITATIONS_BY_EMAIL
    );
  }

  /**
   * Get device invitations using GSI1
   */
  static async getDeviceInvitations(deviceId: string) {
    return await this.queryItems(
      TABLE_PARAMS.INVITATIONS,
      'device_id = :deviceId',
      { ':deviceId': deviceId },
      undefined,
      GSI_INDEXES.INVITATIONS_BY_DEVICE
    );
  }

  /**
   * Get specific device status by type (main table query)
   */
  static async getDeviceStatus(deviceId: string, statusType: 'CURRENT' | 'HEALTH' | 'CONNECTIVITY') {
    return await this.getItem(
      TABLE_PARAMS.DEVICE_STATUS,
      { PK: `DEVICE#${deviceId}`, SK: statusType }
    );
  }

  /**
   * Get all device status entries (main table query)
   */
  static async getAllDeviceStatus(deviceId: string) {
    return await this.queryItems(
      TABLE_PARAMS.DEVICE_STATUS,
      'PK = :deviceId',
      { ':deviceId': `DEVICE#${deviceId}` }
    );
  }

  /**
   * Get user profile (main table query)
   */
  static async getUserProfile(userId: string) {
    return await this.getItem(
      TABLE_PARAMS.USERS,
      { PK: `USER#${userId}`, SK: 'PROFILE' }
    );
  }

  /**
   * Get specific invitation by ID (main table query)
   */
  static async getInvitation(invitationId: string) {
    return await this.getItem(
      TABLE_PARAMS.INVITATIONS,
      { PK: `INVITATION#${invitationId}`, SK: 'METADATA' }
    );
  }

  /**
   * Check user device access (main table query)
   */
  static async getUserDeviceAccess(deviceId: string, userId: string) {
    return await this.getItem(
      TABLE_PARAMS.DEVICE_USERS,
      { PK: `DEVICE#${deviceId}`, SK: `USER#${userId}` }
    );
  }
} 