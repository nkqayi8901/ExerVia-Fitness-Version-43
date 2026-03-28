// Health API Integration Service for ExerVia Fitness
// Integrates with native health platforms without using competitor APIs

export class HealthApiService {
  constructor() {
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isAndroid = /Android/.test(navigator.userAgent);
    this.healthKitAvailable = this.isIOS && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.healthKit;
    this.googleFitAvailable = this.isAndroid && window.AndroidBridge && window.AndroidBridge.googleFit;
  }

  // Check if health data access is available
  isHealthDataAvailable() {
    return this.healthKitAvailable || this.googleFitAvailable || this.isWebHealthApiSupported();
  }

  // Check for Web Health API support (experimental)
  isWebHealthApiSupported() {
    return 'health' in navigator && 'query' in navigator.health;
  }

  // Request permission to access health data
  async requestPermission(dataTypes = ['steps', 'heart_rate', 'sleep']) {
    try {
      if (this.healthKitAvailable) {
        return await this.requestHealthKitPermission(dataTypes);
      } else if (this.googleFitAvailable) {
        return await this.requestGoogleFitPermission(dataTypes);
      } else if (this.isWebHealthApiSupported()) {
        return await this.requestWebHealthPermission(dataTypes);
      } else {
        throw new Error('No health API available on this platform');
      }
    } catch (error) {
      console.error('Health permission request failed:', error);
      return false;
    }
  }

  // HealthKit integration for iOS
  async requestHealthKitPermission(dataTypes) {
    return new Promise((resolve) => {
      window.webkit.messageHandlers.healthKit.postMessage({
        action: 'requestPermission',
        dataTypes: dataTypes
      });
      
      // Set up response handler
      window.exerviaHealthKitResponse = (response) => {
        resolve(response.success);
      };
    });
  }

  async getHealthKitData(dataType, startDate, endDate) {
    return new Promise((resolve, reject) => {
      window.webkit.messageHandlers.healthKit.postMessage({
        action: 'readData',
        dataType: dataType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      window.exerviaHealthKitData = (data) => {
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data);
        }
      };
    });
  }

  // Google Fit integration for Android
  async requestGoogleFitPermission(dataTypes) {
    return new Promise((resolve) => {
      window.AndroidBridge.googleFit.requestPermission(JSON.stringify(dataTypes), (success) => {
        resolve(success);
      });
    });
  }

