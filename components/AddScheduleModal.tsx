import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import React, { useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type LightType = 'warm' | 'natural' | 'both';

// Interface for stricter checks
interface Schedule {
    id: number;
    lightType: LightType;
    brightness: number;
    startTime: Date;
    endTime: Date;
    deviceId: string;
}

interface AddScheduleModalProps {
    isVisible: boolean;
    onClose: () => void;
    onAddSchedule: (schedule: {
        lightType: LightType;
        brightness: number; 
        startTime: Date;
        endTime: Date;
        deviceId: string;
    }) => void;
    availableDevices: string[]; 
    selectedDeviceId: string;
    existingSchedules: Schedule[]; 
}

const AddScheduleModal: React.FC<AddScheduleModalProps> = ({
    isVisible,
    onClose,
    onAddSchedule,
    availableDevices,
    selectedDeviceId,
    existingSchedules, 
}) => {
    // --- Form State ---
    const [selectedLightType, setSelectedLightType] = useState<LightType>('both'); 
    const [brightness, setBrightness] = useState(100);
    const now = new Date();
    const defaultStartTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    defaultStartTime.setMinutes(0, 0, 0); // Round to the nearest hour
    const defaultEndTime = new Date(defaultStartTime.getTime() + 60 * 60 * 1000); // 1 hour after start

    const [startTime, setStartTime] = useState(defaultStartTime);
    const [endTime, setEndTime] = useState(defaultEndTime);


    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);

    // State for device selection within the modal
    const [scheduleDeviceId, setScheduleDeviceId] = useState(selectedDeviceId); 


    // --- Handlers ---

    const handleLightTypeSelect = (type: LightType) => {
        setSelectedLightType(type);
        setBrightness(100); 
    };

    const handleBrightnessChange = (value: number) => {
        setBrightness(Math.round(value));
    };

    const handleDateChange = (event: any, selectedDate: Date | undefined, type: 'start' | 'end') => {
         if (event.type === 'dismissed') {
             if (type === 'start') setShowStartTimePicker(false);
             else setShowEndTimePicker(false);
             return;
         }


        const currentDate = selectedDate || (type === 'start' ? startTime : endTime);

        if (type === 'start') {
             setStartTime(currentDate);
             if (Platform.OS === 'android') setShowStartTimePicker(false); 
        } else {
            setEndTime(currentDate);
             if (Platform.OS === 'android') setShowEndTimePicker(false); 
        }
    };

    // Helper function to check for overlapping schedules
    const checkForOverlaps = (start: Date, end: Date, deviceId: string): boolean => {
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        
        // Loop through existing schedules and check for overlaps
        for (const schedule of existingSchedules) {
            if (schedule.deviceId !== deviceId) {
                continue;
            }
            
            // Convert schedule times to minutes since midnight
            const scheduleStartMinutes = schedule.startTime.getHours() * 60 + schedule.startTime.getMinutes();
            const scheduleEndMinutes = schedule.endTime.getHours() * 60 + schedule.endTime.getMinutes();
            
            // Check for overlap
            let overlap = false;
            
            if (scheduleEndMinutes < scheduleStartMinutes) {
                // Schedule spans midnight
                if (
                    // New schedule starts during existing schedule
                    (startMinutes >= scheduleStartMinutes || startMinutes < scheduleEndMinutes) &&
                    // New schedule ends during existing schedule
                    (endMinutes > scheduleStartMinutes || endMinutes <= scheduleEndMinutes)
                ) {
                    overlap = true;
                }
            } else {
                // Schedule within same day
                if (
                    // Check if start time is within the existing schedule range
                    (startMinutes >= scheduleStartMinutes && startMinutes < scheduleEndMinutes) ||
                    // Check if end time is within the existing schedule range
                    (endMinutes > scheduleStartMinutes && endMinutes <= scheduleEndMinutes) ||
                    // Check if the new schedule completely contains the existing schedule
                    (startMinutes <= scheduleStartMinutes && endMinutes >= scheduleEndMinutes)
                ) {
                    overlap = true;
                }
            }
            
            if (overlap) {
                const scheduleTimeString = `${String(schedule.startTime.getHours()).padStart(2, '0')}:${String(schedule.startTime.getMinutes()).padStart(2, '0')} - ${String(schedule.endTime.getHours()).padStart(2, '0')}:${String(schedule.endTime.getMinutes()).padStart(2, '0')}`;
                Alert.alert(
                    "Schedule Overlap",
                    `This time range overlaps with an existing schedule (${scheduleTimeString}). Please choose a different time.`
                );
                return true;
            }
        }
        
        // No overlaps found
        return false;
    };

    const handleAddPress = () => {
        // Add validation (e.g., end time after start time)
        if (startTime >= endTime) {
             Alert.alert("Invalid Time Range", "End time must be after start time.");
             return;
        }

        // Ensure brightness is between 0 and 100
         if (brightness < 0 || brightness > 100) {
             Alert.alert("Invalid Brightness", "Brightness must be between 0% and 100%.");
             return;
         }

        // Check for overlapping schedules
        if (checkForOverlaps(startTime, endTime, scheduleDeviceId)) {
             return;
         }

        const newSchedule = {
            lightType: selectedLightType,
            brightness: brightness,
            startTime: startTime,
            endTime: endTime,
            deviceId: scheduleDeviceId, 
        };

        console.log("Adding schedule:", newSchedule);
        onAddSchedule(newSchedule); 
        onClose(); 
    };

    // Helper to format Date object to HH:MM string
    const formatTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

     // Helper for conditional button styling (light type selection)
     const getLightButtonClass = (type: LightType) => {
         const baseClasses = "p-3 rounded-lg flex-1 mx-1 items-center";
         if (selectedLightType === type) {
             if (type === 'warm') return `${baseClasses} bg-accent`;
             if (type === 'natural') return `${baseClasses} bg-accent`;
             if (type === 'both') return `${baseClasses} bg-accent`;
         }
         // Default inactive style
         return `${baseClasses} bg-gray-400`; 
     };

      const getLightButtonTextClass = (type: LightType) => {
           return selectedLightType === type ? "text-white font-bold" : "text-white"; 
      };


    return (
        <Modal
            animationType="slide" 
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose} 
        >
            <View style={styles.modalOverlay} className='m-4 p-4'> 
                <View className="space-x-4 bg-primary m-4 p-20 rounded-lg w-full"> 
                    <Text className="my-4 font-bold text-white text-3xl text-center">
                        Add a Schedule
                    </Text>

                    {/* Light Selection */}
                    <Text className="self-center mb-2 font-semibold text-white text-lg">Light Type:</Text>
                    <View className="flex-row justify-around mb-4">
                        <TouchableOpacity
                            className={getLightButtonClass('warm')}
                            onPress={() => handleLightTypeSelect('warm')}><Text className={getLightButtonTextClass('warm')}>Warm</Text>
                        </TouchableOpacity>
                         <TouchableOpacity
                            className={getLightButtonClass('natural')}
                            onPress={() => handleLightTypeSelect('natural')}><Text className={getLightButtonTextClass('natural')}>Natural</Text>
                        </TouchableOpacity>
                         <TouchableOpacity
                            className={getLightButtonClass('both')}
                            onPress={() => handleLightTypeSelect('both')}><Text className={getLightButtonTextClass('both')}>Both</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Brightness Slider (appears dynamically) */}
                    {(selectedLightType !== null) ? ( 
                        <View className="mb-4">
                            <Text className="mb-2 font-semibold text-white text-lg">
                                Brightness ({brightness}%)
                            </Text>
                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={100}
                                value={brightness}
                                onValueChange={handleBrightnessChange}
                                minimumTrackTintColor="#AB8BFF" 
                                maximumTrackTintColor="#ffffff" 
                                thumbTintColor="#AB8BFF" 
                            />
                        </View>
                    ): null}

                    {/* Time Range Input */}
                    <Text className="mb-2 font-semibold text-white text-lg">Time Range:</Text>
                    <View className="flex-row justify-around mb-4">
                        {/* Start Time */}
                        <View className="flex-1 mr-2">
                             <Text className="mb-1 text-white text-base">Start Time:</Text>
                             <TouchableOpacity onPress={() => setShowStartTimePicker(true)} className="items-center bg-white p-3 border border-gray-500 rounded-lg"><Text className="text-neutral-800 text-base">{formatTime(startTime)}</Text>
                             </TouchableOpacity>
                             {showStartTimePicker ? (
                                 <DateTimePicker
                                     value={startTime}
                                     mode="time"
                                     is24Hour={true} 
                                     display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                                     onChange={(event, date) => handleDateChange(event, date, 'start')}
                                     themeVariant="light" 
                                     textColor="white" 
                                 />
                             ) : null}
                        </View>

                        {/* End Time */}
                         <View className="flex-1 ml-2">
                             <Text className="mb-1 text-white text-base">End Time:</Text>
                             <TouchableOpacity onPress={() => setShowEndTimePicker(true)} className="items-center bg-white p-3 border border-gray-500 rounded-lg"><Text className="text-neutral-800 text-base">{formatTime(endTime)}</Text>
                             </TouchableOpacity>
                              {showEndTimePicker ? (
                                 <DateTimePicker
                                     value={endTime}
                                     mode="time"
                                     is24Hour={true}
                                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                     onChange={(event, date) => handleDateChange(event, date, 'end')}
                                     themeVariant="light" 
                                     textColor="white" 
                                 />
                             ): null }
                         </View>
                    </View>


                    {/* Action Buttons */}
                    <View className="flex-row justify-around mt-4">
                         <TouchableOpacity
                            className="flex-1 items-center bg-gray-400 mx-1 p-3 rounded-lg"
                            onPress={onClose}><Text className="font-semibold text-white text-lg">Cancel</Text>
                         </TouchableOpacity>
                         <TouchableOpacity
                            className="flex-1 items-center bg-accent mx-1 p-3 rounded-lg"
                            onPress={handleAddPress}><Text className="font-semibold text-white text-lg">Add</Text>
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
    },
     slider: {
        width: '100%', 
        height: 40,
    },
     pickerContainer: { 
         backgroundColor: 'white',
         borderRadius: 8,
         overflow: 'hidden',
         borderWidth: 1,
         borderColor: '#ffffff', 
     },
      picker: { 
         width: '100%',
         color: '#ffffff', 
      },
      pickerItem: { 
         color: '#ffffff',
         fontSize: 16,
      }
});


export default AddScheduleModal;