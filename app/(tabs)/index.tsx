import ESPDiscovery from "@/components/ESPDiscovery";
import WiFiSetupModal from "@/components/WiFiSetupModal";
import { images } from "@/constants/images";
import Slider from "@react-native-community/slider";
import { Picker } from '@react-native-picker/picker';
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Index() {
  const router = useRouter();

  // State for the currently selected ESP32 IP Address
  const [esp32IpAddress, setEsp32IpAddress] = useState<string | null>(null);
  
  // State for available devices 
  const [availableDevices, setAvailableDevices] = useState<string[]>([]);

  // State to manage the currently selected light mode 
  const [lightMode, setLightMode] = useState<'off' | 'warm' | 'natural' | 'both'>('off'); 

  // State to hold brightness values (0-100)
  const [warmBrightness, setWarmBrightness] = useState(0);
  const [naturalBrightness, setNaturalBrightness] = useState(0);

  // State to indicate if an API call is in progress 
  const [loading, setLoading] = useState(false);
  
  // State for WiFi setup modal
  const [isWifiModalVisible, setIsWifiModalVisible] = useState(false);
  
  // State to track if device is in AP mode 
  const [isDeviceInApMode, setIsDeviceInApMode] = useState(false);

  useEffect(() => {
    if (warmBrightness >= 1 && naturalBrightness >= 1) {
      setLightMode('both');
    } else if (warmBrightness >= 1) {
      setLightMode('warm');
    } else if (naturalBrightness >= 1) {
      setLightMode('natural');
    } else {
      setLightMode('off')
    }
  }, [warmBrightness, naturalBrightness])

  // Handler for when an ESP32 device is found
  const handleDeviceFound = async (address: string) => {
    setEsp32IpAddress(address);
    
    // Update available devices list
    if (!availableDevices.includes(address)) {
      setAvailableDevices([address, ...availableDevices]);
    }
    
    // Check if device is in AP mode
    try {
      const response = await fetch(`${address}/wifi/status`);
      if (response.ok) {
        const status = await response.json();
        setIsDeviceInApMode(!status.connected);
        
        if (!status.connected) {
          setIsWifiModalVisible(true);
        }
      }
    } catch (error) {
      console.error('Error checking device mode:', error);
    }
  };

  // --- API Call Function ---
  const sendApiCommand = async (endpoint: string): Promise<boolean> => { 
    if (!esp32IpAddress) {
        Alert.alert("Connection Error", "No ESP32 device connected. Please discover your device first.");
        return false; 
    }
    setLoading(true);
    const url = `${esp32IpAddress}${endpoint}`;
    console.log("Sending command to:", url);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status} for ${url}`);
        Alert.alert("API Error", `Failed to reach ESP32 (${response.status}). Check connection or IP.`);
        return false; 
      } else {
        const text = await response.text();
        console.log("API Response:", text);
        return true; 
      }
    } catch (error) {
      console.error(`Error sending command to ${url}:`, error);
      Alert.alert("Network Error", `Could not connect to ESP32. Is it on the same network?`);
      return false; 
    } finally {
      setLoading(false);
    }
  };

  // Button Handlers 
  const sendWarmOn = () => {
    sendApiCommand('/warm/on');
    setWarmBrightness(100);
  };

  const sendWarmOff = () => {
    setWarmBrightness(0); 
    sendApiCommand('/warm/brightness?level=0'); 
  };

   const sendNaturalOn = () => {
    sendApiCommand('/natural/on');
    setNaturalBrightness(100);
  };

  const sendNaturalOff = () => {
    setNaturalBrightness(0); 
    sendApiCommand('/natural/brightness?level=0');
  };

  const handleWarmBrightnessChange = (value: number) => {
    setWarmBrightness(Math.round(value));
  };

   const handleNaturalBrightnessChange = (value: number) => {
    setNaturalBrightness(Math.round(value));
  };

  // Slider
  const handleWarmSlidingComplete = (value: number) => {
     const roundedValue = Math.round(value);
     console.log("Warm slider released, sending command:", roundedValue);
     sendApiCommand(`/warm/brightness?level=${roundedValue}`);
      if (roundedValue > 0) setLightMode('warm'); 
      else if (naturalBrightness === 0) setLightMode('off'); 
      else setLightMode('natural'); 
  };

   const handleNaturalSlidingComplete = (value: number) => {
     const roundedValue = Math.round(value);
     console.log("Natural slider released, sending command:", roundedValue);
     sendApiCommand(`/natural/brightness?level=${roundedValue}`);
      if (roundedValue > 0) setLightMode('natural'); 
      else if (warmBrightness === 0) setLightMode('off'); 
      else setLightMode('warm');
  };

  // Handler for WiFi configuration success
  const handleWifiConfigSuccess = () => {
    // Reset the device in AP mode flag
    setIsDeviceInApMode(false);
    
    setTimeout(() => {
      Alert.alert(
        "Reconnect Required",
        "The ESP32 has restarted with new WiFi settings. Please reconnect to your regular WiFi network and tap Discover ESP32 again."
      );
    }, 1000);
  };

  return (
    <View className="flex-1 bg-primary">
        <Image
            source={images.bg}
            className="top-0 left-0 z-0 absolute w-full h-full"
            contentFit="cover"
        />

        <ScrollView
            className="flex-1 px-5 py-8"
            showsVerticalScrollIndicator={false}
        >
            <Text className="mt-4 mb-4 font-bold text-white text-3xl text-center">
                Home
            </Text>
            
            {loading ? (
                <View className="z-10 absolute inset-0 justify-center items-center bg-black bg-opacity-50">
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text className="mt-2 text-white">Sending Command...</Text>
                </View>
            ): null}

             {availableDevices.length > 0 && (
               <View className="mb-3">
                  <Text className="mb-2 font-semibold text-white text-lg">Select Device:</Text>
                  <View style={styles.pickerContainer}> 
                      <Picker
                          selectedValue={esp32IpAddress || ''}
                          onValueChange={(itemValue) =>
                              setEsp32IpAddress(itemValue)
                          }
                          style={styles.picker}
                          itemStyle={styles.pickerItem} 
                      >
                          {availableDevices.map(deviceIp => (
                              <Picker.Item key={deviceIp} label={deviceIp} value={deviceIp} />
                          ))}
                      </Picker>
                  </View>
               </View>
             )}
             
             <View className="flex-row justify-between mb-1">
                <View className="flex-1 mr-2">
                    <ESPDiscovery onDeviceFound={handleDeviceFound} />
                </View>
               
               
             </View>

             <View>
              {esp32IpAddress && (
                      <TouchableOpacity 
                          className="flex-1 items-center bg-indigo-600 mr-2 p-4 rounded-lg"
                          onPress={() => setIsWifiModalVisible(true)}
                      >
                          <Text className="font-semibold text-white text-base">Configure WiFi</Text>
                      </TouchableOpacity>
                  )}
             </View>
             
             {isDeviceInApMode && (
                <View className="bg-yellow-500 mb-4 p-3 rounded-lg">
                    <Text className="font-bold text-black text-center">
                        Device is in setup mode. Please configure WiFi settings.
                    </Text>
                </View>
             )}
             
            <View className="bg-neutral-800 mt-4 mb-2 w-full h-1"></View>

             <Text className="mb-4 text-white text-lg text-center">
                Current Mode: <Text className="font-bold capitalize">{lightMode}</Text>
            </Text>

            {/* ON Buttons Container */}
             <View className="flex-row justify-around mb-4">
                <TouchableOpacity className={`${warmBrightness > 0 ? `opacity-50` : ``} flex-1 items-center bg-accent  mx-1 p-4 rounded-lg`}
                  onPress={warmBrightness > 0 ? sendWarmOff : sendWarmOn}>
                      <Text className="font-semibold text-white text-lg">Warm</Text>
                      <Text className="font-semibold text-white text-lg">{warmBrightness > 0 ? 'Off' : 'On'}</Text> 
                </TouchableOpacity>

                <TouchableOpacity className={`${naturalBrightness > 0 ? `opacity-50` : ``} flex-1 items-center bg-white mx-1 p-4 rounded-lg`} 
                  onPress={naturalBrightness > 0 ? sendNaturalOff : sendNaturalOn}>
                  <Text className="font-semibold text-neutral-700 text-lg">Natural</Text>
                  <Text className="font-semibold text-neutral-700 text-lg">{naturalBrightness > 0 ? 'Off' : 'On'}</Text>
                </TouchableOpacity>
             </View>

            {/* Brightness Sliders Area */}
            <View className="mb-8">
                {/* Warm Brightness Slider */}
                <Text className="mb-2 font-semibold text-white text-lg">Warm Brightness ({Math.round(warmBrightness)}%)</Text>
                <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    value={warmBrightness}
                    onValueChange={handleWarmBrightnessChange}
                    onSlidingComplete={handleWarmSlidingComplete}
                    minimumTrackTintColor="#AB8BFF" 
                    maximumTrackTintColor="#FFFFFF"
                    thumbTintColor="#AB8BFF" 
                />

                {/* Natural Brightness Slider */}
                <Text className="mt-4 mb-2 font-semibold text-white text-lg">Natural Brightness ({Math.round(naturalBrightness)}%)</Text>
                 <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    value={naturalBrightness}
                    onValueChange={handleNaturalBrightnessChange}
                    onSlidingComplete={handleNaturalSlidingComplete}
                    minimumTrackTintColor="#CCCCCC"
                    maximumTrackTintColor="#FFFFFF"
                    thumbTintColor="#CCCCCC" 
                />
            </View>
        </ScrollView>
        
        <WiFiSetupModal
            isVisible={isWifiModalVisible}
            onClose={() => setIsWifiModalVisible(false)}
            deviceAddress={esp32IpAddress}
            onSuccess={handleWifiConfigSuccess}
        />
    </View>
  );
}

const styles = StyleSheet.create({
    slider: {
        width: '100%',
        height: 40,
    },
    pickerContainer: {
         backgroundColor: 'white', 
         borderRadius: 8,
         overflow: 'hidden', 
    },
     picker: {
        width: '100%',
        color: '#000', 
     },
     pickerItem: { 
         color: '#000',
         fontSize: 16,
     }
});