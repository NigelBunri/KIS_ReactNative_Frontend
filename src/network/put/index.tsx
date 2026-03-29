/**
 * Put Data Utility Function
 *
 * Description:
 * A reusable function to send PUT requests to an API endpoint. It supports sending data,
 * custom headers, and provides mechanisms to handle success/error messages. The function is
 * designed for general-purpose usage across the project.
 *
 * Parameters:
 * - url (string): The API endpoint to send the PUT request to.
 * - data (any): The data payload to be sent in the PUT request body.
 * - options (PutDataOptions): An object to configure various options for the PUT operation:
 *   - headers (Record<string, string>): Custom headers to include in the API request.
 *   - messages (object): Customizable success and error messages:
 *     - success (string): Success message to return on successful operation.
 *     - error (string): Error message to return if the operation fails.
 *
 * Returns:
 * - A promise resolving to an object with the following properties:
 *   - success (boolean): Whether the operation succeeded.
 *   - data (any): The response data from the API.
 *   - message (string): A success or error message.
 *
 * Usage:
 * Call the function with the desired API URL, data payload, and optional configurations.
 * Example:
 * const result = await putData('/api/users/1', { name: 'John Doe' }, { messages: { success: 'User updated successfully' } });
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import type { ApiResult, HeadersInit } from '../types';
import { getAccessToken } from '@/security/authStorage';

interface PutDataOptions {
  headers?: HeadersInit; // Custom headers for the API request
  messages?: {
    success?: string; // Custom success message
    error?: string; // Custom error message
  };
}

export const putData = async (
  url: string,
  data: any,
  options: PutDataOptions = {}
): Promise<ApiResult> => {
  const { headers = {}, messages = {} } = options;

  try {
    const userToken = await getAccessToken();
    const deviceId = await AsyncStorage.getItem('device_id');
    const requestHeaders: HeadersInit = { ...headers };
    if (userToken) requestHeaders.Authorization = `Bearer ${userToken}`;
    if (deviceId) requestHeaders['X-Device-Id'] = deviceId;

    // Send PUT request to the API
    const response = await apiService.put(url, data, requestHeaders);

    // Parse the API response
    const responseData = await response.json().catch(() => ({}));

    // Check the API response status
    if (response.status === 200 || response.status === 204) {
      return { success: true, data: responseData, message: messages.success || 'Data updated successfully.' };
    } else {
      return { success: false, message: messages.error || 'Failed to update data.' };
    }
  } catch (error: any) {
    // Handle errors during the PUT operation
    console.error(error);
    return { success: false, message: error.message || 'An error occurred while updating data.' };
  }
};
