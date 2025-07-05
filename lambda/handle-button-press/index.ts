import { Context } from 'aws-lambda';

// This function is triggered by IoT Core rules, not API Gateway
export const handler = async (event: any, context: Context): Promise<void> => {
  try {
    console.log('Button press event received:', JSON.stringify(event, null, 2));
    
    // TODO: Implement button press handling logic
    // 1. Extract device ID and button RF ID from event
    // 2. Query DeviceUsers table to get all authorized users
    // 3. Send push notifications via SNS
    
    console.log('Button press handled successfully');
  } catch (error) {
    console.error('Error handling button press:', error);
    throw error;
  }
}; 