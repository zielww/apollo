import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface WiFiSetupModalProps {
  isVisible: boolean;
  onClose: () => void;
  deviceAddress: string | null;
  onSuccess: () => void;
}

const WiFiSetupModal: React.FC<WiFiSetupModalProps> = ({
  isVisible,
  onClose,
  deviceAddress,
  onSuccess
}) => {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    // Validate inputs
    if (!ssid.trim()) {
      Alert.alert('Error', 'WiFi SSID is required');
      return;
    }

    if (!deviceAddress) {
      Alert.alert('Error', 'No device connected. Please discover your device first.');
      return;
    }

    setIsLoading(true);

    try {
      // Send the WiFi configuration to the ESP32
      const response = await fetch(`${deviceAddress}/wifi/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ssid: ssid.trim(),
          password: password.trim()
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Success',
          'WiFi configuration updated. The ESP32 will restart and connect to your WiFi network.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                onSuccess();
                onClose();
              }
            }
          ]
        );
      } else {
        const errorText = await response.text();
        Alert.alert('Error', `Failed to update WiFi configuration: ${errorText}`);
      }
    } catch (error) {
      console.error('Error sending WiFi configuration:', error);
      Alert.alert(
        'Connection Error',
        'Failed to send WiFi configuration to the ESP32. Make sure you are connected to the ESP32 setup network.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Configure WiFi</Text>
          
          <Text style={styles.label}>WiFi Network Name (SSID)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter WiFi SSID"
            placeholderTextColor="#999"
            value={ssid}
            onChangeText={setSsid}
            autoCapitalize="none"
          />
          
          <Text style={styles.label}>WiFi Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter WiFi Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <View style={styles.showPasswordContainer}>
              <Switch
                value={showPassword}
                onValueChange={setShowPassword}
                trackColor={{ false: "#767577", true: "#AB8BFF" }}
                thumbColor={showPassword ? "#8B5CF6" : "#f4f3f4"}
              />
              <Text style={styles.showPasswordText}>Show</Text>
            </View>
          </View>
          
          <Text style={styles.note}>
            Note: After configuration, the ESP32 will restart and attempt to connect to your WiFi network.
            You may need to discover the device again.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: 'white',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#333',
    color: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  passwordContainer: {
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: '#333',
    color: 'white',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 8,
  },
  showPasswordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showPasswordText: {
    color: 'white',
    marginLeft: 8,
  },
  note: {
    color: '#BBB',
    fontSize: 14,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#555',
    marginRight: 8,
  },
  submitButton: {
    backgroundColor: '#AB8BFF',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default WiFiSetupModal; 