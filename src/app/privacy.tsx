import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const sections = [
  {
    heading: 'What we collect',
    body: 'Your username, email address and password (stored encrypted by our authentication provider). When you report a price, we record the station, the price, the time, and your location at that moment. Photos of price boards are stored only if you choose to attach one.',
  },
  {
    heading: 'Why we collect it',
    body: 'To run your account, to check that price reports come from people at the station, to award and track your points, and to show fuel prices to everyone using FuelWards. Your location is used only while you use the map or submit a report.',
  },
  {
    heading: 'What others can see',
    body: 'Other users see your username on the leaderboard and the prices you report. They never see your email address or your location.',
  },
  {
    heading: 'How long we keep it',
    body: 'Account data is kept while your account is active. Report locations are kept for up to 12 months for fraud checks, then deleted. You can ask us to delete your account and data at any time.',
  },
  {
    heading: 'Your rights',
    body: 'Under the Data Privacy Act of 2012 (RA 10173) you can access, correct, object to, and request deletion of your personal data. Contact the FuelWards team to exercise these rights.',
  },
];

// Draft privacy notice for the capstone build. Have it reviewed before a public launch.
export default function Privacy() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-line px-4 py-2">
        <Text accessibilityRole="header" className="font-bold text-lg text-ink">
          Privacy Notice
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-sky">
          <Ionicons name="close" size={24} color="#1D1B20" />
        </Pressable>
      </View>
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        {sections.map((s) => (
          <View key={s.heading} className="w-full max-w-xl gap-1.5 self-center">
            <Text className="font-semibold text-base text-ink">{s.heading}</Text>
            <Text className="text-base leading-6 text-ink-muted">{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
