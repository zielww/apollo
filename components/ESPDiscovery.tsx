import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ESP32Device {
  ip_address: string;
  device_name: string;
  last_online: number;
  device_type: string;
}

interface ESPDiscoveryProps {
  onDeviceFound: (address: string) => void;
}

const ESPDiscovery: React.FC<ESPDiscoveryProps> = ({ onDeviceFound }) => {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<ESP32Device | null>(null);
  const [esp32Address, setEsp32Address] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<'station' | 'ap' | 'unknown'>('unknown');

  // Firebase URL
  // I hardcoded this bcuz its free anyways and its a hassle to create secrets in GitHub
  const firebaseUrl = "https://apollo-671a4-default-rtdb.asia-southeast1.firebasedatabase.app";

  useEffect(() => {
    // Load saved ESP32 address and device ID on component mount
    const loadSavedData = async () => {
      try {
        const savedAddress = await AsyncStorage.getItem('@esp32_address');
        const savedDeviceId = await AsyncStorage.getItem('@esp32_device_id');
        
        // If we have a saved device ID, try to load its info right away
        if (savedDeviceId) {
          setDeviceId(savedDeviceId);
          discoverDeviceByID(savedDeviceId, false);
        }
        
        if (savedAddress) {
          setEsp32Address(savedAddress);
          // Check if the device is in AP mode
          checkConnectionMode(savedAddress);
          // Notify parent component about the device address
          onDeviceFound(savedAddress);
        }
      } catch (error) {
        console.error('Error loading saved ESP32 data:', error);
      }
    };
    
    loadSavedData();
    
    // Also try to discover devices on component mount
    discoverDevices();
  }, []);

  // Check if the device is in AP mode or station mode
  const checkConnectionMode = async (address: string) => {
    try {
      // Try to get the WiFi status
      const response = await fetch(`${address}/wifi/status`);
      if (response.ok) {
        const status = await response.json();
        setConnectionMode(status.connected ? 'station' : 'ap');
      }
    } catch (error) {
      console.error('Error checking connection mode:', error);
      // If we can't connect, assume it might be in AP mode
      setConnectionMode('unknown');
    }
  };

  // Function to discover all available ESP32 devices from Firebase
  const discoverDevices = async () => {
    setIsDiscovering(true);
    
    try {
      const response = await fetch(`${firebaseUrl}/devices.json`);
      
      if (!response.ok) {
        throw new Error(`Firebase responded with status ${response.status}`);
      }
      
      const devices = await response.json();
      
      if (!devices) {
        setIsDiscovering(false);
        Alert.alert('No Devices Found', 'No ESP32 devices found in Firebase.');
        return;
      }
      
      // Find the first device (or you could show a list to choose from)
      const deviceIds = Object.keys(devices);
      
      if (deviceIds.length > 0) {
        // Use the first device found
        const firstDeviceId = deviceIds[0];
        const deviceData = devices[firstDeviceId];
        
        // Save device ID and device info
        setDeviceId(firstDeviceId);
        setDeviceInfo(deviceData);
        await AsyncStorage.setItem('@esp32_device_id', firstDeviceId);
        
        // Format and save the IP address
        const formattedIp = deviceData.ip_address.startsWith('http') 
          ? deviceData.ip_address 
          : `http://${deviceData.ip_address}`;
          
        setEsp32Address(formattedIp);
        await AsyncStorage.setItem('@esp32_address', formattedIp);
        
        // Check if the device is in AP mode
        checkConnectionMode(formattedIp);
        
        // Notify parent component
        onDeviceFound(formattedIp);
        
        console.log('Found ESP32:', deviceData);
      } else {
        Alert.alert('No Devices Found', 'No ESP32 devices found in Firebase.');
      }
    } catch (error) {
      console.error('Error discovering ESP32 devices:', error);
      Alert.alert('Discovery Error', 'Failed to discover ESP32 devices. Please check your connection.');
    } finally {
      setIsDiscovering(false);
    }
  };
  
  // Function to discover a specific device by ID
  const discoverDeviceByID = async (id: string, showAlerts: boolean = true) => {
    setIsDiscovering(true);
    
    try {
      const response = await fetch(`${firebaseUrl}/devices/${id}.json`);
      
      if (!response.ok) {
        throw new Error(`Firebase responded with status ${response.status}`);
      }
      
      const deviceData = await response.json();
      
      if (!deviceData) {
        setIsDiscovering(false);
        if (showAlerts) {
          Alert.alert('Device Not Found', 'ESP32 device not found in Firebase.');
        }
        return;
      }
      
      // Save device info
      setDeviceInfo(deviceData);
      
      // Format and save the IP address
      const formattedIp = deviceData.ip_address.startsWith('http') 
        ? deviceData.ip_address 
        : `http://${deviceData.ip_address}`;
        
      setEsp32Address(formattedIp);
      await AsyncStorage.setItem('@esp32_address', formattedIp);
      
      // Check if the device is in AP mode
      checkConnectionMode(formattedIp);
      
      // Notify parent component
      onDeviceFound(formattedIp);
      
      console.log('Found ESP32:', deviceData);
      
      // Test the connection
      try {
        const testResponse = await fetch(`${formattedIp}/time`, { 
          method: 'GET'
        });
        
        if (testResponse.ok && showAlerts) {
          Alert.alert('Device Connected', `Connected to ESP32 at ${deviceData.ip_address}`);
        }
      } catch (error) {
        if (showAlerts) {
          Alert.alert(
            'Connection Warning', 
            `Found ESP32 in Firebase, but couldn't connect to it at ${deviceData.ip_address}. The device may be offline.`
          );
        }
      }
    } catch (error) {
      console.error('Error discovering ESP32 device:', error);
      if (showAlerts) {
        Alert.alert('Discovery Error', `Failed to discover ESP32 device. Please check your connection.`);
      }
    } finally {
      setIsDiscovering(false);
    }
  };
  
  // Helper function to format time
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      {connectionMode === 'ap' && esp32Address && (
        <View style={styles.apModeWarning}>
          <Text style={styles.apModeText}>
            Device in Setup Mode. Configure WiFi before using.
          </Text>
        </View>
      )}

      {deviceInfo && esp32Address && (
        <View style={styles.deviceInfoContainer}>
          <Text style={styles.deviceInfoText}>
            Connected to: {deviceInfo.device_name || "ESP32 Device"}
          </Text>
          <Text style={styles.deviceInfoText}>
            Mode: {connectionMode === 'station' ? 'Normal' : connectionMode === 'ap' ? 'Setup' : 'Unknown'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, isDiscovering && styles.buttonDisabled]}
        onPress={discoverDevices}
        disabled={isDiscovering}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>
          {isDiscovering ? "Discovering..." : "Discover ESP32"}
        </Text>
      </TouchableOpacity>
      
      {isDiscovering && (
        <ActivityIndicator style={styles.loader} color="#AB8BFF" />
      )}

      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  loader: {
    marginTop: 10,
  },
  button: {
    backgroundColor: '#AB8BFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#A78BDA',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  deviceInfoContainer: {
    marginBottom: 10,
    padding: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
  },
  deviceInfoText: {
    color: 'white',
    fontSize: 14,
  },
  apModeWarning: {
    backgroundColor: '#FFB302',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  apModeText: {
    color: '#000',
    fontWeight: 'bold',
    textAlign: 'center',
  }
});

export default ESPDiscovery;
