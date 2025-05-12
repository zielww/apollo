import { icons } from '@/constants/icons'
import { images } from '@/constants/images'
import { Text } from '@react-navigation/elements'
import { Tabs } from 'expo-router'
import React from 'react'
import { Image, ImageBackground, View } from 'react-native'

const TabIcon = ({focused, icon, title}: any) => {
    if (focused) {
        return (
            <ImageBackground source={images.highlight} className='flex flex-row flex-1 justify-center items-center mt-4 rounded-full w-full min-w-[150px] min-h-16 overflow-hidden text-center'>
                <Image source={icon} tintColor="#151312" className='size-5' />
                <Text className="ml-4 font-bold text-secondary text-sm">{title}</Text>
            </ImageBackground>
        )
    }

    return (
        <View className="justify-center items-center mt-4 rounded-full size-full">
            <Image source={icon} tintColor="#A8B5DB" className="size" />
        </View>
    )
}

const _layout = () => {
  return (
    <Tabs
        screenOptions={{
            tabBarShowLabel: false,
            tabBarItemStyle: {
                width: '100%',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
            },
            tabBarStyle: {
                backgroundColor: "#0f0D23",
                borderRadius: 50,
                marginHorizontal: 20,
                marginBottom: 36,
                height: 52,
                position: "absolute",
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "#0f0D23",
            }
        }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.home} title="Home" />
          )
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          headerShown: false,
          title: "Schedule",
            tabBarIcon: ({focused}) => (
                <TabIcon focused={focused} icon={icons.person} title="Schedule"/>
            )
        }}
      />
    </Tabs>
  )
}

export default _layout