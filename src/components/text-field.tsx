import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

type Props = Omit<TextInputProps, 'secureTextEntry' | 'className'> & {
  label: string;
  error?: string;
  /** Hides the text and shows an eye button to reveal it. */
  secure?: boolean;
};

export function TextField({ label, error, secure, onFocus, onBlur, ...input }: Props) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const border = error ? 'border-danger' : focused ? 'border-action' : 'border-line-strong';

  return (
    <View className="gap-1.5">
      <Text className="font-semibold text-sm text-ink">{label}</Text>
      <View className={`h-12 flex-row items-center rounded-lg border bg-surface ${border}`}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#8A8A8A"
          className="h-full flex-1 px-3 font-sans text-base text-ink outline-none"
          secureTextEntry={secure && hidden}
          autoCapitalize="none"
          autoCorrect={false}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(hidden ? 'auth.show' : 'auth.hide', {
              field: label.toLowerCase(),
            })}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            className="h-full justify-center px-3">
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              className="text-ink-muted"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-critical">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
