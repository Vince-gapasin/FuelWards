import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const sections = ['collect', 'why', 'others', 'keep', 'rights'] as const;

// Draft privacy notice for the capstone build. Have it reviewed before a public launch.
export default function Privacy() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between border-b border-line px-4 py-2">
        <Text accessibilityRole="header" className="font-bold text-lg text-ink">
          {t('privacy.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-sky">
          <Ionicons name="close" size={24} className="text-ink" />
        </Pressable>
      </View>
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        {sections.map((s) => (
          <View key={s} className="w-full max-w-xl gap-1.5 self-center">
            <Text className="font-semibold text-base text-ink">{t(`privacy.${s}Heading`)}</Text>
            <Text className="text-base leading-6 text-ink-muted">{t(`privacy.${s}Body`)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
