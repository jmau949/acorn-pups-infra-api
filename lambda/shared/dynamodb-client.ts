import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

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
   * Get a single item from DynamoDB
   */
  static async getItem(tableName: string, key: Record<string, any>) {
    const command = new GetCommand({
      TableName: this.getTableName(tableName),
      Key: key,
    });
    
    const response = await docClient.send(command);
    return response.Item;
  }

  /**
   * Put an item into DynamoDB
   */
  static async putItem(tableName: string, item: Record<string, any>) {
    const command = new PutCommand({
      TableName: this.getTableName(tableName),
      Item: item,
    });
    
    return await docClient.send(command);
  }

  /**
   * Update an item in DynamoDB
   */
  static async updateItem(
    tableName: string, 
    key: Record<string, any>, 
    updateExpression: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>
  ) {
    const command = new UpdateCommand({
      TableName: this.getTableName(tableName),
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    });
    
    return await docClient.send(command);
  }

  /**
   * Delete an item from DynamoDB
   */
  static async deleteItem(tableName: string, key: Record<string, any>) {
    const command = new DeleteCommand({
      TableName: this.getTableName(tableName),
      Key: key,
    });
    
    return await docClient.send(command);
  }

  /**
   * Query items from DynamoDB
   */
  static async queryItems(
    tableName: string,
    keyConditionExpression: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    indexName?: string,
    limit?: number
  ) {
    const command = new QueryCommand({
      TableName: this.getTableName(tableName),
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      IndexName: indexName,
      Limit: limit,
    });
    
    const response = await docClient.send(command);
    return response.Items || [];
  }

  /**
   * Scan items from DynamoDB (use sparingly)
   */
  static async scanItems(
    tableName: string,
    filterExpression?: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    limit?: number
  ) {
    const command = new ScanCommand({
      TableName: this.getTableName(tableName),
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      Limit: limit,
    });
    
    const response = await docClient.send(command);
    return response.Items || [];
  }

  /**
   * Get user by Cognito sub (for device registration)
   */
  static async getUserByCognitoSub(cognitoSub: string) {
    return await this.queryItems(
      'Users',
      'GSI2PK = :cognitoSub',
      { ':cognitoSub': cognitoSub },
      undefined,
      'GSI2' // GSI2 is the index for cognito_sub lookups
    );
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string) {
    return await this.queryItems(
      'Users',
      'GSI1PK = :email',
      { ':email': email },
      undefined,
      'GSI1' // GSI1 is the index for email lookups
    );
  }

  /**
   * Get user's devices
   */
  static async getUserDevices(userId: string) {
    return await this.queryItems(
      'DeviceUsers',
      'GSI1PK = :userId',
      { ':userId': userId },
      undefined,
      'GSI1' // GSI1 is the index for user_id lookups
    );
  }

  /**
   * Get device users (for notifications)
   */
  static async getDeviceUsers(deviceId: string) {
    return await this.queryItems(
      'DeviceUsers',
      'PK = :deviceId AND begins_with(SK, :userPrefix)',
      { 
        ':deviceId': `DEVICE#${deviceId}`,
        ':userPrefix': 'USER#'
      }
    );
  }

  /**
   * Get device metadata
   */
  static async getDeviceMetadata(deviceId: string) {
    return await this.getItem(
      'Devices',
      {
        PK: `DEVICE#${deviceId}`,
        SK: 'METADATA'
      }
    );
  }

  /**
   * Get device settings
   */
  static async getDeviceSettings(deviceId: string) {
    return await this.getItem(
      'Devices',
      {
        PK: `DEVICE#${deviceId}`,
        SK: 'SETTINGS'
      }
    );
  }

  /**
   * Get user's pending invitations
   */
  static async getUserInvitations(email: string) {
    return await this.queryItems(
      'Invitations',
      'GSI2PK = :email',
      { ':email': email },
      undefined,
      'GSI2' // GSI2 is the index for invited_email lookups
    );
  }
}

// Export the raw clients for advanced use cases
export { dynamoDBClient, docClient }; 