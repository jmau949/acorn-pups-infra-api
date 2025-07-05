import { Context } from 'aws-lambda';

// This function is triggered by IoT Core rules, not API Gateway
// It processes device status updates from ESP32 receivers
export const handler = async (event: any, context: Context): Promise<void> => {
  try {
    console.log('Device status update event received:', JSON.stringify(event, null, 2));
    
    // TODO: Implement device status update logic
    // 1. Extract device ID and status data from event
    // 2. Parse status metrics (signal strength, memory usage, CPU temperature, etc.)
    // 3. Update DeviceStatus table in DynamoDB
    // 4. Update device metadata in Devices table (last_seen, is_online)
    // 5. Trigger alerts if status indicates issues
    
    const deviceId = event.deviceId || 'unknown';
    const statusType = event.statusType || 'CURRENT';
    const timestamp = event.receivedAt || event.timestamp || new Date().toISOString();
    
    console.log(`Processing status update for device ${deviceId}, type: ${statusType}, timestamp: ${timestamp}`);
    
    // Log status metrics for debugging
    if (event.signal_strength) console.log(`Signal strength: ${event.signal_strength} dBm`);
    if (event.memory_usage) console.log(`Memory usage: ${event.memory_usage}%`);
    if (event.cpu_temperature) console.log(`CPU temperature: ${event.cpu_temperature}°C`);
    if (event.uptime) console.log(`Uptime: ${event.uptime} seconds`);
    
    console.log('Device status update processed successfully');
  } catch (error) {
    console.error('Error processing device status update:', error);
    throw error;
  }
}; 