  async getGoogleFitData(dataType, startDate, endDate) {
    return new Promise((resolve, reject) => {
      const params = {
        dataType: dataType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      };
      
      window.AndroidBridge.googleFit.readData(JSON.stringify(params), (data) => {
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
  }

  // Web Health API integration (experimental)
  async requestWebHealthPermission(dataTypes) {
    const permissions = dataTypes.map(type => ({
      name: this.mapDataTypeToWebHealth(type)
    }));
    
    try {
      const result = await navigator.permissions.query({ permissions });
      return result.state === 'granted';
    } catch (error) {
      console.error('Web Health API permission failed:', error);
      return false;
    }
  }

  async getWebHealthData(dataType, startDate, endDate) {
    const queryOptions = {
      query: this.buildWebHealthQuery(dataType, startDate, endDate)
    };

    try {
      const result = await navigator.health.query(queryOptions);
      return this.transformWebHealthData(result, dataType);
    } catch (error) {
      console.error('Web Health API query failed:', error);
      throw error;
    }
  }

  // Data type mapping
  mapDataTypeToWebHealth(dataType) {
    const mapping = {
      'steps': 'steps',
      'heart_rate': 'heart-rate',
      'sleep': 'sleep',
      'calories': 'calories',
      'distance': 'distance',
      'weight': 'weight',
      'height': 'height'
    };
    return mapping[dataType] || dataType;
  }

  buildWebHealthQuery(dataType, startDate, endDate) {
    const baseQuery = {
      startDate: startDate,
      endDate: endDate
    };

    switch (dataType) {
      case 'steps':
        return { ...baseQuery, type: 'steps' };
      case 'heart_rate':
        return { ...baseQuery, type: 'heart-rate' };
      case 'sleep':
        return { ...baseQuery, type: 'sleep' };
      case 'calories':
        return { ...baseQuery, type: 'calories' };
      case 'distance':
        return { ...baseQuery, type: 'distance' };
      default:
        return baseQuery;
    }
  }

  transformWebHealthData(data, dataType) {
    // Transform Web Health API response to standard format
    return {
      dataType: dataType,
      data: data.map(item => ({
        value: item.value,
        timestamp: item.timestamp,
        source: item.source || 'Web Health API'
      }))
    };
  }

  // Main method to fetch health data
  async fetchHealthData(dataType, startDate, endDate) {
    try {
      if (this.healthKitAvailable) {
        return await this.getHealthKitData(dataType, startDate, endDate);
      } else if (this.googleFitAvailable) {
        return await this.getGoogleFitData(dataType, startDate, endDate);
      } else if (this.isWebHealthApiSupported()) {
        return await this.getWebHealthData(dataType, startDate, endDate);
      } else {
        throw new Error('No health API available');
      }
    } catch (error) {
      console.error(`Failed to fetch ${dataType} data:`, error);
      throw error;
    }
  }

  // Sync health data to Supabase
  async syncHealthDataToSupabase(userId, dataType, data) {
    const { supabase } = await import('../supabaseClient');
    
    try {
      const insertData = {
        user_id: userId,
        data_type: dataType,
        data: data,
        synced_at: new Date().toISOString(),
        source: this.healthKitAvailable ? 'HealthKit' : 
                this.googleFitAvailable ? 'Google Fit' : 'Web Health API'
      };

      const { error } = await supabase
        .from('health_data_sync')
        .insert(insertData);

      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Failed to sync health data to Supabase:', error);
      throw error;
    }
  }

  // Get comprehensive health summary
  async getHealthSummary(userId, days = 7) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
    
    const dataTypes = ['steps', 'heart_rate', 'sleep', 'calories'];
    const summary = {};

    for (const dataType of dataTypes) {
      try {
        const data = await this.fetchHealthData(dataType, startDate, endDate);
        summary[dataType] = this.processHealthData(data, dataType);
        
        // Sync to Supabase
        await this.syncHealthDataToSupabase(userId, dataType, data);
      } catch (error) {
        console.warn(`Failed to get ${dataType} data:`, error);
        summary[dataType] = { error: error.message };
      }
    }

    return summary;
  }

  // Process and normalize health data
  processHealthData(rawData, dataType) {
    if (!rawData || !rawData.data) {
      return { total: 0, average: 0, trend: 0 };
    }

    const values = rawData.data.map(item => item.value).filter(v => v != null);
    
    if (values.length === 0) {
      return { total: 0, average: 0, trend: 0 };
    }

    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    
    // Calculate trend (simple linear regression)
    const trend = this.calculateTrend(values);

    return {
      total: Math.round(total),
      average: Math.round(average * 100) / 100,
      trend: Math.round(trend * 100) / 100,
      count: values.length,
      latest: values[values.length - 1],
      oldest: values[0]
    };
  }

  // Calculate trend using linear regression
  calculateTrend(values) {
    const n = values.length;
    if (n < 2) return 0;

    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  // Check sync status
  async getSyncStatus(userId) {
    const { supabase } = await import('../supabaseClient');
    
    try {
      const { data, error } = await supabase
        .from('health_data_sync')
        .select('data_type, synced_at')
        .eq('user_id', userId)
        .order('synced_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return [];
    }
  }
}

// Export singleton instance
export const healthApiService = new HealthApiService();

// Utility function to check if health integration is supported
export function isHealthIntegrationSupported() {
  const service = new HealthApiService();
  return service.isHealthDataAvailable();
}

// Utility function to get platform-specific instructions
export function getHealthIntegrationInstructions() {
  const service = new HealthApiService();
  
  if (service.isIOS) {
    return {
      platform: 'iOS',
      instructions: [
        'Open Settings > Privacy & Security > Health',
        'Enable ExerVia Fitness access to your health data',
        'Grant permissions for Steps, Heart Rate, and Sleep data'
      ],
      setupLink: 'https://support.apple.com/en-us/HT203018'
    };
  } else if (service.isAndroid) {
    return {
      platform: 'Android',
      instructions: [
        'Install Google Fit app from Play Store',
        'Open Google Fit and set up your health profile',
        'Grant ExerVia Fitness access to fitness and health data'
      ],
      setupLink: 'https://support.google.com/googleplay/answer/6014972'
    };
  } else {
    return {
      platform: 'Web',
      instructions: [
        'Use Chrome browser for best compatibility',
        'Enable experimental Web Health API in chrome://flags',
        'Grant permissions when prompted'
      ],
      setupLink: 'https://web.dev/health/'
    };
  }
}

export default healthApiService;