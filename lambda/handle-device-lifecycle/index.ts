import { Context } from 'aws-lambda';
import { DynamoDBHelper } from '../shared/dynamodb-client';
import ResponseHandler from '../shared/response-handler';

// Table parameter for DynamoDB operations
const TABLE_PARAM = 'devices';

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
    const { deviceId, eventType, timestamp, clientId } = event;

    if (!deviceId || !eventType) {
      console.error('Missing required fields:', { deviceId, eventType });
      return ResponseHandler.badRequest(
        'Missing required fields: deviceId or eventType',
        context.awsRequestId || 'unknown'
      );
    }

    console.log('Processing device lifecycle event:', {
      deviceId,
      clientId,
      eventType,
      timestamp,
      timestampAsDate: new Date(timestamp).toISOString(),
      requestId: context.awsRequestId
    });

    // Determine if device is online based on event type
    const isOnline = eventType === 'connected';

    // Update device status using DynamoDBHelper
    try {
      const result = await DynamoDBHelper.updateItem(
        TABLE_PARAM,
        { PK: `DEVICE#${deviceId}`, SK: 'METADATA' },
        'SET is_online = :isOnline, last_seen = :lastSeen, updated_at = :updatedAt',
        {
          ':isOnline': isOnline,
          ':lastSeen': new Date(timestamp).toISOString(),
          ':updatedAt': new Date().toISOString()
        },
        undefined,
        'attribute_exists(PK) AND attribute_exists(SK)'
      );

      console.log('Device status updated successfully:', {
        deviceId,
        eventType,
        isOnline,
        updatedAt: new Date().toISOString(),
        lastSeen: new Date(timestamp).toISOString()
      });

      return ResponseHandler.success({
        message: 'Device lifecycle event processed successfully',
        deviceId,
        clientId,
        eventType,
        isOnline,
        lastSeen: new Date(timestamp).toISOString()
      }, context.awsRequestId || 'unknown');
    } catch (dbError: any) {
      console.error('Failed to update device status:', {
        error: dbError,
        deviceId,
        eventType,
        errorMessage: dbError.message,
        errorName: dbError.name
      });
      
      // If device doesn't exist, log it but don't fail the lambda
      if (dbError.name === 'ConditionalCheckFailedException' || dbError.message?.includes('ConditionalCheckFailed')) {
        console.warn('Device not found in database - device may not be registered yet:', {
          deviceId,
          clientId,
          eventType
        });
        return ResponseHandler.success({
          message: 'Device lifecycle event received but device not found - ignoring',
          deviceId,
          clientId,
          eventType
        }, context.awsRequestId || 'unknown');
      }
      
      throw dbError;
    }
  } catch (error) {
    console.error('Error processing device lifecycle event:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      deviceId: event.deviceId,
      clientId: event.clientId,
      eventType: event.eventType,
      requestId: context.awsRequestId
    });
    return ResponseHandler.internalError(
      'Failed to process device lifecycle event',
      context.awsRequestId || 'unknown'
    );
  }
};