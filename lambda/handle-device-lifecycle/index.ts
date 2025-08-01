import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Context } from 'aws-lambda';
import ResponseHandler from '../shared/response-handler';

// Initialize DynamoDB client
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Environment variables
const DEVICES_TABLE = process.env.DEVICES_TABLE || 'acorn-pups-Devices-dev';

interface DeviceLifecycleEvent {
  clientId: string;
  deviceId: string;
  eventType: 'connected' | 'disconnected';
  timestamp: number;
  certificateArn?: string;
  sessionIdentifier?: string;
  versionNumber?: number;
}

export const handler = async (event: DeviceLifecycleEvent, context: Context) => {
  console.log('Device lifecycle event received:', JSON.stringify(event, null, 2));

  try {
    const { deviceId, eventType, timestamp } = event;

    if (!deviceId || !eventType) {
      console.error('Missing required fields:', { deviceId, eventType });
      return ResponseHandler.badRequest(
        'Missing required fields: deviceId or eventType',
        context.awsRequestId || 'unknown'
      );
    }

    // Determine if device is online based on event type
    const isOnline = eventType === 'connected';

    // Update device status in DynamoDB
    const updateParams = {
      TableName: DEVICES_TABLE,
      Key: {
        PK: `DEVICE#${deviceId}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET is_online = :isOnline, last_seen = :lastSeen, updated_at = :updatedAt',
      ExpressionAttributeValues: {
        ':isOnline': isOnline,
        ':lastSeen': new Date(timestamp).toISOString(),
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
      ReturnValues: 'ALL_NEW' as const
    };

    console.log('Updating device status:', updateParams);

    try {
      const result = await dynamoDb.send(new UpdateCommand(updateParams));
      console.log('Device status updated successfully:', result.Attributes);

      return ResponseHandler.success({
        message: 'Device lifecycle event processed successfully',
        deviceId,
        eventType,
        isOnline,
        lastSeen: new Date(timestamp).toISOString()
      }, context.awsRequestId || 'unknown');
    } catch (dbError: any) {
      if (dbError.name === 'ConditionalCheckFailedException') {
        console.error('Device not found:', deviceId);
        return ResponseHandler.notFound(
          `Device ${deviceId} not found in database`,
          context.awsRequestId || 'unknown'
        );
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error processing device lifecycle event:', error);
    return ResponseHandler.internalError(
      'Failed to process device lifecycle event',
      context.awsRequestId || 'unknown'
    );
  }
};